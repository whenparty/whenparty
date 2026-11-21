import type {IncomingMessage} from 'node:http'
import type {Duplex} from 'node:stream'
import {systemClock, type Clock} from '../clock.ts'
import {callSafely} from '../handlers.ts'
import {signalingPath, transportVersion, type Older, type ServerMessage} from '../protocol.ts'
import {isModuleMessage, randomId} from '../values.ts'
import type {ServerPartHandlers, ServerPort, ServerSocket, TransportServer, TransportServerOptions, Upgrade} from './api.ts'
import {Calls, type Hub} from './calls.ts'
import {isAllowedOrigin} from './origin.ts'
import {turnCredentials} from './turn.ts'

const maxConnections = 250
const messageBytes = 65_536
const unsentBytes = 262_144
const versionsMs = 10_000
const checkEveryMs = 15_000
const budgetSize = 200
const regainMs = 50
const listSize = 64

type Fields = {readonly [key: string]: unknown}

const isFields = (value: unknown): value is Fields => typeof value === 'object' && value !== null && !Array.isArray(value)

const fatalDecoder = new TextDecoder('utf-8', {fatal: true})

const bytesOf = (data: unknown): Uint8Array | null => {
  if (data instanceof Uint8Array) {
    return data
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }
  if (Array.isArray(data) && data.every(part => part instanceof Uint8Array)) {
    const parts = data as Uint8Array[]
    const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
    let offset = 0
    for (const part of parts) {
      bytes.set(part, offset)
      offset += part.length
    }
    return bytes
  }
  return null
}

const textOf = (data: unknown, isBinary: boolean): string | null => {
  if (isBinary) {
    return null
  }
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : bytesOf(data)
  if (bytes === null || bytes.length > messageBytes) {
    return null
  }
  try {
    return fatalDecoder.decode(bytes)
  } catch {
    return null
  }
}

