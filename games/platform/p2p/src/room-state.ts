// The host's view of a room: who sits in which seat, and the game itself. Every function
// here is pure. The host runs each event through them and broadcasts the result.

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
}

export interface RoomState<State> {
  // Seat → peer ID of the player in it, or null while it is free
  seats: Record<string, string | null>
  game: State
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

export const createRoomState = <State, Move>(rules: GameRules<State, Move>, hostId: string): RoomState<State> => ({
  seats: Object.fromEntries(rules.seats.map((seat, index) => [seat, index === 0 ? hostId : null])),
  game: rules.createState()
})

export const seatOf = (room: RoomState<unknown>, peerId: string): string | null =>
  Object.keys(room.seats).find(seat => room.seats[seat] === peerId) ?? null

const withSeat = <State>(room: RoomState<State>, seat: string, peerId: string | null): RoomState<State> => ({
  ...room,
  seats: {...room.seats, [seat]: peerId}
})

// A joining peer takes the first free seat, with the game as it is. Without one, it watches.
export const addPeer = <State>(room: RoomState<State>, peerId: string): RoomState<State> => {
  const freeSeat = Object.keys(room.seats).find(seat => room.seats[seat] === null)

  if (!freeSeat || seatOf(room, peerId)) {
    return room
  }

  return withSeat(room, freeSeat, peerId)
}

export const removePeer = <State>(room: RoomState<State>, peerId: string): RoomState<State> => {
  const seat = seatOf(room, peerId)

  return seat ? withSeat(room, seat, null) : room
}

export const isFull = (room: RoomState<unknown>): boolean => Object.values(room.seats).every(peerId => peerId !== null)

// Returns the same room object when the intent is rejected, so callers can skip the broadcast
export const applyIntent = <State, Move>(
  rules: GameRules<State, Move>,
  room: RoomState<State>,
  peerId: string,
  intent: Intent<Move>
): RoomState<State> => {
  const seat = seatOf(room, peerId)

  if (!seat || !isFull(room)) {
    return room
  }

  if (intent.type === 'restart') {
    return rules.isOver(room.game) ? {...room, game: rules.createState()} : room
  }

  const game = rules.applyMove(room.game, seat, intent.move)

  return game ? {...room, game} : room
}
