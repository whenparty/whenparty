// An in-memory stand-in for Trystero rooms, so session.ts can be tested without WebRTC. Like real
// links, cutting one and noticing it are separate: a peer can look present after its link is gone.
import type {MessageAction} from '@trystero-p2p/ws-relay'
import type {SessionRoom, Transport} from '../session.ts'

type Handler = NonNullable<MessageAction<string>['onMessage']>

interface Peer {
  room: SessionRoom
  handlers: Map<string, Handler>
}

export interface FakeNetwork {
  transport: (selfId: string) => Transport
  // Links two peers, and each sees the other join
  connect: (first: string, second: string) => void
  // Stops messages between two peers without telling either of them
  cut: (first: string, second: string) => void
  // The observer notices that its link to the peer is gone
  notice: (observer: string, peer: string) => void
  // Lets every message in flight arrive, including the ones they cause
  settle: () => Promise<void>
}

const nextTurn = () => new Promise<void>(resolve => setImmediate(resolve))

export const createNetwork = (): FakeNetwork => {
  const peers = new Map<string, Peer>()
  const links = new Set<string>()
  const linked = (from: string, to: string) => links.has(`${from}>${to}`)
  const linkedPeers = (selfId: string) => [...peers.keys()].filter(id => linked(selfId, id))

  const deliver = (from: string, to: string, namespace: string, data: string) =>
    setImmediate(() => {
      if (linked(from, to)) {
        void peers.get(to)?.handlers.get(namespace)?.(data, {peerId: from})
      }
    })

  const makeAction = (selfId: string, handlers: Map<string, Handler>) => (namespace: string) => {
    const action: MessageAction<string> = {
      send: async (data, options) => {
        const target = options?.target
        const targets = target ? [target].flat() : linkedPeers(selfId)
        targets.forEach(to => deliver(selfId, to, namespace, data))
      },
      get onMessage() {
        return handlers.get(namespace) ?? null
      },
      set onMessage(handler: Handler | null) {
        if (handler) {
          handlers.set(namespace, handler)
        }
      },
      onReceiveProgress: null,
      onReceive: null
    }

    return action
  }

  const join = (selfId: string): SessionRoom => {
    const handlers = new Map<string, Handler>()
    const room: SessionRoom = {
      makeAction: makeAction(selfId, handlers),
      onPeerJoin: null,
      onPeerLeave: null,
      getPeers: () => Object.fromEntries(linkedPeers(selfId).map(id => [id, {}])),
      leave: async () => {
        peers.delete(selfId)
      }
    }

    peers.set(selfId, {room, handlers})
    return room
  }

  return {
    transport: selfId => ({selfId, join: () => join(selfId)}),
    connect: (first, second) => {
      links.add(`${first}>${second}`).add(`${second}>${first}`)
      peers.get(first)?.room.onPeerJoin?.(second)
      peers.get(second)?.room.onPeerJoin?.(first)
    },
    cut: (first, second) => {
      links.delete(`${first}>${second}`)
      links.delete(`${second}>${first}`)
    },
    notice: (observer, peer) => peers.get(observer)?.room.onPeerLeave?.(peer),
    settle: async () => {
      for (let round = 0; round < 20; round++) {
        await nextTurn()
      }
    }
  }
}