const refuse = (socket: Duplex, status: 403 | 503): void => {
  socket.end(`HTTP/1.1 ${status} ${status === 403 ? 'Forbidden' : 'Service Unavailable'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  socket.destroy()
}

class Connection {
  state: 'opening' | 'open' | 'closed' = 'opening'
  peerId: string | null = null
  modules: ReadonlySet<string> = new Set()
  readonly list = new Set<string>()
  readonly socket: ServerSocket
  budget = budgetSize
  regainedAt: number
  readonly unread: [unknown, boolean][] = []
  checksSent = 0
  lastAnswered = 0
  versionsTimer: unknown = null
  checkTimer: unknown = null
  regainTimer: unknown = null

  constructor(socket: ServerSocket, now: number) {
    this.socket = socket
    this.regainedAt = now
  }
}

class Server implements TransportServer, Hub<Connection> {
  readonly clock: Clock
  readonly #upgrade: Upgrade
  readonly #turnSecret: string | null
  readonly #versions: ReadonlyMap<string, number>
  readonly #parts = new Map<string, ServerPartHandlers>()
  readonly #connections = new Set<Connection>()
  readonly #byPeer = new Map<string, Connection>()
  readonly #calls: Calls<Connection>

  constructor({parts, upgrade, turnSecret = null, clock = systemClock}: TransportServerOptions) {
    this.clock = clock
    this.#upgrade = upgrade
    this.#turnSecret = turnSecret
    this.#versions = new Map(Object.entries(parts).map(([name, part]) => [name, part.version]))
    this.#calls = new Calls(this)
    for (const [name, part] of Object.entries(parts)) {
      this.#parts.set(name, part.start(this.#port(name)))
    }
  }

  #port(name: string): ServerPort {
    return {
      send: (peerId, message) => {
        if (!isModuleMessage(message)) {
          return false
        }
        const connection = this.openParty(peerId)
        if (connection?.modules.has(name)) {
          this.post(connection, {t: 'module', c: name, m: message})
        }
        return true
      },
      allow: (listOf, peerId) => this.#changeList(listOf, peerId, true),
      disallow: (listOf, peerId) => this.#changeList(listOf, peerId, false)
    }
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    if ((request.url ?? '/').split('?')[0] !== signalingPath) {
      return false
    }
    if (!isAllowedOrigin(request.headers.origin)) {
      refuse(socket, 403)
    } else if (this.#connections.size >= maxConnections) {
      refuse(socket, 503)
    } else {
      this.#upgrade(request, socket, head, accepted => this.#accept(accepted))
    }
    return true
  }

  close(): void {
    for (const connection of [...this.#connections]) {
      this.#close(connection)
    }
    this.#calls.clear()
  }

  openParty(peerId: string): Connection | undefined {
    const connection = this.#byPeer.get(peerId)
    return connection?.state === 'open' ? connection : undefined
  }

  post(connection: Connection, message: ServerMessage): void {
    if (connection.state === 'closed') {
      return
    }
    connection.socket.send(JSON.stringify(message))
    if (connection.socket.bufferedAmount > unsentBytes) {
      this.#close(connection, true)
    }
  }

  #accept(socket: ServerSocket): void {
    const connection = new Connection(socket, this.clock.now())
    this.#connections.add(connection)
    socket.on('message', (data, isBinary) => this.#arrived(connection, data, isBinary))
    socket.on('close', () => this.#close(connection))
    socket.on('error', () => this.#close(connection, true))
    connection.versionsTimer = this.clock.setTimeout(() => {
      if (connection.state === 'opening') {
        this.#close(connection)
      }
    }, versionsMs)
  }

  #regain(connection: Connection): void {
    const now = this.clock.now()
    const regained = Math.floor((now - connection.regainedAt) / regainMs)
    connection.budget = Math.min(budgetSize, connection.budget + regained)
    connection.regainedAt = connection.budget === budgetSize ? now : connection.regainedAt + regained * regainMs
  }

  #arrived(connection: Connection, data: unknown, isBinary: boolean): void {
    if (connection.state === 'closed') {
      return
    }
    if (connection.unread.length === 0) {
      this.#regain(connection)
      if (connection.budget >= 1) {
        connection.budget -= 1
        this.#read(connection, data, isBinary)
        return
      }
      connection.socket.pause()
      this.#waitToRead(connection)
    }
    connection.unread.push([data, isBinary])
  }

  #waitToRead(connection: Connection): void {
    connection.regainTimer = this.clock.setTimeout(
      () => {
        this.#regain(connection)
        while (connection.state !== 'closed' && connection.budget >= 1 && connection.unread.length > 0) {
          const [data, isBinary] = connection.unread.shift() as [unknown, boolean]
          connection.budget -= 1
          this.#read(connection, data, isBinary)
        }
        if (connection.state === 'closed') {
          return
        }
        if (connection.unread.length > 0) {
          this.#waitToRead(connection)
        } else {
          connection.socket.resume()
        }
      },
      Math.max(0, connection.regainedAt + regainMs - this.clock.now())
    )
  }

  #read(connection: Connection, data: unknown, isBinary: boolean): void {
    const text = textOf(data, isBinary)
    let message: unknown
    try {
      message = text === null ? null : JSON.parse(text)
    } catch {
      message = null
    }
    if (!isFields(message) || !this.#handle(connection, message)) {
      this.#close(connection)
    }
  }

  #handle(connection: Connection, message: Fields): boolean {
    if (message.t === 'answer') {
      if (!Number.isInteger(message.n)) {
        return false
      }
      connection.lastAnswered = Math.max(connection.lastAnswered, Math.min(Number(message.n), connection.checksSent))
      return true
    }
    if (connection.state === 'opening') {
      return message.t === 'hello' && this.#hello(connection, message)
    }
    switch (message.t) {
      case 'module':
        return this.#module(connection, message)
      case 'list':
        return this.#list(connection, message)
      case 'turn':
        return this.#turn(connection, message)
      case 'call':
        return this.#calls.call(connection, message)
      case 'signal':
        return this.#calls.signal(connection, message)
      case 'close':
        return this.#calls.closing(connection, message)
      default:
        return false
    }
  }

  #hello(connection: Connection, message: Fields): boolean {
    const {v, m} = message
    if (!Number.isInteger(v) || !isFields(m) || !Object.values(m).every(version => Number.isInteger(version))) {
      return false
    }
    const older = this.#older(Number(v), m as {readonly [module: string]: number})
    if (older !== null) {
      this.post(connection, {t: 'outdated', older})
      this.#close(connection)
      return true
    }
    let peerId = randomId()
    while (this.#byPeer.has(peerId)) {
      peerId = randomId()
    }
    this.clock.clearTimeout(connection.versionsTimer)
    connection.state = 'open'
    connection.peerId = peerId
    connection.modules = new Set(Object.keys(m))
    this.#byPeer.set(peerId, connection)
    this.#scheduleCheck(connection)
    this.post(connection, {t: 'id', p: peerId})
    return true
  }

  #older(version: number, modules: {readonly [module: string]: number}): Older | null {
    if (version !== transportVersion) {
      return version < transportVersion ? 'page' : 'server'
    }
    for (const name of Object.keys(modules).sort()) {
      const own = this.#versions.get(name)
      const theirs = modules[name] as number
      if (own === undefined) {
        return 'server'
      }
      if (theirs !== own) {
        return theirs < own ? 'page' : 'server'
      }
    }
    return null
  }

  #scheduleCheck(connection: Connection): void {
    connection.checkTimer = this.clock.setTimeout(() => {
      if (connection.state !== 'open') {
        return
      }
      if (connection.checksSent >= 2 && connection.lastAnswered < connection.checksSent - 1) {
        this.#close(connection, true)
        return
      }
      connection.checksSent += 1
      this.#scheduleCheck(connection)
      this.post(connection, {t: 'check', n: connection.checksSent})
    }, checkEveryMs)
  }

  #module(connection: Connection, message: Fields): boolean {
    const {c, m} = message
    if (typeof c !== 'string' || !connection.modules.has(c) || !isModuleMessage(m)) {
      return false
    }
    callSafely(() => this.#parts.get(c)?.message?.(connection.peerId as string, m))
    return true
  }

  #list(connection: Connection, message: Fields): boolean {
    const {r, p, add} = message
    if (!Number.isInteger(r) || typeof p !== 'string' || typeof add !== 'boolean') {
      return false
    }
    this.post(connection, {t: 'list', r: Number(r), ok: this.#changeList(connection.peerId as string, p, add)})
    return true
  }

  #changeList(listOf: string, peerId: string, add: boolean): boolean {
    const connection = this.openParty(listOf)
    if (connection === undefined || typeof peerId !== 'string') {
      return false
    }
    if (!add) {
      connection.list.delete(peerId)
      return true
    }
    if (connection.list.has(peerId)) {
      return true
    }
    if (connection.list.size >= listSize || this.openParty(peerId) === undefined) {
      return false
    }
    connection.list.add(peerId)
    return true
  }

  #turn(connection: Connection, message: Fields): boolean {
    const {r} = message
    if (!Number.isInteger(r)) {
      return false
    }
    const servers = this.#turnSecret === null ? null : turnCredentials(this.#turnSecret, this.clock.now())
    this.post(connection, {t: 'turn', r: Number(r), s: servers})
    return true
  }

  #close(connection: Connection, abruptly = false): void {
    if (connection.state === 'closed') {
      return
    }
    const peerId = connection.state === 'open' ? connection.peerId : null
    connection.state = 'closed'
    connection.unread.length = 0
    for (const timer of [connection.versionsTimer, connection.checkTimer, connection.regainTimer]) {
      this.clock.clearTimeout(timer)
    }
    this.#connections.delete(connection)
    if (abruptly) {
      connection.socket.terminate()
    } else {
      connection.socket.close()
    }
    if (peerId === null) {
      return
    }
    this.#byPeer.delete(peerId)
    for (const other of this.#connections) {
      other.list.delete(peerId)
    }
    this.#calls.disconnected(connection)
    for (const [name, handlers] of this.#parts) {
      if (connection.modules.has(name)) {
        callSafely(() => handlers.closed?.(peerId))
      }
    }
  }
}

export const createTransportServer = (options: TransportServerOptions): TransportServer => new Server(options)
