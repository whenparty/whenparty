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
let turnHost = ''
let signaling: SignalingConnection | null = null
let peer: PeerConnection | null = null
let rtc: RTCPeerConnection | null = null
const allocating: RTCPeerConnection[] = []
const noAllocationErrors = new Set([486, 508])
let refusedAllocation = false

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

const refusesAllocation = async (credentials: Credentials): Promise<boolean> => {
  const connection = new RTCPeerConnection({
    iceServers: [{urls: `turn:${turnHost}:3478?transport=udp`, ...credentials}],
    iceTransportPolicy: 'relay'
  })
  allocating.push(connection)
  connection.createDataChannel('allocation')
  const refused = new Promise<boolean>(resolve => {
    connection.onicecandidateerror = event => noAllocationErrors.has(event.errorCode) && resolve(true)
    connection.onicecandidate = event => event.candidate?.type === 'relay' && resolve(false)
    connection.onicegatheringstatechange = () => connection.iceGatheringState === 'complete' && resolve(false)
  })
  await connection.setLocalDescription(await connection.createOffer())
  return refused
}

const harness = {
  open(options: PageOptions): void {
    turn = options.turn
    turnHost = options.turnHost
    const transport = createTransport({
      clock: systemClock,
      signalingUrl: options.signalingUrl,
      openSocket: url => new WebSocket(url) as unknown as SocketLike,
      createPeerConnection: ({iceServers}) => {
        const created = new RTCPeerConnection({
          iceServers: iceServersFor(options, iceServers),
          iceTransportPolicy: options.relayOnly ? 'relay' : 'all'
        })
        created.addEventListener('icecandidateerror', event => {
          refusedAllocation ||= noAllocationErrors.has(event.errorCode)
        })
        rtc = created
        return created as unknown as PeerConnectionLike
      },
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
  async useUpAllocations(credentials: Credentials, connections: number): Promise<boolean> {
    for (let opened = 0; opened < connections; opened++) {
      if (await refusesAllocation(credentials)) {
        return true
      }
    }
    return false
  },
  refusedWithOtherDescription: (): boolean => refusedAllocation && rtc?.remoteDescription != null,
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
