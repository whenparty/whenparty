import assert from 'node:assert/strict'
import {test} from 'node:test'
import {table} from './2-server-parts.states.ts'
import {ServerHarness, type FakeServerSocket, type PartEvent} from './fake-server.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']

class Scene {
  readonly h = new ServerHarness()
  socket: FakeServerSocket
  peerId = 'unknown-peer'
  sendResult: boolean | null = null
  eventsMark = 0
  sentMark = 0
  read = 0

  constructor(state: State, modules: Record<string, number> = {alpha: 1}) {
    if (state === 'opening') {
      this.socket = this.h.accept()
    } else {
      const opened = this.h.open(modules)
      this.socket = opened.socket
      this.peerId = opened.peerId
      if (state === 'closed') {
        this.socket.drop()
      }
    }
    this.eventsMark = this.h.events.length
    this.sentMark = this.socket.sent.length
  }

  get eventsSince(): PartEvent[] {
    return this.h.events.slice(this.eventsMark)
  }

  get sentSince(): Record<string, unknown>[] {
    return this.socket.sent.slice(this.sentMark)
  }
}

const events: {readonly [E in Event]: ((scene: Scene) => void) | null} = {
  'the server reads a module message from the connection': scene => scene.socket.receive({t: 'module', c: 'alpha', m: {x: 1}}),
  'a server part sends a module message to the peer ID of the connection, which has a channel of its module': scene =>
    void (scene.sendResult = scene.h.port('alpha').send(scene.peerId, {y: 1})),
  'a server part sends a module message to the peer ID of the connection, which has no channel of its module': scene =>
    void (scene.sendResult = scene.h.port('beta').send(scene.peerId, {y: 1})),
  'a server part sends a value that is not a module message': scene =>
    void (scene.sendResult = [Number.NaN, {toJSON: () => 1}].some(value => scene.h.port('alpha').send(scene.peerId, value))),
  'the connection closes with no message from it waiting unread': scene => {
    if (scene.peerId !== 'unknown-peer') {
      scene.socket.receive({t: 'module', c: 'alpha', m: 'before'})
      scene.read = 1
    }
    scene.socket.drop()
  },
  'the connection closes while messages from it wait unread': scene => {
    for (let index = 0; index < 203; index += 1) {
      scene.socket.receive(scene.peerId === 'unknown-peer' ? {t: 'answer', n: index} : {t: 'module', c: 'alpha', m: index})
    }
    scene.read = scene.peerId === 'unknown-peer' ? 0 : 199
    scene.socket.drop()
    scene.h.clock.advance(1_000)
  },
  'a handler of a server part throws or its promise rejects': scene => {
    scene.h.throwing = true
    if (scene.socket.isClosed) {
      const other = scene.h.open({alpha: 1, beta: 2})
      other.socket.drop()
      scene.peerId = other.peerId
    } else {
      scene.socket.receive({t: 'module', c: 'alpha', m: 1})
      scene.socket.receive({t: 'module', c: 'alpha', m: 2})
    }
  }
}

const expectEffect = (scene: Scene, outcome: Outcome): void => {
  const told = scene.eventsSince
  switch (outcome.effect) {
    case 'the server part gets it with the peer ID':
      assert.deepEqual(told, [{part: 'alpha', kind: 'message', peerId: scene.peerId, message: {x: 1}}])
      return
    case 'the page gets it':
      assert.equal(scene.sendResult, true)
      assert.deepEqual(scene.sentSince, [{t: 'module', c: 'alpha', m: {y: 1}}])
      return
    case 'sending fails':
      assert.equal(scene.sendResult, false)
      assert.deepEqual(scene.sentSince, [])
      return
    case 'the server drops it, telling the server part nothing':
    case 'the server drops it':
      assert.equal(scene.sendResult, true)
      assert.deepEqual(scene.sentSince, [])
      return
    case 'each server part with a channel on it is told once, after every message that the server read from it':
    case 'each server part with a channel on it is told once, after every message that the server read from it, and the unread ones are lost':
      assert.equal(told.length, scene.read + 1)
      assert.ok(told.slice(0, scene.read).every(event => event.kind === 'message' && event.part === 'alpha'))
      assert.deepEqual(told.at(-1), {part: 'alpha', kind: 'closed', peerId: scene.peerId})
      return
    case 'no server part is told':
      assert.deepEqual(told, [])
      return
    case 'it counts as delivered, and the transport goes on':
      if (told.some(event => event.kind === 'closed')) {
        assert.deepEqual(
          told.map(event => `${event.part}:${event.kind}`),
          ['alpha:closed', 'beta:closed']
        )
      } else {
        assert.deepEqual(
          told.map(event => event.message),
          [1, 2]
        )
      }
  }
}

for (const [state, cells] of Object.entries(table) as [State, Table[State]][]) {
  for (const [event, cell] of Object.entries(cells) as [Event, Table[State][Event]][]) {
    if (!('outcome' in cell)) {
      continue
    }
    test(`${cell.ids.join(' ')} ${state}: ${event}`, () => {
      const scene = new Scene(state)
      const run = events[event]
      assert.ok(run, `no scenario for ${event}`)
      run(scene)
      assert.equal(scene.socket.isClosed, cell.outcome.state === 'closed')
      expectEffect(scene, cell.outcome)
    })
  }
}

test('2-1 a server part gets the messages of a connection in the order the page sent them', () => {
  const h = new ServerHarness()
  const {socket, peerId} = h.open({alpha: 1, beta: 2})
  socket.receive({t: 'module', c: 'beta', m: 1})
  socket.receive({t: 'module', c: 'alpha', m: 2})
  socket.receive({t: 'module', c: 'beta', m: 3})
  assert.deepEqual(h.events, [
    {part: 'beta', kind: 'message', peerId, message: 1},
    {part: 'alpha', kind: 'message', peerId, message: 2},
    {part: 'beta', kind: 'message', peerId, message: 3}
  ])
})

test('2-2 a server part sending to a peer ID that no open connection has is dropped without telling it', () => {
  const h = new ServerHarness()
  assert.equal(h.port().send('nobody-has-this-peer-id', 1), true)
  assert.equal(h.port().send('nobody-has-this-peer-id', {a: 'x'.repeat(16_400)}), false)
})

test('2-4 the server does not wait for a promise that a handler of a server part returns', () => {
  const h = new ServerHarness()
  h.throwing = true
  const {socket} = h.open()
  socket.receive({t: 'module', c: 'alpha', m: 1})
  socket.drop()
  const second = h.open()
  second.socket.receive({t: 'module', c: 'alpha', m: 2})
  assert.deepEqual(
    h.events.map(event => event.kind),
    ['message', 'closed', 'message']
  )
})
