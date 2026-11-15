import {isJsonWithin} from '@whenparty/transport'

export const roomsModule = 'rooms'
export const roomsVersion = 1

export const codeAlphabet = '23456789BCDFGHJKMNPQRSTVWXYZ'
export const codeLength = 5
export const largestNumber = 2_147_483_647
export const defaultWaitingSeconds = 600
export const joinDataBytes = 1_024

const appIdPattern = /^[a-z0-9./-]{1,64}$/
const codePattern = new RegExp(`^[${codeAlphabet}]{${codeLength}}$`)

export const isAppId = (value: unknown): value is string => typeof value === 'string' && appIdPattern.test(value)

export const isCode = (value: unknown): value is string => typeof value === 'string' && codePattern.test(value)

export const isNumber = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= largestNumber

export const isWaitingSeconds = (value: unknown): value is number | null =>
  value === null || (Number.isInteger(value) && (value as number) >= 60 && (value as number) <= 86_400)

export const isJoinData = (value: unknown): boolean => isJsonWithin(value, joinDataBytes)

export const parseCode = (text: string): string | null => {
  if (typeof text !== 'string') {
    return null
  }
  const code = text.replace(/[\p{White_Space}-]/gu, '').replace(/[a-z]/g, letter => letter.toUpperCase())
  return isCode(code) ? code : null
}

export type SimpleAnswer = 'bad app' | 'bad wait' | 'busy' | 'no room' | 'owner away' | 'full' | 'removed'

export type ServerAnswer =
  | {readonly t: 'answer'; readonly r: number; readonly a: SimpleAnswer}
  | {readonly t: 'created'; readonly r: number; readonly code: string; readonly term: number; readonly token: string}
  | {readonly t: 'asked'; readonly r: number}
  | {readonly t: 'let in'; readonly r: number; readonly token: string; readonly n: number; readonly wait: number; readonly owner: string}
  | {readonly t: 'refused'; readonly r: number; readonly data?: unknown}
  | {readonly t: 'owner'; readonly r: number; readonly peer: string}
  | {readonly t: 'term'; readonly r: number; readonly term: number}
  | {readonly t: 'roster'; readonly r: number; readonly term?: number; readonly roster: readonly number[]}

export type OwnerNotice =
  | {readonly t: 'ask'; readonly app: string; readonly code: string; readonly n: number; readonly data: unknown}
  | {readonly t: 'ended'; readonly app: string; readonly code: string; readonly n: number}
  | {readonly t: 'named'; readonly app: string; readonly code: string; readonly n: number; readonly peer: string}
  | {readonly t: 'left'; readonly app: string; readonly code: string; readonly n: number}
  | {readonly t: 'closed'; readonly app: string; readonly code: string}

export type ServerMessage = ServerAnswer | OwnerNotice
