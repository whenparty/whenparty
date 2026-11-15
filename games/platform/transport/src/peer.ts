import type {IncomingHandler, Path, PeerConnection, PeerHandlers, PeerReason, PeerState} from './api.ts'
import type {CandidateLike, DataChannelLike, DescriptionLike, PeerConnectionLike, StatsLike} from './environment.ts'
import {callSafely} from './handlers.ts'
import type {Live, PageContext} from './page.ts'
import type {Candidate, Description, ServerMessage, TurnServers} from './protocol.ts'
import type {Signaling} from './signaling.ts'
import {isText, randomId, textBytes, utf8Bytes} from './values.ts'

const attemptMs = 15_000
const checkEveryMs = 5_000
const silenceMs = 15_000
const pathEveryMs = 4_000
const channelGraceMs = 1_000
const batchMs = 250
const signalBytes = 16_384
const candidateLimits: ReadonlyMap<string, number> = new Map([
  ['host', 16],
  ['srflx', 8],
  ['relay', 8]
])
const noAllocationErrors = new Set([486, 508])

const kind = {ready: 1, check: 2, answer: 3, closing: 4} as const

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const own = (code: number, text = ''): Uint8Array<ArrayBuffer> => {
  const textPart = encoder.encode(text)
  const bytes = new Uint8Array(1 + textPart.length)
  bytes[0] = code
  bytes.set(textPart, 1)
  return bytes
}

const bytesOf = (data: unknown): Uint8Array | null => {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  }
  return null
}

interface Reading {
  readonly path: Path
  readonly roundTripMs: number | null
  readonly pair: string | null
}

const unknownReading: Reading = {path: 'direct', roundTripMs: null, pair: null}

const readingOf = (stats: StatsLike): Reading => {
  let pair: Record<string, unknown> | undefined
  stats.forEach(stat => {
    if (pair === undefined && stat.type === 'transport' && typeof stat.selectedCandidatePairId === 'string') {
      pair = stats.get(stat.selectedCandidatePairId)
    }
  })
  stats.forEach(stat => {
    if (
      pair === undefined &&
      stat.type === 'candidate-pair' &&
      (stat.selected === true || (stat.nominated === true && stat.state === 'succeeded'))
    ) {
      pair = stat
    }
  })
  if (pair === undefined) {
    return unknownReading
  }
  const local = stats.get(String(pair.localCandidateId))
  const remote = stats.get(String(pair.remoteCandidateId))
  const turn = local?.candidateType === 'relay' || remote?.candidateType === 'relay'
  const seconds = pair.currentRoundTripTime
  return {
    path: turn ? 'turn' : 'direct',
    roundTripMs: typeof seconds === 'number' ? Math.round(seconds * 1000) : null,
    pair: `${String(pair.localCandidateId)}/${String(pair.remoteCandidateId)}`
  }
}

const candidateType = (candidate: CandidateLike): string => candidate.type ?? / typ ([a-z]+)/.exec(candidate.candidate)?.[1] ?? ''

type ForPeer = Extract<ServerMessage, {readonly t: 'reject' | 'signal' | 'close' | 'failed' | 'gone'}>
type Call = Extract<ServerMessage, {readonly t: 'call'}>

type Telling = 'now' | 'later' | 'no'

export class PeerSide implements PeerConnection, Live {
  state: PeerState = 'connecting'
  handlers: PeerHandlers
  readonly id: string
  readonly peerId: string
  readonly #page: PageContext
  readonly #signaling: Signaling
  readonly #startedAt: number
  readonly #deadline: number
  #lastArrivalAt: number | null = null
  #rtc: PeerConnectionLike | null = null
  #channel: DataChannelLike | null = null
  #remote: Description | null = null
  #remoteArrived = false
  #remoteSet = false
  #early: Candidate[] = []
  #relayGathered = false
  #noAllocation = false
  #described = false
  #batch: Candidate[] = []
  #batchTimer: unknown = null
  readonly #sent = new Map<string, number>()
  #bytes = 0
  #reading: Reading | null = null
  #inbox: unknown[] = []
  #limitTimer: unknown = null
  #checkTimer: unknown = null
  #nextCheckAt = 0
  #pathTimer: unknown = null
  #graceTimer: unknown = null
  #browserClosed = false

  private constructor(page: PageContext, signaling: Signaling, id: string, peerId: string, handlers: PeerHandlers, deadline: number) {
    this.#page = page
    this.#signaling = signaling
    this.id = id
    this.peerId = peerId
    this.handlers = handlers
    this.#startedAt = page.now()
    this.#deadline = deadline
    page.peers.add(this)
    signaling.attach(this)
    this.#schedule()
  }

