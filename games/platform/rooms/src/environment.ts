import {createTransport, systemClock, type Clock, type Transport} from '@whenparty/transport'
import type {Visibility} from './api.ts'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface Lock {
  release(): void
}

export interface RoomsEnvironment {
  readonly transport: Transport
  readonly clock: Clock
  readonly storage: StorageLike | null
  takeLock(name: string): Promise<Lock | null>
  visibility(): Visibility
  onVisibilityChange(listener: () => void): void
  onPageHide(listener: (persisted: boolean) => void): void
  onPageShow(listener: (persisted: boolean) => void): void
  reload(): void
}

const browserStorage = (): StorageLike | null => {
  try {
    return localStorage
  } catch {
    return null
  }
}

const ownReleases = new Map<string, Promise<unknown>>()

const takeBrowserLock = async (name: string): Promise<Lock | null> => {
  await ownReleases.get(name)
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.locks) {
      resolve(null)
      return
    }
    const held = navigator.locks
      .request(name, {ifAvailable: true}, lock => {
        if (lock === null) {
          resolve(null)
          return undefined
        }
        return new Promise<void>(release =>
          resolve({
            release: () => {
              ownReleases.set(name, held)
              release()
            }
          })
        )
      })
      .catch(() => resolve(null))
      .finally(() => {
        if (ownReleases.get(name) === held) {
          ownReleases.delete(name)
        }
      })
  })
}

export const browserEnvironment = (): RoomsEnvironment => ({
  transport: createTransport(),
  clock: systemClock,
  storage: browserStorage(),
  takeLock: takeBrowserLock,
  visibility: () => (document.visibilityState === 'visible' ? 'visible' : 'hidden'),
  onVisibilityChange: listener => document.addEventListener('visibilitychange', listener),
  onPageHide: listener => addEventListener('pagehide', event => listener(event.persisted)),
  onPageShow: listener => addEventListener('pageshow', event => listener(event.persisted)),
  reload: () => location.reload()
})
