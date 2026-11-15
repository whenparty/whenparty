export type ModuleMessage = null | boolean | number | string | readonly ModuleMessage[] | {readonly [key: string]: ModuleMessage}

export const moduleMessageBytes = 16_384
export const textBytes = 65_536

const encoder = new TextEncoder()

export const utf8Bytes = (text: string): number => encoder.encode(text).length

const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value)
  return (prototype === Object.prototype || prototype === null) && Object.getOwnPropertySymbols(value).length === 0
}

const isJsonPart = (value: unknown): boolean => {
  switch (typeof value) {
    case 'boolean':
      return true
    case 'number':
      return Number.isFinite(value)
    case 'string':
      return value.isWellFormed()
    case 'object':
      return value === null || Array.isArray(value) || isPlainObject(value)
    default:
      return false
  }
}

class NotJson extends Error {}

const checkPart = function (this: Record<string, unknown>, key: string, value: unknown): unknown {
  if (!key.isWellFormed() || !isJsonPart(this[key]) || value !== this[key]) {
    throw new NotJson()
  }
  return value
}

export const compactJson = (value: unknown): string | null => {
  try {
    return JSON.stringify(value, checkPart) ?? null
  } catch {
    return null
  }
}

export const isTextWithin = (value: unknown, bytes: number): value is string =>
  typeof value === 'string' && value.length <= bytes && value.isWellFormed() && (value.length <= bytes / 3 || utf8Bytes(value) <= bytes)

export const isJsonWithin = (value: unknown, bytes: number): boolean => {
  const json = compactJson(value)
  return json !== null && isTextWithin(json, bytes)
}

export const isModuleMessage = (value: unknown): value is ModuleMessage => isJsonWithin(value, moduleMessageBytes)

export const isText = (value: unknown): value is string => isTextWithin(value, textBytes)

export const randomId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}
