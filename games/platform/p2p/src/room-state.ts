// Seats and the game as the host keeps them. Every function is pure; session-machine.ts runs them.
export interface RoomContext {
  // Seats with a player in them. During left, the departing seat still counts.
  occupiedSeats: readonly string[]
  // Occupied seats whose player is reserved: its connection dropped, or its page is hidden
  absentSeats: readonly string[]
  // Room time: milliseconds since the room was created, the same on every device
  now: number
}

export interface GameRules<State, Move> {
  seats: readonly string[]
  createState: () => State
  applyMove: (state: State, seat: string, move: Move, context: RoomContext) => State | null
  isOver: (state: State) => boolean
  isMove: (value: unknown) => value is Move
  isState: (value: unknown) => value is State
  onPresence?: (state: State, seat: string, presence: SeatPresence, context: RoomContext) => State
  // Deadlines the game waits for, by key, in room time. The host calls onDeadline for each one that
  // is due; the game then clears or moves it, or it fires again.
  deadlinesOf?: (state: State) => Record<string, number>
  onDeadline?: (state: State, key: string, context: RoomContext) => State
}

export type SeatPresence = 'lost' | 'back' | 'left'

export interface Member {
  playerId: string
  peerId: string
}

export interface RoomState<State> {
  hostId: string
  members: Member[]
  term: number
  seats: Record<string, string | null>
  game: State
  handled: Record<string, number>
  clock: number
  // Player → room time at which its hold on its place and seat ends
  reservations: Record<string, number>
}

export interface MoveIntent<Move> {
  type: 'move'
  move: Move
}

export interface RestartIntent {
  type: 'restart'
}

export type Intent<Move> = MoveIntent<Move> | RestartIntent

export type NumberedIntent<Move> = Intent<Move> & {id: number}

export const createRoomState = <State, Move>(rules: GameRules<State, Move>, host: Member): RoomState<State> => ({
  hostId: host.playerId,
  members: [host],
  term: 0,
  seats: Object.fromEntries(rules.seats.map((seat, index) => [seat, index === 0 ? host.playerId : null])),
  game: rules.createState(),
  handled: {},
  clock: 0,
  reservations: {}
})

export const hostOf = (room: RoomState<unknown>): Member | null => room.members.find(member => member.playerId === room.hostId) ?? null

export const memberByPeer = (room: RoomState<unknown>, peerId: string): Member | null =>
  room.members.find(member => member.peerId === peerId) ?? null

export const memberByPlayer = (room: RoomState<unknown>, playerId: string): Member | null =>
  room.members.find(member => member.playerId === playerId) ?? null

export const seatOf = (room: RoomState<unknown>, playerId: string): string | null =>
  Object.keys(room.seats).find(seat => room.seats[seat] === playerId) ?? null

export const isFull = (room: RoomState<unknown>): boolean => Object.values(room.seats).every(playerId => playerId !== null)

export const isAbsent = (room: RoomState<unknown>, playerId: string): boolean => room.reservations[playerId] !== undefined

const occupiedSeatsOf = (room: RoomState<unknown>): string[] => Object.keys(room.seats).filter(seat => room.seats[seat] !== null)

const absentSeatsOf = (room: RoomState<unknown>): string[] =>
  Object.keys(room.seats).filter(seat => {
    const playerId = room.seats[seat]
    return playerId !== null && playerId !== undefined && isAbsent(room, playerId)
  })

export const contextOf = (room: RoomState<unknown>, now = room.clock): RoomContext => ({
  occupiedSeats: occupiedSeatsOf(room),
  absentSeats: absentSeatsOf(room),
  now
})

const without = <T>(record: Record<string, T>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([id]) => id !== key))

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
  playerId: string,
  now = room.clock
): RoomState<State> => {
  if (!memberByPlayer(room, playerId)) {
    return room
  }

  const members = room.members.filter(member => member.playerId !== playerId)
  const handled = without(room.handled, playerId)
  const reservations = without(room.reservations, playerId)
  const seat = seatOf(room, playerId)

  if (!seat) {
    return {...room, members, handled, reservations}
  }

  const game = rules.onPresence ? rules.onPresence(room.game, seat, 'left', contextOf(room, now)) : room.game

  return fillSeats({...room, members, handled, reservations, game, seats: {...room.seats, [seat]: null}})
}

// The game hears of every seat whose player became absent or present between two rooms
export const syncPresence = <State, Move>(
  rules: GameRules<State, Move>,
  previous: RoomState<State>,
  next: RoomState<State>,
  now = next.clock
): RoomState<State> => {
  const {onPresence} = rules

  if (!onPresence) {
    return next
  }

  const before = new Set(absentSeatsOf(previous))
  const after = new Set(absentSeatsOf(next))
  const context = contextOf(next, now)
  const game = Object.keys(next.seats)
    .filter(seat => before.has(seat) !== after.has(seat))
    .reduce((state, seat) => onPresence(state, seat, after.has(seat) ? 'lost' : 'back', context), next.game)

  return game === next.game ? next : {...next, game}
}

export const applyDeadlines = <State, Move>(rules: GameRules<State, Move>, room: RoomState<State>, now = room.clock): RoomState<State> => {
  const {deadlinesOf, onDeadline} = rules

  if (!deadlinesOf || !onDeadline) {
    return room
  }

  const due = Object.entries(deadlinesOf(room.game)).filter(([, at]) => at <= now)

  if (due.length === 0) {
    return room
  }

  const context = contextOf(room, now)

  return {...room, game: due.reduce((state, [key]) => onDeadline(state, key, context), room.game)}
}

const applyToGame = <State, Move>(
  rules: GameRules<State, Move>,
  room: RoomState<State>,
  seat: string,
  intent: Intent<Move>,
  now: number
): State => {
  const context = contextOf(room, now)

  if (intent.type === 'restart') {
    if (!rules.isOver(room.game)) {
      return room.game
    }

    const {onPresence} = rules
    const fresh = rules.createState()
    return onPresence ? context.absentSeats.reduce((state, each) => onPresence(state, each, 'lost', context), fresh) : fresh
  }

  return rules.applyMove(room.game, seat, intent.move, context) ?? room.game
}

export const applyIntent = <State, Move>(
  rules: GameRules<State, Move>,
  room: RoomState<State>,
  playerId: string,
  intent: NumberedIntent<Move>,
  now = room.clock
): RoomState<State> => {
  if (!memberByPlayer(room, playerId) || intent.id <= (room.handled[playerId] ?? 0)) {
    return room
  }

  const handled = {...room.handled, [playerId]: intent.id}
  const seat = seatOf(room, playerId)

  // A rematch needs every seat taken: the platform's one rule about the game, until a game needs otherwise
  if (!seat || (intent.type === 'restart' && !isFull(room))) {
    return {...room, handled}
  }

  return {...room, handled, game: applyToGame(rules, room, seat, intent, now)}
}
