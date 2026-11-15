import type {Json} from './api.ts'
import type {StorageLike} from './environment.ts'
import {isCode, isNumber, isWaitingSeconds} from './protocol.ts'

export interface NumberRecord {
  readonly n: number
  readonly joined: boolean
  readonly lostSince: number | null
}

interface Common {
  readonly code: string
  readonly token: string
  readonly number: number
  readonly wait: number
  readonly data?: Json
}

export interface ParticipantRecord extends Common {
  readonly role: 'participant'
  readonly ownerLostSince: number | null
}

export interface OwnerRecord extends Common {
  readonly role: 'owner'
  readonly term: number
  readonly serverLostSince: number | null
  readonly numbers: readonly NumberRecord[]
  readonly leaves: readonly number[]
}

export type RoomRecord = ParticipantRecord | OwnerRecord

export const recordKey = (appId: string): string => `whenparty:rooms:${appId}`

const isMoment = (value: unknown): value is number | null => value === null || Number.isFinite(value)

const isNumberRecord = (value: unknown): value is NumberRecord => {
  const entry = value as Partial<NumberRecord> | null
  return typeof entry === 'object' && entry !== null && isNumber(entry.n) && typeof entry.joined === 'boolean' && isMoment(entry.lostSince)
}

const isRoomRecord = (value: unknown): value is RoomRecord => {
  const record = value as Partial<OwnerRecord> & Partial<ParticipantRecord>
  if (typeof record !== 'object' || record === null) {
    return false
  }
  const common =
    isCode(record.code) &&
    typeof record.token === 'string' &&
    isNumber(record.number) &&
    isWaitingSeconds(record.wait) &&
    record.wait !== null
  if (!common) {
    return false
  }
  if (record.role === 'participant') {
    return isMoment(record.ownerLostSince)
  }
  return (
    record.role === 'owner' &&
    isNumber(record.term) &&
    isMoment(record.serverLostSince) &&
    Array.isArray(record.numbers) &&
    record.numbers.every(isNumberRecord) &&
    Array.isArray(record.leaves) &&
    record.leaves.every(isNumber)
  )
}

export const readRecord = (storage: StorageLike | null, appId: string): RoomRecord | null => {
  try {
    const text = storage?.getItem(recordKey(appId))
    const value: unknown = typeof text === 'string' ? JSON.parse(text) : null
    return isRoomRecord(value) ? value : null
  } catch {
    return null
  }
}

export const writeRecord = (storage: StorageLike | null, appId: string, record: RoomRecord): boolean => {
  try {
    if (!storage) {
      return false
    }
    storage.setItem(recordKey(appId), JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

export const deleteRecord = (storage: StorageLike | null, appId: string): void => {
  try {
    storage?.removeItem(recordKey(appId))
  } catch {
    return
  }
}
