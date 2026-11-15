import type {
  ChannelHandlers,
  IncomingHandler,
  ModuleChannel,
  PeerConnection,
  PeerHandlers,
  SignalingClosing,
  SignalingConnection,
  SignalingState
} from './api.ts'
import type {SocketLike} from './environment.ts'
import {callSafely} from './handlers.ts'
import type {Live, PageContext} from './page.ts'
import {PeerSide} from './peer.ts'
import {transportVersion, type Older, type PageMessage, type ServerMessage, type TurnServers} from './protocol.ts'
import {compactJson, isTextWithin, moduleMessageBytes, type ModuleMessage} from './values.ts'

const openingMs = 10_000
const silenceMs = 45_000

type Ending = {readonly reason: 'offline'} | {readonly reason: 'outdated'; readonly older: Older}

export class Signaling implements SignalingConnection, Live {
  state: SignalingState = 'opening'
  peerId: string | null = null
  readonly #page: PageContext
  readonly #socket: SocketLike
  readonly #channels: ReadonlyMap<string, ChannelHandlers>
  readonly #startedAt: number
  #lastArrivalAt: number | null = null
  #timer: unknown = null
  #nextRequest = 1
  readonly #listChanges = new Map<number, (applied: boolean) => void>()
  readonly #turnRequests = new Map<number, (servers: TurnServers | null) => void>()
  readonly #peers = new Map<string, PeerSide>()
  #incoming: IncomingHandler | null = null

  constructor(page: PageContext, modules: {readonly [module: string]: ModuleChannel}) {
    this.#page = page
    this.#channels = new Map(Object.entries(modules).map(([name, channel]) => [name, channel.handlers]))
    this.#startedAt = page.now()
    page.signalings.add(this)
    const versions = Object.fromEntries(Object.entries(modules).map(([name, channel]) => [name, channel.version]))
    this.#socket = page.environment.openSocket(page.environment.signalingUrl)
    this.#socket.onopen = page.entered(() => {
      if (this.state === 'opening') {
        this.post({t: 'hello', v: transportVersion, m: versions})
      }
    })
    this.#socket.onmessage = page.entered(event => this.#receive(event.data))
    this.#socket.onclose = page.entered(() => this.#end({reason: 'offline'}, {closeSocket: false, tell: true}))
    this.#schedule()
  }

  limit(): number {
    return this.state === 'opening' ? this.#startedAt + openingMs : (this.#lastArrivalAt ?? this.#startedAt) + silenceMs
  }

  checkTime(now: number): void {
    if (this.state !== 'closed' && now >= this.limit()) {
      this.#end({reason: 'offline'}, {closeSocket: true, tell: true})
    }
  }

  #schedule(): void {
    this.#page.clock.clearTimeout(this.#timer)
    if (this.state !== 'closed') {
      this.#timer = this.#page.timerAt(this.limit(), () => this.#schedule())
    }
  }

  post(message: PageMessage): void {
    this.#socket.send(JSON.stringify(message))
  }

  #receive(data: unknown): void {
    if (this.state === 'closed') {
      return
    }
    this.#lastArrivalAt = this.#page.now()
    let message: ServerMessage
    try {
      message = JSON.parse(String(data)) as ServerMessage
    } catch {
      return
    }
    switch (message.t) {
      case 'id':
        if (this.state === 'opening') {
          this.#open(message.p)
        }
        return
      case 'outdated':
        if (this.state === 'opening') {
          this.#end({reason: 'outdated', older: message.older}, {closeSocket: false, tell: true})
        }
        return
      case 'check':
        this.post({t: 'answer', n: message.n})
        return
      case 'module':
        if (this.state === 'open') {
          callSafely(() => this.#channels.get(message.c)?.message?.(message.m as ModuleMessage))
        }
        return
      case 'list':
        this.#listChanges.get(message.r)?.(message.ok)
        this.#listChanges.delete(message.r)
        return
      case 'turn':
        this.#turnRequests.get(message.r)?.(message.s)
        this.#turnRequests.delete(message.r)
        return
      case 'call':
        if (this.state === 'open' && !this.#peers.has(message.pc)) {
          PeerSide.answer(this.#page, this, message, this.#incoming)
        }
        return
      default:
        if (this.state === 'open') {
          this.#peers.get(message.pc)?.fromServer(message)
        }
    }
  }

  #open(peerId: string): void {
    this.state = 'open'
    this.peerId = peerId
    this.#schedule()
    for (const handlers of this.#channels.values()) {
      if (this.state !== 'open') {
        return
      }
      callSafely(() => handlers.open?.(peerId))
    }
  }

  #end(ending: Ending, {closeSocket, tell}: {readonly closeSocket: boolean; readonly tell: boolean}): void {
    if (this.state === 'closed') {
      return
    }
    this.state = 'closed'
    this.#page.clock.clearTimeout(this.#timer)
    this.#page.signalings.delete(this)
    if (closeSocket) {
      this.#socket.close()
    }
    const listChanges = [...this.#listChanges.values()]
    this.#listChanges.clear()
    this.#turnRequests.clear()
    for (const settle of listChanges) {
      settle(false)
    }
    for (const peer of [...this.#peers.values()]) {
      peer.signalingClosed()
    }
    if (tell) {
      const closing: SignalingClosing = {...ending, lastArrivalAt: this.#lastArrivalAt ?? this.#startedAt}
      for (const handlers of this.#channels.values()) {
        callSafely(() => handlers.closed?.(closing))
      }
    }
  }

  send(module: string, message: unknown): boolean {
    if (this.state !== 'open' || !this.#channels.has(module)) {
      return false
    }
    const json = compactJson(message)
    if (json === null || !isTextWithin(json, moduleMessageBytes)) {
      return false
    }
    this.#socket.send(`{"t":"module","c":${JSON.stringify(module)},"m":${json}}`)
    return true
  }

  allow(peerId: string): Promise<boolean> {
    return this.#changeList(peerId, true)
  }

  disallow(peerId: string): Promise<boolean> {
    return this.#changeList(peerId, false)
  }

  #changeList(peerId: string, add: boolean): Promise<boolean> {
    if (this.state !== 'open' || typeof peerId !== 'string') {
      return Promise.resolve(false)
    }
    const r = this.#nextRequest++
    this.post({t: 'list', r, p: peerId, add})
    return new Promise(resolve => this.#listChanges.set(r, resolve))
  }

  requestTurn(answered: (servers: TurnServers | null) => void): void {
    const r = this.#nextRequest++
    this.#turnRequests.set(r, answered)
    this.post({t: 'turn', r})
  }

  setIncoming(handler: IncomingHandler): boolean {
    if (this.#incoming !== null) {
      return false
    }
    this.#incoming = handler
    return true
  }

  connect(peerId: string, handlers: PeerHandlers = {}): PeerConnection {
    return PeerSide.call(this.#page, this, peerId, handlers)
  }

  attach(peer: PeerSide): void {
    this.#peers.set(peer.id, peer)
  }

  detach(peer: PeerSide): void {
    this.#peers.delete(peer.id)
  }

  close(): void {
    this.#end({reason: 'offline'}, {closeSocket: true, tell: false})
  }

  hide(): void {
    this.close()
  }
}