  static call(page: PageContext, signaling: Signaling, peerId: string, handlers: PeerHandlers): PeerSide {
    const side = new PeerSide(page, signaling, randomId(), peerId, handlers, page.now() + attemptMs)
    if (signaling.state === 'open') {
      signaling.requestTurn(servers => side.#begin(servers, true))
    } else {
      side.#close('offline', {tell: 'later', send: false})
    }
    return side
  }

  static answer(page: PageContext, signaling: Signaling, call: Call, incoming: IncomingHandler | null): void {
    const side = new PeerSide(page, signaling, call.pc, call.from, {}, page.now() + call.ms)
    side.#remote = call.d
    side.#remoteArrived = true
    if (incoming === null) {
      side.#close('closed', {tell: 'no'})
      return
    }
    try {
      const result = incoming(side, call.from)
      if (typeof (result as PromiseLike<unknown> | null)?.then === 'function') {
        Promise.resolve(result).catch(() => {})
      }
    } catch {
      side.#close('closed', {tell: 'no'})
      return
    }
    if (side.state === 'connecting') {
      signaling.requestTurn(servers => side.#begin(servers, false))
    }
  }

  limit(): number {
    return this.state === 'open' ? (this.#lastArrivalAt ?? this.#startedAt) + silenceMs : this.#deadline
  }

  checkTime(now: number): void {
    if (this.state === 'closed' || now < this.limit()) {
      return
    }
    this.#close(this.state === 'open' ? 'broken' : this.#failure())
  }

  #schedule(): void {
    this.#page.clock.clearTimeout(this.#limitTimer)
    if (this.state !== 'closed') {
      this.#limitTimer = this.#page.timerAt(this.limit(), () => this.#schedule())
    }
  }

  #resumed(): boolean {
    this.#page.checkTime()
    return this.state !== 'closed'
  }

  #failure(): PeerReason {
    return this.state === 'connecting' && !this.#relayGathered && this.#remoteArrived && this.#noAllocation ? 'no relay' : 'timeout'
  }

  #begin(servers: TurnServers | null, caller: boolean): void {
    if (this.state !== 'connecting') {
      return
    }
    const page = this.#page
    const rtc = page.environment.createPeerConnection({iceServers: servers === null ? [] : [servers]})
    const channel = rtc.createDataChannel('transport', {negotiated: true, id: 0, ordered: true})
    channel.binaryType = 'arraybuffer'
    this.#rtc = rtc
    this.#channel = channel
    rtc.onicecandidate = page.entered(event => this.#gathered(event.candidate))
    rtc.onicecandidateerror = page.entered(event => {
      if (noAllocationErrors.has(event.errorCode)) {
        this.#noAllocation = true
      }
    })
    rtc.onconnectionstatechange = page.entered(() => {
      if (rtc.connectionState === 'failed' || rtc.connectionState === 'closed') {
        this.#broken()
      }
    })
    channel.onopen = page.entered(() => this.#channelOpened())
    channel.onclose = page.entered(() => this.#channelClosed())
    channel.onmessage = page.entered(event => this.#arrived(event.data))
    void (caller ? this.#offer(rtc) : this.#answer(rtc))
  }

  async #offer(rtc: PeerConnectionLike): Promise<void> {
    const sdp = await this.#describe(rtc, () => rtc.createOffer())
    if (sdp === null || this.#signaling.state !== 'open') {
      return
    }
    this.#signaling.post({
      t: 'call',
      pc: this.id,
      to: this.peerId,
      ms: Math.ceil(this.#deadline - this.#page.now()),
      d: {type: 'offer', sdp}
    })
    this.#described = true
    this.#flush()
  }

  async #answer(rtc: PeerConnectionLike): Promise<void> {
    if (this.#remote === null || !(await this.#applyRemote(rtc, this.#remote))) {
      return
    }
    const sdp = await this.#describe(rtc, () => rtc.createAnswer())
    if (sdp === null) {
      return
    }
    if (this.#signaling.state === 'open') {
      this.#signaling.post({t: 'signal', pc: this.id, d: {type: 'answer', sdp}})
    }
    this.#described = true
    this.#flush()
  }

  async #describe(rtc: PeerConnectionLike, create: () => Promise<DescriptionLike>): Promise<string | null> {
    try {
      const description = await create()
      if (!this.#resumed()) {
        return null
      }
      const sdp = description.sdp ?? ''
      this.#bytes += utf8Bytes(sdp)
      await rtc.setLocalDescription(description)
      return this.#resumed() ? sdp : null
    } catch {
      if (this.#resumed()) {
        this.#close(this.#failure())
      }
      return null
    }
  }

