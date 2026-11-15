export interface Clock {
  now(): number
  setTimeout(callback: () => void, milliseconds: number): unknown
  clearTimeout(timer: unknown): void
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, milliseconds) => globalThis.setTimeout(callback, milliseconds),
  clearTimeout: timer => globalThis.clearTimeout(timer as ReturnType<typeof globalThis.setTimeout>)
}
