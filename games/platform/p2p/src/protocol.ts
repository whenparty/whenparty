// The wire format. Peers send JSON strings, and everything received is checked before use,
// because any browser that knows the room code can join and send anything.
import type {GameRules, Intent, RoomState} from './room-state.ts'

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

const hasSeats = (value: unknown, seats: readonly string[]): value is Record<string, string | null> => {
  if (!isRecord(value) || Object.keys(value).length !== seats.length) {
    return false
  }

  return seats.every(seat => value[seat] === null || typeof value[seat] === 'string')
}

export const decodeSnapshot = <State, Move>(rules: GameRules<State, Move>, data: unknown): RoomState<State> | null => {
  const value = parse(data)

  if (!isRecord(value) || !hasSeats(value.seats, rules.seats) || !rules.isState(value.game)) {
    return null
  }

  return {seats: value.seats, game: value.game}
}

export const decodeIntent = <State, Move>(rules: GameRules<State, Move>, data: unknown): Intent<Move> | null => {
  const value = parse(data)

  if (!isRecord(value)) {
    return null
  }

  if (value.type === 'restart') {
    return {type: 'restart'}
  }

  return value.type === 'move' && rules.isMove(value.move) ? {type: 'move', move: value.move} : null
}
