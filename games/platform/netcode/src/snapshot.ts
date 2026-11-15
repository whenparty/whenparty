import type {Json, MatchId, Snapshot, VersionsOlder} from './api.ts'
import {isRecord, isWhole} from './json.ts'
import {roomTimeMax} from './rules.ts'

export const protocolVersion = 1

export type Versions = readonly [number, number]

const numberMax = 2 ** 53 - 1
const publicMax = 2_147_483_647

export const isPublic = (value: unknown): value is number => isWhole(value, 1, publicMax)
export const isActionNumber = (value: unknown): value is number => isWhole(value, 1, numberMax)

export const versionsOf = (value: unknown): Versions | null => {
  if (!isRecord(value)) {
    return null
  }
  const versions = value.versions
  return Array.isArray(versions) && versions.length === 2 && isWhole(versions[0], 1, 1_000_000) && isWhole(versions[1], 1, 1_000_000)
    ? [versions[0], versions[1]]
    : null
}

export const sameVersions = (a: Versions, b: Versions): boolean => a[0] === b[0] && a[1] === b[1]

export const olderOf = (own: Versions, other: Versions): VersionsOlder =>
  own[0] < other[0] || (own[0] === other[0] && own[1] < other[1]) ? 'page' : 'host'

export const matchOf = (value: unknown): MatchId | null =>
  Array.isArray(value) && value.length === 2 && isPublic(value[0]) && isWhole(value[1], 0, numberMax)
    ? {term: value[0], number: value[1]}
    : null

export const snapshotJson = (snapshot: Snapshot): {readonly [key: string]: Json} => ({
  t: 'snapshot',
  versions: [...snapshot.versions],
  state: snapshot.state,
  running: snapshot.running,
  match: [snapshot.match.term, snapshot.match.number],
  seats: [...snapshot.seats],
  queue: [...snapshot.queue],
  accepted: snapshot.accepted.map(([participant, number]) => [participant, number]),
  time: snapshot.roomTime,
  term: snapshot.term,
  n: snapshot.number
})

const isAccepted = (value: unknown): value is readonly [number, number] =>
  Array.isArray(value) && value.length === 2 && isPublic(value[0]) && isActionNumber(value[1])

export const parseSnapshot = (value: unknown, seatCount: number, isState: (state: Json) => boolean): Snapshot | null => {
  const versions = versionsOf(value)
  if (versions === null || !isRecord(value)) {
    return null
  }
  const {state, running, match, seats, queue, accepted, time, term, n} = value
  const matchId = matchOf(match)
  if (
    matchId === null ||
    typeof running !== 'boolean' ||
    !Array.isArray(seats) ||
    seats.length !== seatCount ||
    !seats.every(seat => seat === null || isPublic(seat)) ||
    !Array.isArray(queue) ||
    !queue.every(isPublic) ||
    !Array.isArray(accepted) ||
    !accepted.every(isAccepted) ||
    !isWhole(time, 0, roomTimeMax) ||
    !isPublic(term) ||
    !isActionNumber(n) ||
    state === undefined ||
    (state !== null && !isState(state as Json))
  ) {
    return null
  }
  return {
    versions,
    state: state as Json,
    running,
    match: matchId,
    seats: seats as readonly (number | null)[],
    queue: queue as readonly number[],
    accepted: accepted as readonly (readonly [number, number])[],
    roomTime: time,
    term,
    number: n
  }
}

export const isNewer = (snapshot: Snapshot, than: Snapshot): boolean =>
  snapshot.term > than.term || (snapshot.term === than.term && snapshot.number > than.number)

export const acceptedOf = (snapshot: Snapshot, participant: number): number =>
  snapshot.accepted.find(([number]) => number === participant)?.[1] ?? 0
