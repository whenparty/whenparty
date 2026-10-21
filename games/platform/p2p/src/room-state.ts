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
  // Called when the presence of the player in a seat changes (the host's too), so the game decides
  // what to do with the match: wait, skip their turn, end it. The platform itself never stops a
  // game. After left, the seat goes to the first member without one, or stays free.
  onPresence?: (state: State, seat: string, presence: SeatPresence) => State
}

// lost: the player is not here (its page is hidden, or its link dropped and the host holds its
// seat). back: it is here again, on the same connection or a new one. left: it is gone for good
// (it left, or its seat was held for as long as the room holds it), and the seat is free.
export type SeatPresence = 'lost' | 'back' | 'left'

// A player in the room, with the connection that controls it. The player stays the same across
// tabs, reloads and connections (see player-id.ts); the peer is one tab's connection to the room.
export interface Member {
  playerId: string
  peerId: string
}

// Why a player is not here right now. away: its page is hidden, and it said so. offline: the host
// lost its connection, and holds its place and seat while it may come back.
export type Absence = 'away' | 'offline'

// How a room came about, which settles two hosts of the same term (see succession.ts). original:
// made by a player who created it. resumed: hosted again from its last snapshot by a member that
// found itself alone. fresh: started with a new game under a code someone else gave out, or by a
// reloaded host that found nobody. A room gives way to one that comes earlier in this order.
export type Origin = 'original' | 'resumed' | 'fresh'

export interface RoomState<State> {
  // Players in join order, spectators too. The first one is the host, and the next one whose
  // connection is still up takes over when the host leaves (see succession.ts).
  members: Member[]
  // Goes up by one each time a new host takes over, so peers can tell a stale host from the current one
  term: number
  // Kept through every handover
  origin: Origin
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
  origin: Origin = 'original'
): RoomState<State> => ({
  members: [host],
  term: 0,
  origin,
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
  const game = rules.onPresence ? rules.onPresence(room.game, seat, 'left') : room.game

  return fillSeats({...room, members, handled, absent, game, seats: {...room.seats, [seat]: null}})
}

// The seats whose player is absent
const absentSeats = (room: RoomState<unknown>, absent: Record<string, Absence>): string[] =>
  Object.keys(room.seats).filter(seat => {
    const playerId = room.seats[seat]
    return playerId !== null && playerId !== undefined && absent[playerId] !== undefined
  })

// The room with who is absent now, as the host sees it. The game hears of every seat whose
// player was absent and is no more, or the other way round.
export const withAbsent = <State, Move>(
  rules: GameRules<State, Move>,
  room: RoomState<State>,
  absent: Record<string, Absence>
): RoomState<State> => {
  const {onPresence} = rules

  if (!onPresence) {
    return {...room, absent}
  }

  const before = new Set(absentSeats(room, room.absent))
  const after = new Set(absentSeats(room, absent))
  const game = Object.keys(room.seats)
    .filter(seat => before.has(seat) !== after.has(seat))
    .reduce((state, seat) => onPresence(state, seat, after.has(seat) ? 'lost' : 'back'), room.game)

  return {...room, absent, game}
}

const applyToGame = <State, Move>(
  rules: GameRules<State, Move>,
  room: RoomState<State>,
  seat: string,
  intent: Intent<Move>
): State => {
  // A new game starts knowing who is not here
  if (intent.type === 'restart') {
    if (!rules.isOver(room.game)) {
      return room.game
    }

    const {onPresence} = rules
    const fresh = rules.createState()
    return onPresence ? absentSeats(room, room.absent).reduce((state, each) => onPresence(state, each, 'lost'), fresh) : fresh
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
