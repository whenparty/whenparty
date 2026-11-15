import type {IncomingMessage} from 'node:http'
import type {Duplex} from 'node:stream'
import type {Clock} from '../clock.ts'
import type {ModuleMessage} from '../values.ts'

export interface ServerPort {
  send(peerId: string, message: unknown): boolean
  allow(listOf: string, peerId: string): boolean
  disallow(listOf: string, peerId: string): boolean
}

export interface ServerPartHandlers {
  message?(peerId: string, message: ModuleMessage): unknown
  closed?(peerId: string): unknown
}

export interface ServerPart {
  readonly version: number
  start(port: ServerPort): ServerPartHandlers
}

export interface ServerSocket {
  readonly bufferedAmount: number
  send(data: string): void
  close(): void
  terminate(): void
  pause(): void
  resume(): void
  on(event: 'message', listener: (data: unknown, isBinary: boolean) => void): unknown
  on(event: 'close' | 'error', listener: () => void): unknown
}

export type Upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer, done: (socket: ServerSocket) => void) => void

export interface TransportServerOptions {
  readonly parts: {readonly [module: string]: ServerPart}
  readonly upgrade: Upgrade
  readonly turnSecret?: string | null
  readonly clock?: Clock
}

export interface TransportServer {
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): boolean
  close(): void
}
