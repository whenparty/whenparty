// Trystero leaves a room in steps: it says goodbye, waits 99 ms, then closes the room's links. It
// shares links between rooms with the same peers, so it would also close the links of the same room
// joined again meanwhile, and that room would stay without peers. joinAfterLeave wraps a transport
// so that it joins a room only once the tab has left it, with a stand-in room until then.
import type {MessageAction} from '@trystero-p2p/ws-relay'
import type {SessionRoom, Transport} from './session.ts'

// The room as the session sees it, with leave() replaced
const withLeave = (room: SessionRoom, leave: () => Promise<void>): SessionRoom => ({
  makeAction: namespace => room.makeAction(namespace),
  getPeers: () => room.getPeers(),
  get onPeerJoin() {
    return room.onPeerJoin
  },
  set onPeerJoin(handler) {
    room.onPeerJoin = handler
  },
  get onPeerLeave() {
    return room.onPeerLeave
  },
  set onPeerLeave(handler) {
    room.onPeerLeave = handler
  },
  leave
})

// A room that joins with ready's value once it settles, unless it is left first. Until then it has
// no peers and sends nothing. Once joined, the real room's events reach the handlers set on this
// one. Also used to join only once the TURN servers are known (see session.ts).
export const joinWhenReady = <T>(ready: Promise<T>, join: (value: T) => SessionRoom): SessionRoom => {
  let real: SessionRoom | null = null
  let left = false
  const actions = new Map<string, MessageAction<string>>()
  const realActions = new Map<string, MessageAction<string>>()

  const room: SessionRoom = {
    onPeerJoin: null,
    onPeerLeave: null,
    getPeers: () => real?.getPeers() ?? {},
    makeAction: namespace => {
      if (real) {
        return real.makeAction(namespace)
      }

      const action: MessageAction<string> = {
        send: async (data, options) => realActions.get(namespace)?.send(data, options),
        onMessage: null,
        onReceiveProgress: null,
        onReceive: null
      }
      actions.set(namespace, action)
      return action
    },
    leave: async () => {
      left = true
      await real?.leave()
    }
  }

  void ready.then(value => {
    if (left) {
      return
    }

    const joined = join(value)
    joined.onPeerJoin = peerId => room.onPeerJoin?.(peerId)
    joined.onPeerLeave = peerId => room.onPeerLeave?.(peerId)
    actions.forEach((action, namespace) => {
      const realAction = joined.makeAction(namespace)
      realAction.onMessage = (data, context) => action.onMessage?.(data, context)
      realActions.set(namespace, realAction)
    })
    real = joined
  })

  return room
}

export const joinAfterLeave = (transport: Transport): Transport => {
  // Rooms this tab is leaving, until it has left them
  const leaving = new Map<string, Promise<void>>()

  return {
    ...transport,
    join: (appId, code, onUnreachable) => {
      const key = `${appId}\n${code}`
      const pending = leaving.get(key)
      const join = () => transport.join(appId, code, onUnreachable)
      const room = pending ? joinWhenReady(pending, join) : join()

      return withLeave(room, () => {
        const leave = room.leave()
        // Settled either way, so a failed leave never keeps the room from being joined again
        const left: Promise<void> = Promise.allSettled([leaving.get(key), leave]).then(() => {
          if (leaving.get(key) === left) {
            leaving.delete(key)
          }
        })

        leaving.set(key, left)
        return leave
      })
    }
  }
}
