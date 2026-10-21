// The wire format. Anyone with the room code can send anything, so every message is checked before use.
import type {GameRules, Member, NumberedIntent, RoomState} from './room-state.ts'

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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const isIntentId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0

const isMember = (value: unknown): value is Member =>
  isRecord(value) && typeof value.playerId === 'string' && typeof value.peerId === 'string'

const isMembers = (value: unknown): value is Member[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(isMember) &&
  new Set(value.map(member => member.playerId)).size === value.length &&
  new Set(value.map(member => member.peerId)).size === value.length

const isSeats = (value: unknown, seats: readonly string[], members: Member[]): value is Record<string, string | null> => {
  if (!isRecord(value) || Object.keys(value).length !== seats.length) {
    return false
  }

  return seats.every(seat => {
    const playerId = value[seat]
    return playerId === null || members.some(member => member.playerId === playerId)
  })
}

const isHandled = (value: unknown): value is Record<string, number> => isRecord(value) && Object.values(value).every(isIntentId)

const isRoomTime = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0

const isReservations = (value: unknown, members: Member[]): value is Record<string, number> =>
  isRecord(value) &&
  Object.entries(value).every(([playerId, until]) => members.some(member => member.playerId === playerId) && isRoomTime(until))

export const decodeSnapshot = <State, Move>(rules: GameRules<State, Move>, data: unknown): RoomState<State> | null => {
  const value = parse(data)

  if (!isRecord(value) || !isMembers(value.members) || !Number.isSafeInteger(value.term) || Number(value.term) < 0) {
    return null
  }

  const {hostId, members, term, seats, game, handled, clock, reservations} = value

  if (
    typeof hostId !== 'string' ||
    !members.some(member => member.playerId === hostId) ||
    !isSeats(seats, rules.seats, members) ||
    !rules.isState(game) ||
    !isHandled(handled) ||
    !isRoomTime(clock) ||
    !isReservations(reservations, members)
  ) {
    return null
  }

  return {hostId, members, term: Number(term), seats, game, handled, clock, reservations}
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

export interface Presence {
  playerId: string
  away: boolean
}

export const decodePresence = (data: unknown): Presence | null => {
  const value = parse(data)

  if (!isRecord(value) || typeof value.playerId !== 'string' || typeof value.away !== 'boolean') {
    return null
  }

  return {playerId: value.playerId, away: value.away}
}
