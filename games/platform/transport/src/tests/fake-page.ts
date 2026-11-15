import type {ChannelHandlers, ModuleChannel, Transport} from '../api.ts'
import type {
  CandidateLike,
  DataChannelLike,
  DescriptionLike,
  Environment,
  PeerConnectionLike,
  SocketLike,
  StatsLike
} from '../environment.ts'
import {createTransport} from '../page.ts'
import type {TurnServers} from '../protocol.ts'
import {FakeClock} from './fake-clock.ts'

export const settle = (): Promise<void> => new Promise(resolve => setImmediate(resolve))

export class FakeSocket implements SocketLike {
  onopen: (() => void) | null = null
  onmessage: ((event: {readonly data: unknown}) => void) | null = null
  onclose: (() => void) | null = null
  readonly url: string
  readonly sent: Record<string, unknown>[] = []
  readonly log: ('send' | 'close')[] = []
  closeCalls = 0

  constructor(url: string) {
    this.url = url
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>)
    this.log.push('send')
  }

  close(): void {
    this.closeCalls += 1
    this.log.push('close')
  }

  open(): void {
    this.onopen?.()
  }

  receive(message: unknown): void {
    this.onmessage?.({data: JSON.stringify(message)})
  }

  drop(): void {
    this.onclose?.()
  }

  last(type?: string): Record<string, unknown> | undefined {
    return this.sent.filter(message => type === undefined || message.t === type).at(-1)
  }
}

export class FakeChannel implements DataChannelLike {
  readyState = 'connecting'
  binaryType = 'blob'
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((event: {readonly data: unknown}) => void) | null = null
  readonly sent: (string | Uint8Array)[] = []
  failSend = false

  send(data: string | Uint8Array<ArrayBuffer>): void {
    if (this.readyState !== 'open') {
      throw new Error('channel not open')
    }
    this.sent.push(data)
    if (this.failSend) {
      throw new Error('send failed')
    }
  }

  close(): void {
    if (this.readyState === 'open' || this.readyState === 'connecting') {
      this.readyState = 'closing'
    }
  }

  open(): void {
    this.readyState = 'open'
    this.onopen?.()
  }

  finishClosing(): void {
    this.readyState = 'closed'
    this.onclose?.()
  }

  receive(data: unknown): void {
    this.onmessage?.({data})
  }

  receiveOwn(code: number, text = ''): void {
    const bytes = new TextEncoder().encode(text)
    const message = new Uint8Array(1 + bytes.length)
    message[0] = code
    message.set(bytes, 1)
    this.receive(message.buffer)
  }
}

export const own = {ready: 1, check: 2, answer: 3, closing: 4} as const

export const describeSent = (data: string | Uint8Array): string => {
  if (typeof data === 'string') {
    return `text:${data}`
  }
  const names = ['', 'ready', 'check', 'answer', 'closing']
  const name = names[data[0] ?? 0] ?? 'unknown'
  return data[0] === own.closing ? `closing:${new TextDecoder().decode(data.subarray(1))}` : name
}

export interface PairStats {
  readonly local: string
  readonly remote: string
  readonly roundTripSeconds?: number
  readonly id?: string
}

const statsWithoutPair: StatsLike = {forEach: callback => callback({type: 'transport'}), get: () => undefined}

export const statsOf = (pair: PairStats | null): StatsLike => {
  if (pair === null) {
    return statsWithoutPair
  }
  const {local, remote, roundTripSeconds, id = 'pair'} = pair
  const stats = new Map<string, Record<string, unknown>>([
    ['transport', {type: 'transport', selectedCandidatePairId: id}],
    [
      id,
      {type: 'candidate-pair', localCandidateId: `${id}-local`, remoteCandidateId: `${id}-remote`, currentRoundTripTime: roundTripSeconds}
    ],
    [`${id}-local`, {type: 'local-candidate', candidateType: local}],
    [`${id}-remote`, {type: 'remote-candidate', candidateType: remote}]
  ])
  return {forEach: callback => stats.forEach(stat => callback(stat)), get: key => stats.get(key)}
}

export type BrowserStep = 'setRemoteDescription' | 'createAnswer' | 'addIceCandidate' | 'getStats'

export class HeldSteps {
  readonly #holding = new Set<BrowserStep>()
  readonly #waiting: (() => void)[] = []

  hold(step: BrowserStep): void {
    this.#holding.add(step)
  }

  release(): void {
    this.#holding.clear()
    for (const resume of this.#waiting.splice(0)) {
      resume()
    }
  }

