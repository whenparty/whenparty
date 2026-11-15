import {createRooms} from '@whenparty/rooms'
import type {Environment, Visibility} from './api.ts'

const documentVisibility: Visibility = {
  get hidden() {
    return document.visibilityState === 'hidden'
  },
  onChange: listener => document.addEventListener('visibilitychange', listener)
}

export const browserEnvironment = (): Environment => ({
  rooms: createRooms(),
  clock: {
    now: () => Date.now(),
    setTimeout: (callback, milliseconds) => globalThis.setTimeout(callback, milliseconds),
    clearTimeout: timer => globalThis.clearTimeout(timer as ReturnType<typeof globalThis.setTimeout>)
  },
  visibility: documentVisibility,
  random: () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0
})
