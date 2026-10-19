// The wire format. Peers send JSON strings, and everything received is checked before use,
// because any browser that knows the room code can join and send anything.
import type {GameRules, NumberedIntent, RoomState} from './room-state.ts'

export const encode = (value: unknown): string => JSON.stringify(value)

const parse = (data: unknown): unknown => {
  if (typeof data !== 'string') {
    return null
  }

  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isIntentId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0

const isMembers = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(peerId => typeof peerId === 'string') &&
  new Set(value).size === value.length

// Every seat of the game, each free or held by a member
const isSeats = (value: unknown, seats: readonly string[], members: string[]): value is Record<string, string | null> => {
  if (!isRecord(value) || Object.keys(value).length !== seats.length) {
    return false
  }

  return seats.every(seat => {
    const peerId = value[seat]
    return peerId === null || (typeof peerId === 'string' && members.includes(peerId))
  })
}

const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

const isHandled = (value: unknown): value is Record<string, number> =>
  isRecord(value) && Object.values(value).every(isIntentId)

export const decodeSnapshot = <State, Move>(rules: GameRules<State, Move>, data: unknown): RoomState<State> | null => {
  const value = parse(data)

  if (!isRecord(value) || !isMembers(value.members) || !Number.isSafeInteger(value.term) || Number(value.term) < 0) {
    return null
  }

  const {members, term, seats, game, handled} = value
  // A snapshot from a page loaded before createdAt existed counts as the oldest room
  const createdAt = value.createdAt ?? 0

  if (!isSeats(seats, rules.seats, members) || !rules.isState(game) || !isHandled(handled) || !isTime(createdAt)) {
    return null
  }

  return {members, term: Number(term), createdAt, seats, game, handled}
}

export const decodeIntent = <State, Move>(rules: GameRules<State, Move>, data: unknown): NumberedIntent<Move> | null => {
  const value = parse(data)

  if (!isRecord(value) || !isIntentId(value.id)) {
    return null
  }

  if (value.type === 'restart') {
    return {type: 'restart', id: value.id}
  }

  return value.type === 'move' && rules.isMove(value.move) ? {type: 'move', move: value.move, id: value.id} : null
}