  async pass(step: BrowserStep): Promise<void> {
    if (this.#holding.has(step)) {
      await new Promise<void>(resolve => this.#waiting.push(resolve))
    }
  }
}

export class FakeRtc implements PeerConnectionLike {
  connectionState = 'new'
  sctp: {readonly maxMessageSize: number} | null = {maxMessageSize: 262_144}
  onicecandidate: ((event: {readonly candidate: CandidateLike | null}) => void) | null = null
  onicecandidateerror: ((event: {readonly errorCode: number}) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  readonly iceServers: readonly TurnServers[]
  readonly channels: FakeChannel[] = []
  local: DescriptionLike | null = null
  remote: DescriptionLike | null = null
  readonly added: CandidateLike[] = []
  rejectRemote = false
  rejectCandidates = false
  failStats = false
  pair: PairStats | null = {local: 'host', remote: 'host', roundTripSeconds: 0.042}
  closed = false
  readonly #steps: HeldSteps

  constructor(iceServers: readonly TurnServers[], steps: HeldSteps) {
    this.iceServers = iceServers
    this.#steps = steps
  }

  get channel(): FakeChannel {
    const channel = this.channels[0]
    if (channel === undefined) {
      throw new Error('no channel')
    }
    return channel
  }

  createDataChannel(): DataChannelLike {
    const channel = new FakeChannel()
    this.channels.push(channel)
    return channel
  }

  async createOffer(): Promise<DescriptionLike> {
    return {type: 'offer', sdp: 'v=0 offer'}
  }

  async createAnswer(): Promise<DescriptionLike> {
    await this.#steps.pass('createAnswer')
    return {type: 'answer', sdp: 'v=0 answer'}
  }

  async setLocalDescription(description: DescriptionLike): Promise<void> {
    this.local = description
  }

  async setRemoteDescription(description: DescriptionLike): Promise<void> {
    await this.#steps.pass('setRemoteDescription')
    if (this.rejectRemote) {
      throw new Error('rejected')
    }
    this.remote = description
  }

  async addIceCandidate(candidate: CandidateLike): Promise<void> {
    await this.#steps.pass('addIceCandidate')
    if (this.rejectCandidates) {
      throw new Error('rejected')
    }
    this.added.push(candidate)
  }

  async getStats(): Promise<StatsLike> {
    await this.#steps.pass('getStats')
    if (this.failStats) {
      throw new Error('no stats')
    }
    return statsOf(this.pair)
  }

  close(): void {
    this.closed = true
  }

  gather(candidate: CandidateLike | null): void {
    this.onicecandidate?.({candidate})
  }

  report(state: string): void {
    this.connectionState = state
    this.onconnectionstatechange?.()
  }
}

export interface Notice {
  readonly module: string
  readonly kind: 'open' | 'message' | 'closed'
  readonly value: unknown
}

export class PageHarness {
  readonly clock = new FakeClock()
  readonly sockets: FakeSocket[] = []
  readonly rtcs: FakeRtc[] = []
  readonly steps = new HeldSteps()
  readonly notices: Notice[] = []
  readonly #hideListeners: (() => void)[] = []
  readonly transport: Transport
  throwing = new Set<string>()

  constructor() {
    const environment: Environment = {
      clock: this.clock,
      signalingUrl: 'ws://localhost:8080/platform',
      openSocket: url => {
        const socket = new FakeSocket(url)
        this.sockets.push(socket)
        return socket
      },
      createPeerConnection: configuration => {
        const rtc = new FakeRtc(configuration.iceServers, this.steps)
        this.rtcs.push(rtc)
        return rtc
      },
      onPageHide: listener => {
        this.#hideListeners.push(listener)
      }
    }
    this.transport = createTransport(environment)
  }

  get socket(): FakeSocket {
    const socket = this.sockets.at(-1)
    if (socket === undefined) {
      throw new Error('no socket')
    }
    return socket
  }

  get rtc(): FakeRtc {
    const rtc = this.rtcs.at(-1)
    if (rtc === undefined) {
      throw new Error('no peer connection')
    }
    return rtc
  }

  handlers(module: string): ChannelHandlers {
    const record = (kind: Notice['kind']) => (value: unknown) => {
      this.notices.push({module, kind, value})
      if (this.throwing.has(kind)) {
        throw new Error(`${module} ${kind} throws`)
      }
    }
    return {open: record('open'), message: record('message'), closed: record('closed')}
  }

  channels(...modules: string[]): {readonly [module: string]: ModuleChannel} {
    return Object.fromEntries(modules.map(module => [module, {version: 1, handlers: this.handlers(module)}]))
  }

  hide(): void {
    for (const listener of this.#hideListeners) {
      listener()
    }
  }
}
