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
  // The page of a peer unloads, as on beforeunload or pagehide
  unload: (selfId: string) => void
  // How many times a peer sent on an action
  sends: (selfId: string, namespace: string) => number
}

const nextTurn = () => new Promise<void>(resolve => setImmediate(resolve))

export const createNetwork = (): FakeNetwork => {
  const peers = new Map<string, Peer>()
  const links = new Set<string>()
  const unloadHooks = new Map<string, () => void>()
  const sendCounts = new Map<string, number>()
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
        const key = `${selfId}:${namespace}`
        sendCounts.set(key, (sendCounts.get(key) ?? 0) + 1)
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
      // Like Trystero's leave message: the others hear of it after what was sent before it
      leave: async () => {
        for (const peerId of linkedPeers(selfId)) {
          setImmediate(() => {
            if (linked(selfId, peerId)) {
              links.delete(`${selfId}>${peerId}`)
              links.delete(`${peerId}>${selfId}`)
              peers.get(peerId)?.room.onPeerLeave?.(selfId)
            }
          })
        }
      }
    }

    peers.set(selfId, {room, handlers})
    return room
  }

  return {
    transport: selfId => ({
      selfId,
      join: () => join(selfId),
      onUnload: callback => {
        unloadHooks.set(selfId, callback)
        return () => unloadHooks.delete(selfId)
      }
    }),
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
    unload: selfId => unloadHooks.get(selfId)?.(),
    sends: (selfId, namespace) => sendCounts.get(`${selfId}:${namespace}`) ?? 0,
    settle: async () => {
      for (let round = 0; round < 20; round++) {
        await nextTurn()
      }
    }
  }
}
