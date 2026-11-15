import type {PeerConnection, PeerHandlers, SignalingConnection} from '../api.ts'
import type {TurnServers} from '../protocol.ts'
import {describeSent, FakeChannel, FakeRtc, own, PageHarness, settle} from './fake-page.ts'

export interface PeerNotice {
  readonly kind: 'incoming' | 'open' | 'text' | 'path' | 'closed'
  readonly value: unknown
}

export const turnServers: TurnServers = {urls: ['turn:turn.when.party:3478?transport=udp'], username: '1:abc', credential: 'secret'}

export const hostCandidate = {candidate: 'candidate:1 1 udp 2122260223 192.0.2.1 50000 typ host', sdpMid: '0', sdpMLineIndex: 0}

export class PeerScene {
  readonly h = new PageHarness()
  readonly signaling: SignalingConnection
  readonly notices: PeerNotice[] = []
  readonly throwing = new Set<PeerNotice['kind']>()
  peer: PeerConnection | null = null
  startedAt = 0
  lastArrivalAt: number | null = null
  socketMark = 0
  channelMark = 0
  noticeMark = 0
  rtcMark = 0
  result: boolean | null = null
  textHandler = true

  constructor() {
    this.signaling = this.h.transport.openSignaling(this.h.channels('alpha'))
    this.h.socket.open()
    this.h.socket.receive({t: 'id', p: 'own-peer'})
  }

  handlers(): PeerHandlers {
    const record =
      (kind: PeerNotice['kind']) =>
      (...values: unknown[]) => {
        this.notices.push({kind, value: values.length === 1 ? values[0] : values})
        if (this.throwing.has(kind)) {
          throw new Error(`${kind} throws`)
        }
      }
    const handlers: PeerHandlers = {open: record('open'), path: record('path'), closed: record('closed')}
    if (this.textHandler) {
      handlers.text = record('text')
    }
    return handlers
  }

  get connection(): PeerConnection {
    if (this.peer === null) {
      throw new Error('no peer connection')
    }
    return this.peer
  }

  get rtc(): FakeRtc {
    return this.h.rtc
  }

  get channel(): FakeChannel {
    return this.h.rtc.channel
  }

  get pc(): string {
    const call = this.h.socket.last('call')
    return String(call?.pc ?? this.incomingPc)
  }

  incomingPc = 'incoming-pc-identifier'

  connect(): void {
    this.startedAt = this.h.clock.now()
    this.peer = this.signaling.connect('other-peer', this.handlers())
  }

  answerTurn(servers: TurnServers | null = null): void {
    const request = this.h.socket.last('turn')
    this.h.socket.receive({t: 'turn', r: request?.r, s: servers})
  }

  call(ms = 15_000, setHandler = true, throwing = false): void {
    if (setHandler) {
      this.signaling.setIncoming((peer, callerPeerId) => {
        this.notices.push({kind: 'incoming', value: callerPeerId})
        if (throwing) {
          throw new Error('incoming throws')
        }
        peer.handlers = this.handlers()
        this.peer = peer
      })
    }
    this.startedAt = this.h.clock.now()
    this.h.socket.receive({t: 'call', pc: this.incomingPc, from: 'other-peer', ms, d: {type: 'offer', sdp: 'v=0 offer'}})
  }

  async withRtc(): Promise<void> {
    this.connect()
    this.answerTurn()
    await settle()
  }

  fromOther(message: Record<string, unknown>): void {
    this.h.socket.receive({pc: this.pc, from: 'other-peer', ...message})
  }

  async remoteAnswer(): Promise<void> {
    this.fromOther({t: 'signal', d: {type: 'answer', sdp: 'v=0 answer'}})
    await settle()
  }

  async toChannel(): Promise<void> {
    await this.withRtc()
    await this.remoteAnswer()
    this.channel.open()
    await settle()
  }

  arrive(action: () => void): void {
    const closed = this.connection.state === 'closed'
    action()
    if (!closed) {
      this.lastArrivalAt = this.h.clock.now()
    }
  }

  async toOpen(): Promise<void> {
    await this.toChannel()
    this.arrive(() => this.channel.receiveOwn(own.ready))
  }

  async enter(state: 'connecting' | 'channel' | 'open' | 'closed'): Promise<void> {
    if (state === 'connecting') {
      await this.withRtc()
    } else if (state === 'channel') {
      await this.toChannel()
    } else {
      await this.toOpen()
      if (state === 'closed') {
        this.connection.close()
        this.channel.finishClosing()
      }
    }
    this.mark()
  }

  mark(): void {
    this.socketMark = this.h.socket.sent.length
    this.channelMark = this.h.rtcs.length > 0 ? this.channel.sent.length : 0
    this.noticeMark = this.notices.length
    this.rtcMark = this.h.rtcs.length
  }

  get socketSince(): Record<string, unknown>[] {
    return this.h.socket.sent.slice(this.socketMark)
  }

  get channelSince(): string[] {
    return this.h.rtcs.length > 0 ? this.channel.sent.slice(this.channelMark).map(describeSent) : []
  }

  get noticesSince(): PeerNotice[] {
    return this.notices.slice(this.noticeMark)
  }

  closedNotice(reason: string): PeerNotice {
    return {kind: 'closed', value: {reason, lastArrivalAt: this.lastArrivalAt ?? this.startedAt}}
  }
}
