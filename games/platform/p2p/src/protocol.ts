// The wire format. Peers send JSON strings, and everything received is checked before use,
// because any browser that knows the room code can join and send anything.
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isIntentId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0

const isMember = (value: unknown): value is Member =>
  isRecord(value) && typeof value.playerId === 'string' && typeof value.peerId === 'string'

// Every player once, and every connection once
const isMembers = (value: unknown): value is Member[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(isMember) &&
  new Set(value.map(member => member.playerId)).size === value.length &&
  new Set(value.map(member => member.peerId)).size === value.length

// Every seat of the game, each free or held by a member
const isSeats = (value: unknown, seats: readonly string[], members: Member[]): value is Record<string, string | null> => {
  if (!isRecord(value) || Object.keys(value).length !== seats.length) {
    return false
  }

  return seats.every(seat => {
    const playerId = value[seat]
    return playerId === null || members.some(member => member.playerId === playerId)
  })
}

const isHandled = (value: unknown): value is Record<string, number> =>
  isRecord(value) && Object.values(value).every(isIntentId)

export const decodeSnapshot = <State, Move>(rules: GameRules<State, Move>, data: unknown): RoomState<State> | null => {
  const value = parse(data)

  if (!isRecord(value) || !isMembers(value.members) || !Number.isSafeInteger(value.term) || Number(value.term) < 0) {
    return null
  }

  const {members, term, provisional, seats, game, handled} = value

  if (typeof provisional !== 'boolean' || !isSeats(seats, rules.seats, members) || !rules.isState(game) || !isHandled(handled)) {
    return null
  }

  return {members, term: Number(term), provisional, seats, game, handled}
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

// What a connection says about itself: whose it is, and whether its page is hidden
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
