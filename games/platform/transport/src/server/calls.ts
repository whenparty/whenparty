import type {Clock} from '../clock.ts'
import type {Candidate, Description, Rejection, ServerMessage} from '../protocol.ts'
import {utf8Bytes} from '../values.ts'

const signalBytes = 16_384
const candidatesPerPage = 32
const attemptMs = 15_000
const callsPerCallee = 12
const callsPerPair = 2
const callsPerCaller = 64

export interface Party {
  readonly peerId: string | null
  readonly list: ReadonlySet<string>
}

export interface Hub<P extends Party> {
  readonly clock: Clock
  openParty(peerId: string): P | undefined
  post(party: P, message: ServerMessage): void
}

interface Usage {
  described: boolean
  candidates: number
  bytes: number
}

interface CallRecord<P> {
  readonly caller: P
  readonly callee: P
  readonly usage: Map<P, Usage>
  readonly timer: unknown
}

type Fields = {readonly [key: string]: unknown}

const isRecordOf = (value: unknown): value is Fields => typeof value === 'object' && value !== null && !Array.isArray(value)

export const isDescription = (value: unknown): value is Description =>
  isRecordOf(value) && (value.type === 'offer' || value.type === 'answer') && typeof value.sdp === 'string'

const isCandidate = (value: unknown): value is Candidate =>
  isRecordOf(value) &&
  typeof value.candidate === 'string' &&
  (value.sdpMid === null || typeof value.sdpMid === 'string') &&
  (value.sdpMLineIndex === null || Number.isInteger(value.sdpMLineIndex))

export class Calls<P extends Party> {
  readonly #hub: Hub<P>
  readonly #records = new Map<string, CallRecord<P>>()

  constructor(hub: Hub<P>) {
    this.#hub = hub
  }

  call(caller: P, message: Fields): boolean {
    const {pc, to, ms, d} = message
    if (typeof pc !== 'string' || typeof to !== 'string' || !isDescription(d)) {
      return false
    }
    const reject = (reason: Rejection): boolean => {
      this.#hub.post(caller, {t: 'reject', pc, reason})
      return true
    }
    const bytes = utf8Bytes(d.sdp)
    if (typeof ms !== 'number' || !Number.isInteger(ms) || ms < 1 || ms > attemptMs || bytes > signalBytes || this.#records.has(pc)) {
      return reject('failed')
    }
    const callee = this.#hub.openParty(to)
    if (callee === undefined || callee === caller || caller.peerId === null || !callee.list.has(caller.peerId)) {
      return reject('no peer')
    }
    const records = [...this.#records.values()]
    if (
      records.filter(record => record.callee === callee).length >= callsPerCallee ||
      records.filter(record => record.callee === callee && record.caller === caller).length >= callsPerPair ||
      records.filter(record => record.caller === caller).length >= callsPerCaller
    ) {
      return reject('busy')
    }
    const deadline = this.#hub.clock.now() + ms
    const timer = this.#hub.clock.setTimeout(() => this.#forget(pc), ms)
    const usage = new Map<P, Usage>([
      [caller, {described: true, candidates: 0, bytes}],
      [callee, {described: false, candidates: 0, bytes: 0}]
    ])
    this.#records.set(pc, {caller, callee, usage, timer})
    this.#hub.post(callee, {t: 'call', pc, from: caller.peerId, ms: Math.ceil(deadline - this.#hub.clock.now()), d})
    return true
  }

  signal(from: P, message: Fields): boolean {
    const {pc} = message
    const hasDescription = 'd' in message
    if (typeof pc !== 'string' || hasDescription === 'c' in message) {
      return false
    }
    if (hasDescription ? !isDescription(message.d) : !(Array.isArray(message.c) && message.c.every(isCandidate))) {
      return false
    }
    const record = this.#records.get(pc)
    const usage = record?.usage.get(from)
    if (record === undefined || usage === undefined || from.peerId === null) {
      return true
    }
    const other = record.caller === from ? record.callee : record.caller
    if (isDescription(message.d)) {
      const bytes = usage.bytes + utf8Bytes(message.d.sdp)
      if (usage.described || bytes > signalBytes) {
        return this.#failed(pc, record)
      }
      usage.described = true
      usage.bytes = bytes
      this.#hub.post(other, {t: 'signal', pc, from: from.peerId, d: message.d})
      return true
    }
    const candidates = message.c as readonly Candidate[]
    const bytes = candidates.reduce((sum, candidate) => sum + utf8Bytes(candidate.candidate), usage.bytes)
    if (usage.candidates + candidates.length > candidatesPerPage || bytes > signalBytes) {
      return this.#failed(pc, record)
    }
    usage.candidates += candidates.length
    usage.bytes = bytes
    this.#hub.post(other, {t: 'signal', pc, from: from.peerId, c: candidates})
    return true
  }

  closing(from: P, message: Fields): boolean {
    const {pc, reason} = message
    if (typeof pc !== 'string' || typeof reason !== 'string' || reason.length > 32) {
      return false
    }
    const record = this.#records.get(pc)
    if (record === undefined || !record.usage.has(from) || from.peerId === null) {
      return true
    }
    this.#forget(pc)
    this.#hub.post(record.caller === from ? record.callee : record.caller, {t: 'close', pc, from: from.peerId, reason})
    return true
  }

  disconnected(party: P): void {
    for (const [pc, record] of [...this.#records]) {
      if (record.usage.has(party)) {
        this.#forget(pc)
        this.#hub.post(record.caller === party ? record.callee : record.caller, {t: 'gone', pc})
      }
    }
  }

  clear(): void {
    for (const pc of [...this.#records.keys()]) {
      this.#forget(pc)
    }
  }

  #failed(pc: string, record: CallRecord<P>): boolean {
    this.#forget(pc)
    this.#hub.post(record.caller, {t: 'failed', pc})
    this.#hub.post(record.callee, {t: 'failed', pc})
    return true
  }

  #forget(pc: string): void {
    const record = this.#records.get(pc)
    if (record !== undefined) {
      this.#hub.clock.clearTimeout(record.timer)
      this.#records.delete(pc)
    }
  }
}
