import {isJsonWithin, isTextWithin} from '@whenparty/transport'
import type {Ending, Failure, Json, Room, RoomHandlers} from './api.ts'
import type {Lock, RoomsEnvironment} from './environment.ts'
import {SignalingLink, type LinkEvents} from './link.ts'
import {deleteRecord, writeRecord, type RoomRecord} from './record.ts'
import {callSafely, Timers} from './timers.ts'

export const roomTextBytes = 65_024

export const isRoomText = (value: unknown): value is string => isTextWithin(value, roomTextBytes)

export const isJson = (value: unknown): boolean => isJsonWithin(value, Number.POSITIVE_INFINITY)

export class RoomsPage {
  readonly env: RoomsEnvironment
  readonly timers: Timers
  readonly pageId: string
  readonly startedAt: number
  readonly busy = new Set<string>()
  readonly visibilityListeners = new Set<() => void>()
  readonly holders = new Set<SessionContext>()

  constructor(env: RoomsEnvironment) {
    this.env = env
    this.timers = new Timers(env.clock)
    this.startedAt = env.clock.now()
    this.pageId = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
    env.onVisibilityChange(this.timers.entered(() => [...this.visibilityListeners].forEach(listener => listener())))
    env.onPageHide(persisted => {
      if (persisted) {
        for (const ctx of this.holders) {
          ctx.lock?.release()
          ctx.lock = null
        }
      }
    })
    env.onPageShow(persisted => {
      if (persisted) {
        env.reload()
      }
    })
  }

  openLink(events: LinkEvents): SignalingLink {
    return new SignalingLink(this.env.transport, this.timers, events)
  }
}

export interface SessionContext {
  readonly page: RoomsPage
  readonly appId: string
  readonly handlers: RoomHandlers
  data: {readonly value: Json} | null
  lock: Lock | null
  done: boolean
}

type Handler<K extends keyof RoomHandlers> = NonNullable<RoomHandlers[K]>

export const tell = <K extends keyof RoomHandlers>(ctx: SessionContext, name: K, ...args: Parameters<Handler<K>>): void => {
  if (!ctx.done) {
    callSafely(ctx.handlers[name] as ((...values: Parameters<Handler<K>>) => unknown) | undefined, ...args)
  }
}

export const hold = (ctx: SessionContext, lock: Lock): void => {
  ctx.lock = lock
  ctx.page.holders.add(ctx)
}

export const release = (ctx: SessionContext): void => {
  ctx.done = true
  ctx.lock?.release()
  ctx.lock = null
  ctx.page.busy.delete(ctx.appId)
  ctx.page.holders.delete(ctx)
}

export abstract class Session implements Room {
  readonly ctx: SessionContext
  written = false
  readonly #onVisibility = (): void => this.visibilityChanged()

  constructor(ctx: SessionContext) {
    this.ctx = ctx
    ctx.page.visibilityListeners.add(this.#onVisibility)
  }

  get page(): RoomsPage {
    return this.ctx.page
  }

  get timers(): Timers {
    return this.ctx.page.timers
  }

  get done(): boolean {
    return this.ctx.done
  }

  now(): number {
    return this.ctx.page.timers.now()
  }

  tell<K extends keyof RoomHandlers>(name: K, ...args: Parameters<Handler<K>>): void {
    tell(this.ctx, name, ...args)
  }

  abstract record(): RoomRecord

  abstract closeConnections(): void

  abstract send(text: unknown): boolean

  abstract sendTo(number: number, text: unknown): boolean

  abstract leave(): void

  protected visibilityChanged(): void {}

  dataPart(): {readonly data?: Json} {
    return this.ctx.data === null ? {} : {data: this.ctx.data.value}
  }

  persist(): void {
    if (this.written && !this.done) {
      writeRecord(this.page.env.storage, this.ctx.appId, this.record())
    }
  }

  firstWrite(): void {
    this.written = true
    this.persist()
  }

  setRecordData(data: unknown): boolean {
    if (this.done || !isJson(data)) {
      return false
    }
    this.ctx.data = {value: data as Json}
    this.persist()
    return true
  }

  #finish(): void {
    this.ctx.page.visibilityListeners.delete(this.#onVisibility)
    this.closeConnections()
    release(this.ctx)
  }

  fail(failure: Failure): void {
    if (this.done) {
      return
    }
    this.tell('failed', failure)
    this.#finish()
  }

  end(ending: Ending): void {
    if (this.done) {
      return
    }
    this.tell('ended', ending)
    deleteRecord(this.page.env.storage, this.ctx.appId)
    this.#finish()
  }

  quit(deleting: boolean): void {
    if (this.done) {
      return
    }
    if (deleting) {
      deleteRecord(this.page.env.storage, this.ctx.appId)
    }
    this.#finish()
  }
}
