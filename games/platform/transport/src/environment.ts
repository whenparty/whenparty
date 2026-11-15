import {systemClock, type Clock} from './clock.ts'
import {signalingPath, type TurnServers} from './protocol.ts'

export interface SocketLike {
  onopen: (() => void) | null
  onmessage: ((event: {readonly data: unknown}) => void) | null
  onclose: (() => void) | null
  send(data: string): void
  close(): void
}

export interface DataChannelLike {
  readonly readyState: string
  binaryType: string
  onopen: (() => void) | null
  onclose: (() => void) | null
  onmessage: ((event: {readonly data: unknown}) => void) | null
  send(data: string | Uint8Array<ArrayBuffer>): void
  close(): void
}

export interface CandidateLike {
  readonly candidate: string
  readonly sdpMid?: string | null
  readonly sdpMLineIndex?: number | null
  readonly type?: string | null
}

export interface DescriptionLike {
  readonly type: string
  readonly sdp?: string
}

export interface StatsLike {
  forEach(callback: (stat: Record<string, unknown>) => void): void
  get(id: string): Record<string, unknown> | undefined
}

export interface PeerConnectionLike {
  readonly connectionState: string
  readonly sctp: {readonly maxMessageSize: number} | null
  onicecandidate: ((event: {readonly candidate: CandidateLike | null}) => void) | null
  onicecandidateerror: ((event: {readonly errorCode: number}) => void) | null
  onconnectionstatechange: (() => void) | null
  createDataChannel(label: string, options: {readonly negotiated: boolean; readonly id: number; readonly ordered: boolean}): DataChannelLike
  createOffer(): Promise<DescriptionLike>
  createAnswer(): Promise<DescriptionLike>
  setLocalDescription(description: DescriptionLike): Promise<void>
  setRemoteDescription(description: DescriptionLike): Promise<void>
  addIceCandidate(candidate: CandidateLike): Promise<void>
  getStats(): Promise<StatsLike>
  close(): void
}

export interface Environment {
  readonly clock: Clock
  readonly signalingUrl: string
  openSocket(url: string): SocketLike
  createPeerConnection(configuration: {readonly iceServers: readonly TurnServers[]}): PeerConnectionLike
  onPageHide(listener: () => void): void
}

const localHosts = new Set(['localhost', '127.0.0.1'])

export const signalingUrlFor = (hostname: string): string =>
  localHosts.has(hostname) ? `ws://localhost:8080${signalingPath}` : `wss://signaling.when.party${signalingPath}`

export const browserEnvironment = (): Environment => ({
  clock: systemClock,
  signalingUrl: signalingUrlFor(location.hostname),
  openSocket: url => new WebSocket(url) as unknown as SocketLike,
  createPeerConnection: configuration =>
    new RTCPeerConnection({
      iceServers: configuration.iceServers.map(server => ({...server, urls: [...server.urls]}))
    }) as unknown as PeerConnectionLike,
  onPageHide: listener => addEventListener('pagehide', listener)
})
