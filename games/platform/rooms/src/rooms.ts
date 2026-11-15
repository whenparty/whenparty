import type {Failure, Json, Room, RoomHandlers, Rooms} from './api.ts'
import {browserEnvironment, type Lock, type RoomsEnvironment} from './environment.ts'
import type {SignalingLink} from './link.ts'
import {OwnerSession} from './owner.ts'
import {ParticipantSession} from './participant.ts'
import {isAppId, isJoinData, parseCode} from './protocol.ts'
import {deleteRecord, readRecord, recordKey, type RoomRecord} from './record.ts'
import {hold, isJson, release, RoomsPage, tell, type Session, type SessionContext} from './session.ts'

type Plan =
  | {readonly kind: 'create'; readonly waitingSeconds: number | null}
  | {readonly kind: 'join'; readonly codeText: string; readonly joinData: unknown}
  | {readonly kind: 'return'}

class RoomHandle implements Room {
  readonly #ctx: SessionContext
  readonly #plan: Plan
  #session: Session | null = null
  #leaving: SignalingLink | null = null

  constructor(page: RoomsPage, appId: string, handlers: RoomHandlers, plan: Plan) {
    this.#ctx = {page, appId, handlers, data: null, lock: null, done: false}
    this.#plan = plan
    page.busy.add(appId)
    void page.env.takeLock(recordKey(appId)).then(lock => this.#locked(lock))
  }

  #fail(failure: Failure): void {
    tell(this.#ctx, 'failed', failure)
    this.#leaving?.close()
    release(this.#ctx)
  }

  #locked(lock: Lock | null): void {
    const ctx = this.#ctx
    if (ctx.done) {
      lock?.release()
      return
    }
    if (lock === null) {
      return this.#fail({reason: 'open elsewhere'})
    }
    hold(ctx, lock)
    ctx.page.timers.check()
    const plan = this.#plan
    const record = readRecord(ctx.page.env.storage, ctx.appId)
    if (plan.kind === 'create') {
      return record === null ? this.#start(null) : this.#leaveRecord(record)
    }
    if (plan.kind === 'return') {
      return record === null ? this.#fail({reason: 'no room'}) : this.#returnTo(record, false)
    }
    if (!isAppId(ctx.appId)) {
      return this.#fail({reason: 'bad app'})
    }
    const code = parseCode(plan.codeText)
    if (code === null) {
      return this.#fail({reason: 'no room'})
    }
    if (record === null) {
      return this.#start(null, code)
    }
    return record.code === code ? this.#returnTo(record, true) : this.#leaveRecord(record, code)
  }

  #returnTo(record: RoomRecord, fromRecordCode: boolean): void {
    const ctx = this.#ctx
    tell(ctx, 'returning', record.role, record.number, record.data)
    if (ctx.done) {
      return
    }
    if (record.data !== undefined && ctx.data === null) {
      ctx.data = {value: record.data}
    }
    const joinData = this.#plan.kind === 'join' ? this.#plan.joinData : null
    this.#session =
      record.role === 'owner' ? OwnerSession.returnFrom(ctx, record) : ParticipantSession.returnFrom(ctx, record, joinData, fromRecordCode)
  }

  #leaveRecord(record: RoomRecord, code?: string): void {
    const ctx = this.#ctx
    const link = ctx.page.openLink({
      opened: () => {
        if (this.#leaving !== link || ctx.done) {
          return
        }
        link.send({t: 'leave', app: ctx.appId, code: record.code, token: record.token})
        deleteRecord(ctx.page.env.storage, ctx.appId)
        this.#leaving = null
        this.#start(link, code)
      },
      notice: () => {},
      ended: end => {
        if (this.#leaving === link) {
          this.#leaving = null
          this.#fail(end.kind === 'outdated' ? {reason: 'outdated', older: end.older} : {reason: 'offline'})
        }
      }
    })
    this.#leaving = link
  }

  #start(link: SignalingLink | null, code?: string): void {
    const plan = this.#plan
    if (plan.kind === 'create') {
      this.#session = OwnerSession.create(this.#ctx, plan.waitingSeconds, link)
    } else if (plan.kind === 'join' && code !== undefined) {
      this.#session = ParticipantSession.join(this.#ctx, code, plan.joinData, link)
    }
  }

  send(text: unknown): boolean {
    return this.#session?.send(text) ?? false
  }

  sendTo(number: number, text: unknown): boolean {
    return this.#session?.sendTo(number, text) ?? false
  }

  setRecordData(data: unknown): boolean {
    if (this.#session !== null) {
      return this.#session.setRecordData(data)
    }
    if (this.#ctx.done || !isJson(data)) {
      return false
    }
    this.#ctx.data = {value: data as Json}
    return true
  }

  leave(): void {
    if (this.#session !== null) {
      this.#session.leave()
      return
    }
    if (!this.#ctx.done) {
      this.#leaving?.close()
      this.#leaving = null
      release(this.#ctx)
    }
  }
}

const environmentKeys = [
  'transport',
  'clock',
  'storage',
  'takeLock',
  'visibility',
  'onVisibilityChange',
  'onPageHide',
  'onPageShow',
  'reload'
] as const

const isComplete = (environment: Partial<RoomsEnvironment>): environment is RoomsEnvironment =>
  environmentKeys.every(key => key in environment)

export const createRooms = (environment: Partial<RoomsEnvironment> = {}): Rooms => {
  const env = isComplete(environment) ? environment : {...browserEnvironment(), ...environment}
  const page = new RoomsPage(env)
  const start = (appId: string, handlers: RoomHandlers, plan: Plan): Room | null => {
    if (page.busy.has(appId)) {
      return null
    }
    return new RoomHandle(page, appId, handlers, plan)
  }
  return {
    parseCode,
    create: (appId, waitingSeconds, handlers) => start(appId, handlers, {kind: 'create', waitingSeconds}),
    join: (appId, codeText, joinData, handlers) =>
      isJoinData(joinData) ? start(appId, handlers, {kind: 'join', codeText, joinData}) : null,
    return: (appId, handlers) => start(appId, handlers, {kind: 'return'})
  }
}
