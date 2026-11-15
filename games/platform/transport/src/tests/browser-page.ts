import type {PeerConnectionLike, SocketLike} from '../environment.ts'
import {
  createTransport,
  systemClock,
  type Path,
  type PeerConnection,
  type PeerHandlers,
  type PeerReason,
  type SignalingConnection
} from '../index.ts'
import type {TurnServers} from '../protocol.ts'

export interface Credentials {
  readonly username: string
  readonly credential: string
}

export type Turn = 'from server' | 'none' | Credentials

export interface PageOptions {
  readonly signalingUrl: string
  readonly turnHost: string
  readonly relayOnly: boolean
  readonly turn: Turn
}

export type Notice =
  | {readonly kind: 'open' | 'path'; readonly path: Path; readonly roundTripMs: number | null}
  | {readonly kind: 'text'; readonly text: string}
  | {readonly kind: 'closed'; readonly reason: PeerReason}

const notices: Notice[] = []
let turn: Turn = 'from server'
let signaling: SignalingConnection | null = null
let peer: PeerConnection | null = null

const handlers: PeerHandlers = {
  open: (path, roundTripMs) => notices.push({kind: 'open', path, roundTripMs}),
  path: (path, roundTripMs) => notices.push({kind: 'path', path, roundTripMs}),
  text: text => notices.push({kind: 'text', text}),
  closed: closing => notices.push({kind: 'closed', reason: closing.reason})
}

const iceServersFor = (options: PageOptions, servers: readonly TurnServers[]): RTCIceServer[] => {
  if (turn === 'none') {
    return []
  }
  const credentials = turn
  return servers.map(server => ({
    urls: server.urls.map(url => url.replace('turn.when.party', options.turnHost)),
    ...(credentials === 'from server' ? {username: server.username, credential: server.credential} : credentials)
  }))
}

const harness = {
  open(options: PageOptions): void {
    turn = options.turn
    const transport = createTransport({
      clock: systemClock,
      signalingUrl: options.signalingUrl,
      openSocket: url => new WebSocket(url) as unknown as SocketLike,
      createPeerConnection: ({iceServers}) =>
        new RTCPeerConnection({
          iceServers: iceServersFor(options, iceServers),
          iceTransportPolicy: options.relayOnly ? 'relay' : 'all'
        }) as unknown as PeerConnectionLike,
      onPageHide: listener => addEventListener('pagehide', listener)
    })
    signaling = transport.openSignaling({})
    signaling.setIncoming(incoming => {
      peer = incoming
      incoming.handlers = handlers
    })
  },
  useTurn(used: Turn): void {
    turn = used
  },
  peerId: (): string | null => (signaling?.state === 'open' ? signaling.peerId : null),
  allow: (peerId: string): Promise<boolean> => signaling?.allow(peerId) ?? Promise.resolve(false),
  connect(peerId: string): void {
    peer = signaling?.connect(peerId, handlers) ?? null
  },
  send: (text: unknown): boolean => peer?.send(text) ?? false,
  close: (): void => peer?.close(),
  state: (): string | null => peer?.state ?? null,
  notices: (): readonly Notice[] => notices
}

export type Harness = typeof harness

declare global {
  var harness: Harness
}

globalThis.harness = harness
