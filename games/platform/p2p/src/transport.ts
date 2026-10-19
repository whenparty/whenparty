// What a session needs from the network, and what the browser's page tells it. The browser gets
// trystero-transport.ts; tests pass an in-memory one (tests/fake-network.ts).
import type {MessageAction} from '@trystero-p2p/ws-relay'

// The parts of a Trystero room a session uses
export interface SessionRoom {
  makeAction: (namespace: string) => MessageAction<string>
  onPeerJoin: ((peerId: string) => void) | null
  onPeerLeave: ((peerId: string) => void) | null
  getPeers: () => Record<string, unknown>
  leave: () => Promise<void>
}

// How a session reaches the other peers. Tests pass an in-memory one.
export interface Transport {
  selfId: string
  // onUnreachable: a peer the signaling server found could not be connected to
  join: (appId: string, code: string, onUnreachable: (peerId: string) => void) => SessionRoom
  isSignalingOpen?: () => boolean
  // Calls back on the page's lifecycle events, and returns how to stop
  onPageEvent?: (callback: (event: PageEvent) => void) => () => void
}

// leaving: beforeunload. The page may still stay: the user can cancel, and a slow navigation
// keeps it a while. gone: pagehide, the page goes away or into the back-forward cache. Mobile
// browsers often skip beforeunload (iOS Safari always does), but fire pagehide. shown: the page
// is back from the back-forward cache. away and back: the page was hidden (minimized, another tab
// or app, the screen off) and shown again. A hidden page keeps running, but a phone soon freezes
// it, and its links drop.
export type PageEvent = 'leaving' | 'gone' | 'shown' | 'away' | 'back'
