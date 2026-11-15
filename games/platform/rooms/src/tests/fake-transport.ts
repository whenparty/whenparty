import type {
  ChannelHandlers,
  IncomingHandler,
  ModuleChannel,
  Older,
  Path,
  PeerConnection,
  PeerHandlers,
  PeerReason,
  PeerState,
  SignalingConnection,
  SignalingState,
  Transport
} from '@whenparty/transport'
import type {FakeClock} from './clock.ts'

export type Sent = {readonly t: string; readonly r?: number; readonly [key: string]: unknown}

export class FakePeer implements PeerConnection {
  state: PeerState = 'connecting'
  handlers: PeerHandlers = {}
  readonly peerId: string
  readonly sent: string[] = []
  closedByModule = false
  readonly #clock: FakeClock

  constructor(peerId: string, clock: FakeClock) {
    this.peerId = peerId
    this.#clock = clock
  }

  send(text: unknown): boolean {
    if (this.state !== 'open' || typeof text !== 'string') {
      return false
    }
    this.sent.push(text)
    return true
  }

  close(): void {
    if (this.state !== 'closed') {
      this.state = 'closed'
      this.closedByModule = true
    }
  }

  open(path: Path = 'direct', roundTripMs: number | null = 20): void {
    this.state = 'open'
    this.handlers.open?.(path, roundTripMs)
  }

  receive(text: string): void {
    if (this.state === 'open') {
      this.handlers.text?.(text)
    }
  }

  report(path: Path, roundTripMs: number | null): void {
    this.handlers.path?.(path, roundTripMs)
  }

  drop(reason: PeerReason = 'broken', lastArrivalAt = this.#clock.now()): void {
    if (this.state !== 'closed') {
      this.state = 'closed'
      this.handlers.closed?.({reason, lastArrivalAt})
    }
  }
}

export class FakeSignaling implements SignalingConnection {
  state: SignalingState = 'opening'
  peerId: string | null = null
  readonly sent: Sent[] = []
  readonly peers: FakePeer[] = []
  readonly incoming: FakePeer[] = []
  incomingHandler: IncomingHandler | null = null
  closedByPage = false
  readonly handlers: ChannelHandlers
  readonly versions: {readonly [module: string]: number}
  readonly #clock: FakeClock

  constructor(modules: {readonly [module: string]: ModuleChannel}, clock: FakeClock) {
    this.handlers = Object.values(modules)[0]?.handlers ?? {}
    this.versions = Object.fromEntries(Object.entries(modules).map(([name, channel]) => [name, channel.version]))
    this.#clock = clock
  }

  send(_module: string, message: unknown): boolean {
    if (this.state !== 'open') {
      return false
    }
    this.sent.push(JSON.parse(JSON.stringify(message)) as Sent)
    return true
  }

  allow(): Promise<boolean> {
    return Promise.resolve(false)
  }

  disallow(): Promise<boolean> {
    return Promise.resolve(false)
  }

  setIncoming(handler: IncomingHandler): boolean {
    if (this.incomingHandler !== null) {
      return false
    }
    this.incomingHandler = handler
    return true
  }

  connect(peerId: string, handlers: PeerHandlers = {}): PeerConnection {
    const peer = new FakePeer(peerId, this.#clock)
    peer.handlers = handlers
    this.peers.push(peer)
    if (this.state !== 'open') {
      peer.state = 'closed'
      const at = this.#clock.now()
      queueMicrotask(() => peer.handlers.closed?.({reason: 'offline', lastArrivalAt: at}))
    }
    return peer
  }

  close(): void {
    if (this.state !== 'closed') {
      this.state = 'closed'
      this.closedByPage = true
    }
  }

  open(peerId = 'page peer'): void {
    this.state = 'open'
    this.peerId = peerId
    this.handlers.open?.(peerId)
  }

  receive(message: unknown): void {
    if (this.state !== 'closed') {
      this.handlers.message?.(message as never)
    }
  }

  answer(t: string, fields: {readonly [key: string]: unknown} = {}, request?: string): void {
    const sent = [...this.sent].reverse().find(message => message.r !== undefined && (request === undefined || message.t === request))
    this.receive({t, r: sent?.r, ...fields})
  }

  drop(lastArrivalAt = this.#clock.now()): void {
    if (this.state !== 'closed') {
      this.state = 'closed'
      this.handlers.closed?.({reason: 'offline', lastArrivalAt})
    }
  }

  outdated(older: Older): void {
    if (this.state !== 'closed') {
      this.state = 'closed'
      this.handlers.closed?.({reason: 'outdated', older, lastArrivalAt: this.#clock.now()})
    }
  }

  call(caller: string): FakePeer {
    const peer = new FakePeer(caller, this.#clock)
    this.incoming.push(peer)
    this.incomingHandler?.(peer, caller)
    return peer
  }

  last(t: string): Sent | undefined {
    return [...this.sent].reverse().find(message => message.t === t)
  }
}

export class FakeTransport implements Transport {
  readonly connections: FakeSignaling[] = []
  readonly #clock: FakeClock

  constructor(clock: FakeClock) {
    this.#clock = clock
  }

  openSignaling(modules: {readonly [module: string]: ModuleChannel}): SignalingConnection {
    const connection = new FakeSignaling(modules, this.#clock)
    this.connections.push(connection)
    return connection
  }

  get latest(): FakeSignaling {
    const connection = this.connections.at(-1)
    if (!connection) {
      throw new Error('no signaling connection')
    }
    return connection
  }
}
