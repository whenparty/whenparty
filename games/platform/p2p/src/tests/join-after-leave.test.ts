import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import type {MessageAction} from '@trystero-p2p/ws-relay'
import {joinAfterLeave, joinWhenReady} from '../join-after-leave.ts'
import type {SessionRoom, Transport} from '../transport.ts'

type Handler = NonNullable<MessageAction<string>['onMessage']>
const createTransport = () => {
  const joins: string[] = []
  const rooms: Array<{room: SessionRoom; handlers: Map<string, Handler>; finishLeave: (error?: Error) => void}> = []

  const transport: Transport = {
    selfId: 'self',
    join: (appId, code) => {
      joins.push(`${appId}/${code}`)
      const handlers = new Map<string, Handler>()
      let finish: (error?: Error) => void = () => {}
      const left = new Promise<void>((resolve, reject) => (finish = error => (error ? reject(error) : resolve())))
      const room: SessionRoom = {
        onPeerJoin: null,
        onPeerLeave: null,
        getPeers: () => ({peer: {}}),
        makeAction: namespace => ({
          send: async () => {},
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
        }),
        leave: () => left
      }
      rooms.push({room, handlers, finishLeave: finish})
      return room
    }
  }

  return {transport: joinAfterLeave(transport), joins, rooms}
}

const nextTurn = () => new Promise<void>(resolve => setImmediate(resolve))

describe('joinAfterLeave', () => {
  it('joins at once a room the tab is not leaving', () => {
    const {transport, joins} = createTransport()

    transport.join('game', 'A', () => {})
    transport.join('game', 'B', () => {})

    assert.deepEqual(joins, ['game/A', 'game/B'])
  })

  it('joins a room again only once the tab has left it, and passes its events on', async () => {
    const {transport, joins, rooms} = createTransport()
    const first = transport.join('game', 'A', () => {})
    void first.leave()

    const second = transport.join('game', 'A', () => {})
    const joined: string[] = []
    const messages: string[] = []
    second.onPeerJoin = peerId => joined.push(peerId)
    second.makeAction('move').onMessage = data => void messages.push(data)
    await nextTurn()

    assert.deepEqual(joins, ['game/A'])
    assert.deepEqual(second.getPeers(), {})

    rooms[0]?.finishLeave()
    await nextTurn()
    rooms[1]?.room.onPeerJoin?.('peer')
    void rooms[1]?.handlers.get('move')?.('e4', {peerId: 'peer'})

    assert.deepEqual(joins, ['game/A', 'game/A'])
    assert.deepEqual(joined, ['peer'])
    assert.deepEqual(messages, ['e4'])
    assert.deepEqual(second.getPeers(), {peer: {}})
  })

  it('never joins a waiting room that is left first', async () => {
    const {transport, joins, rooms} = createTransport()
    void transport.join('game', 'A', () => {}).leave()
    void transport.join('game', 'A', () => {}).leave()

    rooms[0]?.finishLeave()
    await nextTurn()

    assert.deepEqual(joins, ['game/A'])
  })

  it('joins again after a leave that failed', async () => {
    const {transport, joins, rooms} = createTransport()
    transport
      .join('game', 'A', () => {})
      .leave()
      .catch(() => {})

    transport.join('game', 'A', () => {})
    rooms[0]?.finishLeave(new Error('network'))
    await nextTurn()

    assert.deepEqual(joins, ['game/A', 'game/A'])
  })
})

describe('joinWhenReady', () => {
  it('joins with the value it waited for', async () => {
    const {transport, joins} = createTransport()
    const joinedWith: string[][] = []
    const room = joinWhenReady(Promise.resolve(['turn:turn.example:3478']), turnConfig => {
      joinedWith.push(turnConfig)
      return transport.join('game', 'A', () => {})
    })

    assert.deepEqual(room.getPeers(), {})
    await nextTurn()

    assert.deepEqual(joinedWith, [['turn:turn.example:3478']])
    assert.deepEqual(joins, ['game/A'])
  })
})
