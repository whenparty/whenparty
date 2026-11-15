import type {IncomingMessage} from 'node:http'
import type {Duplex} from 'node:stream'
import type {ServerPort, ServerSocket, TransportServer} from '../server/api.ts'
import {createTransportServer} from '../server/server.ts'
import {FakeClock} from './fake-clock.ts'
import type {PageHarness} from './fake-page.ts'

export class FakeServerSocket implements ServerSocket {
  bufferedAmount = 0
  readonly sent: Record<string, unknown>[] = []
  closedBy: 'no' | 'close' | 'terminate' = 'no'
  paused = false
  dropped = false
  readonly #messageListeners: ((data: unknown, isBinary: boolean) => void)[] = []
  readonly #closeListeners: (() => void)[] = []
  readonly #errorListeners: (() => void)[] = []

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>)
  }

  close(): void {
    if (this.closedBy === 'no') {
      this.closedBy = 'close'
    }
  }

  terminate(): void {
    if (this.closedBy === 'no') {
      this.closedBy = 'terminate'
    }
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
  }

  on(event: 'message', listener: (data: unknown, isBinary: boolean) => void): unknown
  on(event: 'close' | 'error', listener: () => void): unknown
  on(event: 'message' | 'close' | 'error', listener: ((data: unknown, isBinary: boolean) => void) | (() => void)): unknown {
    if (event === 'message') {
      this.#messageListeners.push(listener as (data: unknown, isBinary: boolean) => void)
    } else if (event === 'close') {
      this.#closeListeners.push(listener as () => void)
    } else {
      this.#errorListeners.push(listener as () => void)
    }
    return this
  }

  fail(): void {
    for (const listener of this.#errorListeners) {
      listener()
    }
  }

  receiveRaw(data: unknown, isBinary = false): void {
    for (const listener of this.#messageListeners) {
      listener(data, isBinary)
    }
  }

  receive(message: unknown): void {
    this.receiveRaw(Buffer.from(JSON.stringify(message)))
  }

  drop(): void {
    this.dropped = true
    for (const listener of this.#closeListeners) {
      listener()
    }
  }

  get isClosed(): boolean {
    return this.closedBy !== 'no' || this.dropped
  }

  last(type?: string): Record<string, unknown> | undefined {
    return this.sent.filter(message => type === undefined || message.t === type).at(-1)
  }

  of(type: string): Record<string, unknown>[] {
    return this.sent.filter(message => message.t === type)
  }
}

export class FakeRawSocket {
  written = ''
  destroyed = false

  end(data: string): void {
    this.written += data
  }

  destroy(): void {
    this.destroyed = true
  }
}

export interface PartEvent {
  readonly part: string
  readonly kind: 'message' | 'closed'
  readonly peerId: string
  readonly message?: unknown
}

export interface ServerOptions {
  readonly turnSecret?: string | null
  readonly throwing?: boolean
}

export class ServerHarness {
  readonly clock = new FakeClock()
  readonly events: PartEvent[] = []
  readonly ports = new Map<string, ServerPort>()
  readonly sockets: FakeServerSocket[] = []
  readonly server: TransportServer
  throwing = false

  constructor({turnSecret = null}: ServerOptions = {}) {
    const part = (name: string, version: number) => ({
      version,
      start: (port: ServerPort) => {
        this.ports.set(name, port)
        return {
          message: (peerId: string, message: unknown) => {
            this.events.push({part: name, kind: 'message', peerId, message})
            if (this.throwing) {
              throw new Error('part throws')
            }
          },
          closed: (peerId: string) => {
            this.events.push({part: name, kind: 'closed', peerId})
            if (this.throwing) {
              return Promise.reject(new Error('part rejects'))
            }
            return undefined
          }
        }
      }
    })
    this.server = createTransportServer({
      parts: {alpha: part('alpha', 1), beta: part('beta', 2)},
      upgrade: (_request, _socket, _head, done) => {
        const socket = new FakeServerSocket()
        this.sockets.push(socket)
        done(socket)
      },
      turnSecret,
      clock: this.clock
    })
  }

  port(name = 'alpha'): ServerPort {
    const port = this.ports.get(name)
    if (port === undefined) {
      throw new Error(`no part ${name}`)
    }
    return port
  }

  upgrade(
    origin: string | null = 'https://games.when.party',
    url = '/platform'
  ): {handled: boolean; raw: FakeRawSocket; socket: FakeServerSocket | null} {
    const raw = new FakeRawSocket()
    const before = this.sockets.length
    const request = {url, headers: origin === null ? {} : {origin}} as unknown as IncomingMessage
    const handled = this.server.handleUpgrade(request, raw as unknown as Duplex, Buffer.alloc(0))
    return {handled, raw, socket: this.sockets.length > before ? (this.sockets.at(-1) ?? null) : null}
  }

  accept(): FakeServerSocket {
    const {socket} = this.upgrade()
    if (socket === null) {
      throw new Error('refused')
    }
    return socket
  }

  open(modules: Record<string, number> = {alpha: 1}): {socket: FakeServerSocket; peerId: string} {
    const socket = this.accept()
    socket.receive({t: 'hello', v: 1, m: modules})
    const id = socket.last('id')
    if (id === undefined) {
      throw new Error('not opened')
    }
    return {socket, peerId: String(id.p)}
  }
}

export class Bridge {
  readonly server: ServerHarness
  readonly page: PageHarness
  readonly #pairs: {page: number; server: FakeServerSocket; toServer: number; toPage: number}[] = []

  constructor(server: ServerHarness, page: PageHarness) {
    this.server = server
    this.page = page
  }

  serverSocket(index = 0): FakeServerSocket {
    const pair = this.#pairs[index]
    if (pair === undefined) {
      throw new Error('no connection')
    }
    return pair.server
  }

  flush(): void {
    for (let moved = true; moved;) {
      moved = false
      while (this.#pairs.length < this.page.sockets.length) {
        this.#pairs.push({page: this.#pairs.length, server: this.server.accept(), toServer: 0, toPage: 0})
        this.page.sockets[this.#pairs.length - 1]?.open()
        moved = true
      }
      for (const pair of this.#pairs) {
        const pageSocket = this.page.sockets[pair.page]
        if (pageSocket === undefined) {
          continue
        }
        while (pair.toServer < pageSocket.sent.length) {
          pair.server.receive(pageSocket.sent[pair.toServer++])
          moved = true
        }
        while (pair.toPage < pair.server.sent.length) {
          pageSocket.receive(pair.server.sent[pair.toPage++])
          moved = true
        }
      }
    }
  }
}
