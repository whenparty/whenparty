import type {MessageAction} from '@trystero-p2p/ws-relay'
import {joinAfterLeave} from '../join-after-leave.ts'
import type {PageEvent, SessionRoom, Transport} from '../transport.ts'

type Handler = NonNullable<MessageAction<string>['onMessage']>

interface Peer {
  room: SessionRoom
  handlers: Map<string, Handler>
  onUnreachable: (peerId: string) => void
}

export interface FakeNetwork {
  transport: (selfId: string) => Transport
  connect: (first: string, second: string) => void
  cutLink: (first: string, second: string) => void
  detectLoss: (observer: string, peer: string) => void
  failConnection: (observer: string, peer: string) => void
  deliverNextBatch: () => Promise<void>
  deliverAll: () => Promise<void>
  page: (selfId: string, event: PageEvent) => void
}

const nextTurn = () => new Promise<void>(resolve => setImmediate(resolve))

export const createNetwork = (): FakeNetwork => {
  const peers = new Map<string, Peer>()
  const links = new Set<string>()
  const pageHooks = new Map<string, (event: PageEvent) => void>()
  let pendingDeliveries = 0
  const linked = (from: string, to: string) => links.has(`${from}>${to}`)
  const linkedPeers = (selfId: string) => [...peers.keys()].filter(id => linked(selfId, id))

  const enqueue = (deliver: () => void) => {
    pendingDeliveries++
    setImmediate(() => {
      try {
        deliver()
      } finally {
        pendingDeliveries--
      }
    })
  }

  const deliver = (from: string, to: string, namespace: string, data: string) =>
    enqueue(() => {
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

  const join = (selfId: string, onUnreachable: (peerId: string) => void): SessionRoom => {
    const handlers = new Map<string, Handler>()
    const room: SessionRoom = {
      makeAction: makeAction(selfId, handlers),
      onPeerJoin: null,
      onPeerLeave: null,
      getPeers: () => Object.fromEntries(linkedPeers(selfId).map(id => [id, {}])),
      leave: async () => {
        for (const peerId of linkedPeers(selfId)) {
          enqueue(() => {
            if (linked(selfId, peerId)) {
              links.delete(`${selfId}>${peerId}`)
              links.delete(`${peerId}>${selfId}`)
              peers.get(peerId)?.room.onPeerLeave?.(selfId)
            }
          })
        }

        await nextTurn()
      }
    }

    peers.set(selfId, {room, handlers, onUnreachable})
    return room
  }

  const transports = new Map<string, Transport>()
  const makeTransport = (selfId: string): Transport =>
    joinAfterLeave({
      selfId,
      join: (_appId, _code, onUnreachable) => join(selfId, onUnreachable),
      onPageEvent: callback => {
        pageHooks.set(selfId, callback)
        return () => pageHooks.delete(selfId)
      }
    })

  return {
    transport: selfId => transports.get(selfId) ?? transports.set(selfId, makeTransport(selfId)).get(selfId)!,
    connect: (first, second) => {
      links.add(`${first}>${second}`).add(`${second}>${first}`)
      peers.get(first)?.room.onPeerJoin?.(second)
      peers.get(second)?.room.onPeerJoin?.(first)
    },
    cutLink: (first, second) => {
      links.delete(`${first}>${second}`)
      links.delete(`${second}>${first}`)
    },
    detectLoss: (observer, peer) => peers.get(observer)?.room.onPeerLeave?.(peer),
    failConnection: (observer, peer) => peers.get(observer)?.onUnreachable(peer),
    page: (selfId, event) => pageHooks.get(selfId)?.(event),
    deliverNextBatch: nextTurn,
    deliverAll: async () => {
      for (let round = 0; round < 100; round++) {
        await nextTurn()
        if (pendingDeliveries === 0) {
          return
        }
      }
      throw new Error('Network did not settle after 100 message batches')
    }
  }
}