  async #applyRemote(rtc: PeerConnectionLike, description: Description): Promise<boolean> {
    try {
      await rtc.setRemoteDescription(description)
    } catch {
      if (this.#resumed()) {
        this.#rejected()
      }
      return false
    }
    if (!this.#resumed()) {
      return false
    }
    this.#remoteSet = true
    const early = this.#early
    this.#early = []
    for (const candidate of early) {
      this.#addCandidate(rtc, candidate)
    }
    return true
  }

  #addCandidate(rtc: PeerConnectionLike, candidate: Candidate): void {
    rtc.addIceCandidate(candidate).catch(this.#page.entered(() => this.#rejected()))
  }

  #rejected(): void {
    if (this.state === 'connecting' || this.state === 'channel') {
      this.#close('failed')
    }
  }

  fromServer(message: ForPeer): void {
    if (this.state === 'closed') {
      return
    }
    switch (message.t) {
      case 'reject':
        if (this.state === 'connecting') {
          this.#close(message.reason)
        }
        return
      case 'failed':
        if (this.state !== 'open') {
          this.#close('failed')
        }
        return
      case 'gone':
        if (this.state === 'connecting') {
          this.#close('peer offline')
        }
        return
      case 'close':
        if (message.from === this.peerId) {
          this.#close(message.reason === 'too small' ? 'too small' : 'closed', {send: false})
        }
        return
      case 'signal':
        if (message.from !== this.peerId) {
          return
        }
        if ('d' in message) {
          this.#remoteDescription(message.d)
        } else {
          this.#remoteCandidates(message.c)
        }
    }
  }

  #remoteDescription(description: Description): void {
    this.#remoteArrived = true
    if (this.#rtc === null) {
      this.#remote = description
    } else {
      void this.#applyRemote(this.#rtc, description)
    }
  }

  #remoteCandidates(candidates: readonly Candidate[]): void {
    if (this.#rtc === null || !this.#remoteSet) {
      this.#early.push(...candidates)
      return
    }
    for (const candidate of candidates) {
      this.#addCandidate(this.#rtc, candidate)
    }
  }

  signalingClosed(): void {
    if (this.state === 'connecting') {
      this.#close('offline')
    }
  }

  #gathered(candidate: CandidateLike | null): void {
    if (this.state !== 'connecting' && this.state !== 'channel') {
      return
    }
    if (candidate === null || candidate.candidate === '') {
      this.#flush()
      return
    }
    const type = candidateType(candidate)
    if (type === 'relay') {
      this.#relayGathered = true
    }
    const limit = candidateLimits.get(type) ?? 0
    const sent = this.#sent.get(type) ?? 0
    const bytes = utf8Bytes(candidate.candidate)
    if (sent >= limit || this.#bytes + bytes > signalBytes) {
      return
    }
    this.#sent.set(type, sent + 1)
    this.#bytes += bytes
    this.#batch.push({candidate: candidate.candidate, sdpMid: candidate.sdpMid ?? null, sdpMLineIndex: candidate.sdpMLineIndex ?? null})
    if (this.#batchTimer === null) {
      this.#batchTimer = this.#page.timerAt(this.#page.now() + batchMs, () => this.#flush())
    }
  }

  #flush(): void {
    this.#page.clock.clearTimeout(this.#batchTimer)
    this.#batchTimer = null
    if (!this.#described || this.#batch.length === 0 || this.state === 'closed') {
      return
    }
    if (this.#signaling.state === 'open') {
      this.#signaling.post({t: 'signal', pc: this.id, c: this.#batch})
    }
    this.#batch = []
  }

  #channelOpened(): void {
    if (this.state !== 'connecting') {
      return
    }
    const limit = this.#rtc?.sctp?.maxMessageSize
    if (typeof limit === 'number' && limit < textBytes) {
      this.#close('too small')
      return
    }
    this.state = 'channel'
    if (!this.#sendOn(own(kind.ready))) {
      return
    }
    void this.#read().then(
      this.#page.entered(reading => {
        this.#reading = reading
        this.#drain()
      })
    )
  }

  async #read(): Promise<Reading> {
    try {
      return this.#rtc === null ? unknownReading : readingOf(await this.#rtc.getStats())
    } catch {
      return unknownReading
    }
  }

  #arrived(data: unknown): void {
    if (this.state === 'closed') {
      return
    }
    this.#lastArrivalAt = this.#page.now()
    if (this.#inbox.length > 0 || (this.state === 'channel' && this.#reading === null)) {
      this.#inbox.push(data)
      return
    }
    this.#handle(data)
  }

  #drain(): void {
    while (this.#inbox.length > 0 && this.state !== 'closed') {
      this.#handle(this.#inbox.shift())
    }
  }

  #handle(data: unknown): void {
    if (typeof data === 'string') {
      if (this.state === 'open' && isText(data)) {
        callSafely(() => this.handlers.text?.(data))
      }
      return
    }
    const bytes = bytesOf(data)
    if (bytes === null || bytes.length === 0) {
      return
    }
    switch (bytes[0]) {
      case kind.ready:
        if (bytes.length === 1 && this.state === 'channel') {
          this.#opened()
        }
        return
      case kind.check:
        if (bytes.length === 1 && this.state === 'open') {
          this.#sendOn(own(kind.answer))
        }
        return
      case kind.closing: {
        const reason = decoder.decode(bytes.subarray(1))
        this.#close(reason === 'too small' ? 'too small' : 'closed', {send: false})
      }
    }
  }

  #opened(): void {
    this.state = 'open'
    this.#schedule()
    this.#nextCheckAt = this.#page.now() + checkEveryMs
    this.#checkTimer = this.#page.timerAt(this.#nextCheckAt, () => this.#check())
    this.#pathTimer = this.#page.timerAt(this.#page.now() + pathEveryMs, () => this.#watchPath())
    const reading = this.#reading ?? unknownReading
    callSafely(() => this.handlers.open?.(reading.path, reading.roundTripMs))
  }

  #check(): void {
    if (this.state !== 'open') {
      return
    }
    const now = this.#page.now()
    while (this.#nextCheckAt <= now) {
      this.#nextCheckAt += checkEveryMs
    }
    this.#checkTimer = this.#page.timerAt(this.#nextCheckAt, () => this.#check())
    this.#sendOn(own(kind.check))
  }

  #watchPath(): void {
    if (this.state !== 'open') {
      return
    }
    this.#pathTimer = this.#page.timerAt(this.#page.now() + pathEveryMs, () => this.#watchPath())
    void this.#read().then(
      this.#page.entered(reading => {
        if (this.state === 'open' && reading.pair !== null && reading.pair !== this.#reading?.pair) {
          this.#reading = reading
          callSafely(() => this.handlers.path?.(reading.path, reading.roundTripMs))
        }
      })
    )
  }

  #sendOn(data: string | Uint8Array<ArrayBuffer>): boolean {
    try {
      this.#channel?.send(data)
      return true
    } catch {
      this.#broken()
      return false
    }
  }

  #broken(): void {
    if (this.state === 'connecting' || this.state === 'channel') {
      this.#close(this.#failure())
    } else if (this.state === 'open') {
      this.#close('broken')
    }
  }

  #channelClosed(): void {
    if (this.state === 'closed') {
      this.#closeBrowser()
    } else {
      this.#broken()
    }
  }

  send(text: unknown): boolean {
    return this.state === 'open' && isText(text) && this.#sendOn(text)
  }

  close(): void {
    this.#close('closed', {tell: 'no'})
  }

  hide(): void {
    this.close()
  }

  #close(reason: PeerReason, {tell = 'now', send = true}: {readonly tell?: Telling; readonly send?: boolean} = {}): void {
    if (this.state === 'closed') {
      return
    }
    const wasOpen = this.state === 'open'
    const channel = this.#channel
    const channelOpen = channel?.readyState === 'open'
    this.state = 'closed'
    for (const timer of [this.#limitTimer, this.#checkTimer, this.#pathTimer, this.#batchTimer]) {
      this.#page.clock.clearTimeout(timer)
    }
    this.#inbox = []
    this.#page.peers.delete(this)
    this.#signaling.detach(this)
    if (send && !wasOpen && this.#signaling.state === 'open') {
      this.#signaling.post({t: 'close', pc: this.id, reason})
    }
    if (send && channelOpen) {
      try {
        channel.send(own(kind.closing, reason))
      } catch {
        channel.close()
      }
    }
    if (channelOpen) {
      channel.close()
      this.#graceTimer = this.#page.timerAt(this.#page.now() + channelGraceMs, () => this.#closeBrowser())
    } else {
      channel?.close()
      this.#closeBrowser()
    }
    const closing = {reason, lastArrivalAt: this.#lastArrivalAt ?? this.#startedAt}
    if (tell === 'now') {
      callSafely(() => this.handlers.closed?.(closing))
    } else if (tell === 'later') {
      queueMicrotask(() => callSafely(() => this.handlers.closed?.(closing)))
    }
  }

  #closeBrowser(): void {
    this.#page.clock.clearTimeout(this.#graceTimer)
    if (!this.#browserClosed) {
      this.#browserClosed = true
      this.#rtc?.close()
    }
  }
}
