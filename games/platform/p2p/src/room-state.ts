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

export interface RoomState<State> {
  // Peer IDs in join order, spectators too. The first one is the host, and the next one still
  // here takes over when the host leaves (see succession.ts).
  members: string[]
  // Goes up by one each time a new host takes over, so peers can tell a stale host from the current one
  term: number
  // The room stands in for one that may exist under the same code: it was started under a code
  // someone else gave out, or hosted again by a member that found itself alone. It stays so through
  // every handover, and gives way to a room that is not when the two meet (see succession.ts).
  provisional: boolean
  // Seat → peer ID of the player in it, or null while it is free
  seats: Record<string, string | null>
  game: State
  // Member → ID of the last intent the host handled from it, so a resent intent is applied once
  handled: Record<string, number>
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
  hostId: string,
  provisional = false
): RoomState<State> => ({
  members: [hostId],
  term: 0,
  provisional,
  seats: Object.fromEntries(rules.seats.map((seat, index) => [seat, index === 0 ? hostId : null])),
  game: rules.createState(),
  handled: {}
})

export const seatOf = (room: RoomState<unknown>, peerId: string): string | null =>
  Object.keys(room.seats).find(seat => room.seats[seat] === peerId) ?? null

export const isFull = (room: RoomState<unknown>): boolean => Object.values(room.seats).every(peerId => peerId !== null)

const withSeat = <State>(room: RoomState<State>, seat: string, peerId: string | null): RoomState<State> => ({
  ...room,
  seats: {...room.seats, [seat]: peerId}
})

// Free seats go to the members without one, in join order. Returns the same room when there is
// nothing to fill.
const fillSeats = <State>(room: RoomState<State>): RoomState<State> => {
  const seated = new Set(Object.values(room.seats))
  const waiting = room.members.filter(peerId => !seated.has(peerId))
  const free = Object.keys(room.seats).filter(seat => room.seats[seat] === null)

  if (waiting.length === 0 || free.length === 0) {
    return room
  }

  const seats = {...room.seats}
  free.forEach((seat, index) => (seats[seat] = waiting[index] ?? null))

  return {...room, seats}
}

// A joining peer becomes the last member and takes a free seat, with the game as it is.
// Without a free seat, it watches until one frees up.
export const addPeer = <State>(room: RoomState<State>, peerId: string): RoomState<State> => {
  if (room.members.includes(peerId)) {
    return room
  }

  return fillSeats({...room, members: [...room.members, peerId]})
}

export const removePeer = <State, Move>(
  rules: GameRules<State, Move>,
  room: RoomState<State>,
  peerId: string
): RoomState<State> => {
  if (!room.members.includes(peerId)) {
    return room
  }

  const members = room.members.filter(id => id !== peerId)
  const handled = Object.fromEntries(Object.entries(room.handled).filter(([id]) => id !== peerId))
  const seat = seatOf(room, peerId)

  if (!seat) {
    return {...room, members, handled}
  }

  // The game sees the seat left before it goes to someone else
  const game = rules.onSeatLeft ? rules.onSeatLeft(room.game, seat) : room.game

  return fillSeats({...withSeat(room, seat, null), members, handled, game})
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

// Each intent of a member is handled once: it counts as handled even when the rules reject it.
// Returns the same room object for an intent that was handled already or comes from a stranger.
export const applyIntent = <State, Move>(
  rules: GameRules<State, Move>,
  room: RoomState<State>,
  peerId: string,
  intent: NumberedIntent<Move>
): RoomState<State> => {
  if (!room.members.includes(peerId) || intent.id <= (room.handled[peerId] ?? 0)) {
    return room
  }

  const handled = {...room.handled, [peerId]: intent.id}
  const seat = seatOf(room, peerId)

  if (!seat || !isFull(room)) {
    return {...room, handled}
  }

  return {...room, handled, game: applyToGame(rules, room, seat, intent)}
}
