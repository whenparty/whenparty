// The Transport the browser uses: Trystero over our signaling server, with our TURN servers for
// peers it can't reach directly, and the page's lifecycle events from the window.
import {getRelaySockets, joinRoom, selfId} from '@trystero-p2p/ws-relay'
import {joinAfterLeave, joinWhenReady} from './join-after-leave.ts'
import {signalingUrlFor, turnCredentialsUrlFor} from './signaling-url.ts'
import type {PageEvent, Transport} from './transport.ts'
import {turnServerLoader, type TurnServer} from './turn-servers.ts'

// Calls back on the lifecycle events of the page, until the returned function stops it.
// isHidden reads the page's visibility (document.visibilityState).
export const onPageEvents =
  (page: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>, isHidden: () => boolean) =>
  (callback: (event: PageEvent) => void): (() => void) => {
    const listeners: Record<string, (event: Event) => void> = {
      beforeunload: () => callback('leaving'),
      pagehide: () => callback('gone'),
      pageshow: event => {
        if ((event as PageTransitionEvent).persisted) {
          callback('shown')
        }
      },
      // Fired at the document, and it bubbles up to the window
      visibilitychange: () => callback(isHidden() ? 'away' : 'back')
    }

    Object.entries(listeners).forEach(([type, listener]) => page.addEventListener(type, listener))
    return () => Object.entries(listeners).forEach(([type, listener]) => page.removeEventListener(type, listener))
  }

let loadTurnServers: (() => Promise<TurnServer[]>) | null = null

// Each room joins once the TURN servers are known, so that a peer it can't reach directly can be
// reached through them. That waits for one request at most, and only for the first room or after
// the credentials' half-life.
export const trystero: Transport = joinAfterLeave({
  selfId,
  join: (appId, code, onUnreachable) => {
    loadTurnServers ??= turnServerLoader(turnCredentialsUrlFor(location.hostname))

    return joinWhenReady(loadTurnServers(), turnConfig =>
      joinRoom({appId, relayConfig: {urls: [signalingUrlFor(location.hostname)]}, turnConfig}, code, {
        onJoinError: ({peerId, error}) => {
          console.warn('p2p:', error)
          onUnreachable(peerId)
        }
      })
    )
  },
  isSignalingOpen: () =>
    Object.values(getRelaySockets() as Record<string, WebSocket>).some(socket => socket.readyState === WebSocket.OPEN),
  onPageEvent: onPageEvents(globalThis, () => document.visibilityState === 'hidden')
})
