import type {Older} from './protocol.ts'
import type {ModuleMessage} from './values.ts'

export type SignalingState = 'opening' | 'open' | 'closed'

export type SignalingClosing =
  | {readonly reason: 'offline'; readonly lastArrivalAt: number}
  | {readonly reason: 'outdated'; readonly older: Older; readonly lastArrivalAt: number}

export interface ChannelHandlers {
  open?(peerId: string): unknown
  message?(message: ModuleMessage): unknown
  closed?(closing: SignalingClosing): unknown
}

export interface ModuleChannel {
  readonly version: number
  readonly handlers: ChannelHandlers
}

export type IncomingHandler = (peer: PeerConnection, callerPeerId: string) => unknown

export interface SignalingConnection {
  readonly state: SignalingState
  readonly peerId: string | null
  send(module: string, message: unknown): boolean
  allow(peerId: string): Promise<boolean>
  disallow(peerId: string): Promise<boolean>
  setIncoming(handler: IncomingHandler): boolean
  connect(peerId: string, handlers?: PeerHandlers): PeerConnection
  close(): void
}

export type PeerState = 'connecting' | 'channel' | 'open' | 'closed'

export type PeerReason =
  'offline' | 'peer offline' | 'no peer' | 'busy' | 'timeout' | 'no relay' | 'failed' | 'too small' | 'closed' | 'broken'

export type Path = 'direct' | 'turn'

export interface PeerClosing {
  readonly reason: PeerReason
  readonly lastArrivalAt: number
}

export interface PeerHandlers {
  open?(path: Path, roundTripMs: number | null): unknown
  text?(text: string): unknown
  path?(path: Path, roundTripMs: number | null): unknown
  closed?(closing: PeerClosing): unknown
}

export interface PeerConnection {
  readonly state: PeerState
  readonly peerId: string
  handlers: PeerHandlers
  send(text: unknown): boolean
  close(): void
}

export interface Transport {
  openSignaling(modules: {readonly [module: string]: ModuleChannel}): SignalingConnection
}
