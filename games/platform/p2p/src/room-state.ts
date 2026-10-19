// The host's view of a room: who is in it, who sits in which seat, and the game itself. Every
// function here is pure. The host runs each event through them and broadcasts the result.

// What a game has to provide to run in a room. State and moves cross the wire as JSON.
export interface GameRules<State, Move> {
  // Seats in join order. The host takes the first one.
  seats: readonly string[]
  createState: () => State
  // The next state, or null when the move is illegal for that seat
  applyMove: (state: State, seat: string, move: Move) => State | null
  isOver: (state: State) => boolean
  isMove: (value: unknown) => value is Move
  isState: (value: unknown) => value is State
  // Called when the player in a seat leaves (the host too), for example to skip their turn or
  // end the game. Then the seat goes to the first member without one, or stays free.
  onSeatLeft?: (state: State, seat: string) => State
}

// A player in the room, with the connection that controls it. The player stays the same across
// tabs, reloads and connections (see player-id.ts); the peer is one tab's connection to the room.
export interface Member {
  playerId: string
  peerId: string
}

// Why a player is not here right now. away: its page is hidden, and it said so. offline: the host
// lost its connection, and holds its place and seat while it may come back.
export type Absence = 'away' | 'offline'

export interface RoomState<State> {
  // Players in join order, spectators too. The first one is the host, and the next one whose
  // connection is still up takes over when the host leaves (see succession.ts).
  members: Member[]
  // Goes up by one each time a new host takes over, so peers can tell a stale host from the current one
  term: number
  // The room stands in for one that may exist under the same code: it was started under a code
  // someone else gave out, or hosted again by a member that found itself alone. It stays so through
  // every handover, and gives way to a room that is not when the two meet (see succession.ts).
  provisional: boolean
  // Seat → player ID of the player in it, or null while it is free
  seats: Record<string, string | null>
  game: State
  // Player → ID of the last intent the host handled from it, so a resent intent is applied once
  handled: Record<string, number>
  // Players that are not here right now, as the host sees it (see session.ts)
  absent: Record<string, Absence>
}

export interface MoveIntent<Move> {
  type: 'move'
  move: Move
}

export interface RestartIntent {
  type: 'restart'
}

// What a player asks the host to do
export type Intent<Move> = MoveIntent<Move> | RestartIntent

// An intent with an ID that goes up with every intent its sender sends
export type NumberedIntent<Move> = Intent<Move> & {id: number}

export const createRoomState = <State, Move>(
  rules: GameRules<State, Move>,
  host: Member,
  provisional = false
): RoomState<State> => ({
  members: [host],
  term: 0,
  provisional,
  seats: Object.fromEntries(rules.seats.map((seat, index) => [seat, index === 0 ? host.playerId : null])),
  game: rules.createState(),
  handled: {},
  absent: {}
})

export const hostOf = (room: RoomState<unknown>): Member | null => room.members[0] ?? null

export const memberByPeer = (room: RoomState<unknown>, peerId: string): Member | null =>
  room.members.find(member => member.peerId === peerId) ?? null

export const memberByPlayer = (room: RoomState<unknown>, playerId: string): Member | null =>
  room.members.find(member => member.playerId === playerId) ?? null

export const seatOf = (room: RoomState<unknown>, playerId: string): string | null =>
  Object.keys(room.seats).find(seat => room.seats[seat] === playerId) ?? null

export const isFull = (room: RoomState<unknown>): boolean => Object.values(room.seats).every(playerId => playerId !== null)

const without = <T>(record: Record<string, T>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([id]) => id !== key))

// Free seats go to the members without one, in join order. Returns the same room when there is
// nothing to fill.
const fillSeats = <State>(room: RoomState<State>): RoomState<State> => {
  const seated = new Set(Object.values(room.seats))
  const waiting = room.members.filter(member => !seated.has(member.playerId))
  const free = Object.keys(room.seats).filter(seat => room.seats[seat] === null)

  if (waiting.length === 0 || free.length === 0) {
    return room
  }

  const seats = {...room.seats}
  free.forEach((seat, index) => (seats[seat] = waiting[index]?.playerId ?? null))

  return {...room, seats}
}

// A connection that joins. A new player becomes the last member and takes a free seat, with the
// game as it is, or watches until one frees up. A player already in the room (back after a reload,
// or in another tab) keeps its place and seat, and this connection controls it from now on. The
// new connection numbers its intents from one again, so what was handled from the old one no
// longer counts. The host's player on a new connection is a new host, with a new term.
export const joinPlayer = <State>(room: RoomState<State>, member: Member): RoomState<State> => {
  const known = memberByPlayer(room, member.playerId)

  if (!known) {
    return fillSeats({...room, members: [...room.members, member]})
  }

  if (known.peerId === member.peerId) {
    return room
  }

  return {
    ...room,
    members: room.members.map(each => (each === known ? member : each)),
    term: known === hostOf(room) ? room.term + 1 : room.term,
    handled: without(room.handled, member.playerId)
  }
}

export const dropPlayer = <State, Move>(
  rules: GameRules<State, Move>,
  room: RoomState<State>,
  playerId: string
): RoomState<State> => {
  if (!memberByPlayer(room, playerId)) {
    return room
  }

  const members = room.members.filter(member => member.playerId !== playerId)
  const handled = without(room.handled, playerId)
  const absent = without(room.absent, playerId)
  const seat = seatOf(room, playerId)

  if (!seat) {
    return {...room, members, handled, absent}
  }

  // The game sees the seat left before it goes to someone else
  const game = rules.onSeatLeft ? rules.onSeatLeft(room.game, seat) : room.game

  return fillSeats({...room, members, handled, absent, game, seats: {...room.seats, [seat]: null}})
}

const applyToGame = <State, Move>(
  rules: GameRules<State, Move>,
  room: RoomState<State>,
  seat: string,
  intent: Intent<Move>
): State => {
  if (intent.type === 'restart') {
    return rules.isOver(room.game) ? rules.createState() : room.game
  }

  return rules.applyMove(room.game, seat, intent.move) ?? room.game
}

// Each intent of a player is handled once: it counts as handled even when the rules reject it.
// Returns the same room object for an intent that was handled already or comes from a stranger.
export const applyIntent = <State, Move>(
  rules: GameRules<State, Move>,
  room: RoomState<State>,
  playerId: string,
  intent: NumberedIntent<Move>
): RoomState<State> => {
  if (!memberByPlayer(room, playerId) || intent.id <= (room.handled[playerId] ?? 0)) {
    return room
  }

  const handled = {...room.handled, [playerId]: intent.id}
  const seat = seatOf(room, playerId)

  if (!seat || !isFull(room)) {
    return {...room, handled}
  }

  return {...room, handled, game: applyToGame(rules, room, seat, intent)}
}
