import type {Json} from './api.ts'

export const valueBytes = 61_440

const encoder = new TextEncoder()

export const utf8Bytes = (text: string): number => encoder.encode(text).length

export interface ReadBack {
  readonly value: Json
  readonly json: string
}

export const readBack = (value: unknown): ReadBack | null => {
  try {
    const json = JSON.stringify(value)
    return json === undefined ? null : {value: JSON.parse(json) as Json, json}
  } catch {
    return null
  }
}

export const copy = <T extends Json>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export const isWithin = (json: string, bytes: number): boolean =>
  json.length <= bytes / 3 || (json.length <= bytes && utf8Bytes(json) <= bytes)

export const isRecord = (value: unknown): value is {readonly [key: string]: unknown} =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isWhole = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max
