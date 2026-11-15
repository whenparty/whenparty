import assert from 'node:assert/strict'
import {test} from 'node:test'
import {isAllowedOrigin} from '../server/origin.ts'
import {start, table} from './7-server.states.ts'
import {ServerHarness, type FakeServerSocket} from './fake-server.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']
type StartEvent = keyof typeof start

class Scene {
  readonly h = new ServerHarness()
  socket: FakeServerSocket
  sentMark = 0
  eventsMark = 0

  constructor(state: State) {
    if (state === 'opening') {
      this.socket = this.h.accept()
    } else {
      this.socket = this.h.open().socket
      if (state === 'closed') {
        this.h.server.close()
      }
    }
    this.sentMark = this.socket.sent.length
    this.eventsMark = this.h.events.length
  }

  get sentSince(): Record<string, unknown>[] {
    return this.socket.sent.slice(this.sentMark)
  }
}

const moduleMessages = (scene: Scene, count: number): void => {
  for (let index = 0; index < count; index += 1) {
    scene.socket.receive({t: 'module', c: 'alpha', m: index})
  }
}

const events: {readonly [E in Event]: ((scene: Scene) => void) | null} = {
  'the page names versions that the server accepts': scene => scene.socket.receive({t: 'hello', v: 1, m: {alpha: 1}}),
  'the page names versions that the server refuses': scene => scene.socket.receive({t: 'hello', v: 1, m: {alpha: 0}}),
  '10 seconds pass since the server accepted the connection, and the page has named no versions': scene => scene.h.clock.advance(10_000),
  'a check is due, and the page answered one of the last two': scene => {
    scene.h.clock.advance(30_000)
    scene.socket.receive({t: 'answer', n: 2})
    scene.sentMark = scene.socket.sent.length
    scene.h.clock.advance(15_000)
  },
  'a check is due, and the page answered neither of the last two': scene => {
    scene.h.clock.advance(30_000)
    scene.sentMark = scene.socket.sent.length
    scene.h.clock.advance(15_000)
  },
  'a message arrives while the connection has a message to spend': scene => {
    if (scene.socket.sent.length > 0) {
      scene.socket.receive({t: 'module', c: 'alpha', m: 'read'})
    } else {
      scene.socket.receive({t: 'answer', n: 0})
    }
  },
  'a message arrives while the connection has no message to spend': scene => {
    moduleMessages(scene, 199)
    scene.eventsMark = scene.h.events.length
    scene.socket.receive({t: 'module', c: 'alpha', m: 'read'})
  },
  'the page sends a WebSocket message over 65,536 bytes': scene => scene.socket.receiveRaw(Buffer.alloc(65_537, 32)),
  'the page sends a module message that 1-10 does not allow': scene =>
    scene.socket.receive({t: 'module', c: 'alpha', m: 'x'.repeat(16_383)}),
  'the page sends a module message on a channel that it did not name': scene => scene.socket.receive({t: 'module', c: 'beta', m: 1}),
  'the page sends a request for TURN credentials': scene => scene.socket.receive({t: 'turn', r: 1}),
  'more than 262,144 bytes sent to the connection have not left the server': scene => {
    scene.socket.bufferedAmount = 262_145
    if (scene.socket.sent.length > 0) {
      scene.h.port().send(String(scene.socket.last('id')?.p), 'more')
    } else {
      scene.socket.receive({t: 'hello', v: 1, m: {alpha: 1}})
    }
  },
  'the page closes the WebSocket connection or the network drops it': null,
  'the server restarts or is deployed': scene => scene.h.server.close(),
  'the process of the server fails': () => {}
}

const expectServer = (scene: Scene, event: Event, outcome: Outcome): void => {
  switch (outcome.server) {
    case 'accepts the versions':
      assert.deepEqual(
        scene.sentSince.map(message => message.t),
        ['id']
      )
      assert.match(String(scene.sentSince[0]?.p), /^[A-Za-z0-9_-]{22}$/)
      return
    case 'refuses the versions, says which side is older and closes the connection':
      assert.deepEqual(scene.sentSince, [{t: 'outdated', older: 'page'}])
      return
    case 'sends a check':
      assert.deepEqual(scene.sentSince, [{t: 'check', n: 3}])
      return
    case 'reads it':
      if (scene.socket.sent.length > 0) {
        assert.deepEqual(scene.h.events.slice(scene.eventsMark).at(-1)?.message, 'read')
      }
      return
    case 'reads it once the connection regains a message to spend':
      assert.equal(scene.h.events.length, scene.eventsMark)
      assert.equal(scene.socket.paused, true)
      scene.h.clock.advance(49)
      assert.equal(scene.h.events.length, scene.eventsMark)
      scene.h.clock.advance(1)
      assert.equal(scene.h.events.at(-1)?.message, 'read')
      assert.equal(scene.socket.paused, false)
      return
    case 'closes the connection':
      assert.equal(scene.socket.isClosed, true)
      if (event === 'the server restarts or is deployed' || event === 'a check is due, and the page answered neither of the last two') {
        assert.deepEqual(
          scene.sentSince.filter(message => message.t !== 'check'),
          []
        )
      }
      return
    case 'tells the page nothing':
    case 'nothing':
      assert.deepEqual(scene.sentSince, [])
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
      if (event !== 'the process of the server fails') {
        assert.equal(scene.socket.isClosed, cell.outcome.state === 'closed')
      }
      expectServer(scene, event, cell.outcome)
    })
  }
}

const startEvents: {readonly [E in StartEvent]: (h: ServerHarness) => ReturnType<ServerHarness['upgrade']>} = {
  'a WebSocket connection arrives from an allowed origin while fewer than 250 signaling connections are opening or open': h => {
    for (let index = 0; index < 249; index += 1) {
      h.accept()
    }
    return h.upgrade()
  },
  'a WebSocket connection arrives with another origin or none': h => {
    assert.equal(h.upgrade(null).socket, null)
    return h.upgrade('https://evil.example')
  },
  'a WebSocket connection arrives while 250 signaling connections are opening or open': h => {
    for (let index = 0; index < 125; index += 1) {
      h.accept()
      h.open()
    }
    return h.upgrade()
  }
}

for (const [event, cell] of Object.entries(start) as [StartEvent, (typeof start)[StartEvent]][]) {
  if (!('outcome' in cell)) {
    continue
  }
  test(`${cell.ids.join(' ')} start: ${event}`, () => {
    const h = new ServerHarness()
    const {handled, raw, socket} = startEvents[event](h)
    assert.equal(handled, true)
    if (cell.outcome.server === 'accepts the connection') {
      assert.notEqual(socket, null)
      assert.equal(raw.destroyed, false)
    } else {
      assert.equal(socket, null)
      assert.equal(raw.destroyed, true)
      assert.match(raw.written, /^HTTP\/1\.1 (403|503) /)
    }
  })
}

test('7-1 versions compare the transport first, then the modules by name, and a module the server lacks makes it older', () => {
  const cases: [number, Record<string, number>, string | null][] = [
    [0, {alpha: 9}, 'page'],
    [2, {alpha: 0}, 'server'],
    [1, {alpha: 0, beta: 3}, 'page'],
    [1, {alpha: 2, beta: 1}, 'server'],
    [1, {beta: 1, alpha: 1}, 'page'],
    [1, {alpha: 1, gamma: 1}, 'server'],
    [1, {alpha: 1, beta: 2}, null]
  ]
  for (const [v, m, older] of cases) {
    const h = new ServerHarness()
    const socket = h.accept()
    socket.receive({t: 'hello', v, m})
    assert.deepEqual(socket.sent[0], older === null ? {t: 'id', p: socket.sent[0]?.p} : {t: 'outdated', older}, JSON.stringify(m))
  }
})

test('7-2 the first check goes 15 seconds after the connection opened', () => {
  const h = new ServerHarness()
  const {socket} = h.open()
  h.clock.advance(14_999)
  assert.equal(socket.of('check').length, 0)
  h.clock.advance(1)
  assert.deepEqual(socket.of('check'), [{t: 'check', n: 1}])
})

test('7-2 an answer counts only when the server reads it', () => {
  const h = new ServerHarness()
  const {socket} = h.open()
  h.clock.advance(30_000)
  for (let index = 0; index < 200; index += 1) {
    socket.receive({t: 'module', c: 'alpha', m: index})
  }
  socket.receive({t: 'answer', n: 2})
  h.clock.advance(14_000)
  for (let index = 0; index < 200; index += 1) {
    socket.receive({t: 'module', c: 'alpha', m: index})
  }
  h.clock.advance(1_000)
  assert.equal(socket.isClosed, false)
})

test('7-2 answers that wait unread when the next check is due do not count, and the connection closes', () => {
  const h = new ServerHarness()
  const {socket} = h.open()
  h.clock.advance(30_000)
  for (let index = 0; index < 500; index += 1) {
    socket.receive({t: 'module', c: 'alpha', m: index})
  }
  socket.receive({t: 'answer', n: 1})
  socket.receive({t: 'answer', n: 2})
  h.clock.advance(15_000)
  assert.equal(socket.isClosed, true)
})

test('7-2 a page that answers only the first check gets the third and is closed when the fourth is due', () => {
  const h = new ServerHarness()
  const {socket} = h.open()
  h.clock.advance(15_000)
  socket.receive({t: 'answer', n: 1})
  h.clock.advance(30_000)
  assert.equal(socket.isClosed, false)
  assert.deepEqual(socket.of('check').at(-1), {t: 'check', n: 3})
  h.clock.advance(15_000)
  assert.equal(socket.isClosed, true)
})

test('7-3 a connection regains one message every 50 milliseconds, up to 200', () => {
  const h = new ServerHarness()
  const {socket} = h.open()
  h.clock.advance(1_000)
  for (let index = 0; index < 201; index += 1) {
    socket.receive({t: 'module', c: 'alpha', m: index})
  }
  assert.equal(h.events.length, 200)
  assert.equal(socket.paused, true)
  h.clock.advance(49)
  assert.equal(h.events.length, 200)
  h.clock.advance(1)
  assert.equal(h.events.at(-1)?.message, 200)
  assert.equal(socket.paused, false)
  assert.equal(socket.isClosed, false)
})

test('7-4 before the peer ID, a message other than the versions and answers closes the connection', () => {
  for (const message of [
    {t: 'list', r: 1, p: 'x', add: true},
    {t: 'call', pc: 'a', to: 'b', ms: 1, d: {type: 'offer', sdp: ''}},
    {t: 'hello'},
    'text',
    [1]
  ]) {
    const h = new ServerHarness()
    const socket = h.accept()
    socket.receive(message)
    assert.equal(socket.isClosed, true, JSON.stringify(message))
  }
})

test('7-4 a binary message, a message that is not JSON, or a second naming of versions closes an open connection', () => {
  const messages: [unknown, boolean][] = [
    [Buffer.from('{}'), true],
    [Buffer.from('{not json'), false],
    [Buffer.from(JSON.stringify({t: 'hello', v: 1, m: {alpha: 1}})), false],
    [Buffer.from(JSON.stringify({t: 'unknown'})), false]
  ]
  for (const [data, isBinary] of messages) {
    const h = new ServerHarness()
    const {socket} = h.open()
    socket.receiveRaw(data, isBinary)
    assert.equal(socket.isClosed, true)
  }
})

test('7-4 a WebSocket message of 65,536 bytes is read', () => {
  const h = new ServerHarness()
  const {socket} = h.open()
  const filler = 'x'.repeat(65_536 - JSON.stringify({t: 'answer', n: 0, f: ''}).length)
  socket.receiveRaw(Buffer.from(JSON.stringify({t: 'answer', n: 0, f: filler})))
  assert.equal(socket.isClosed, false)
})

test('7-4 a socket that reports an error, such as a message over the limit of its WebSocket server, closes the connection', () => {
  const h = new ServerHarness()
  const {socket, peerId} = h.open()
  socket.fail()
  assert.equal(socket.isClosed, true)
  assert.deepEqual(h.events, [{part: 'alpha', kind: 'closed', peerId}])
})

test('7-5 262,144 bytes that have not left the server keep the connection open', () => {
  const h = new ServerHarness()
  const {socket, peerId} = h.open()
  socket.bufferedAmount = 262_144
  h.port().send(peerId, 1)
  assert.equal(socket.isClosed, false)
})

test('7-6 allowed origins are when.party and its subdomains over https, and localhost or 127.0.0.1 over http, with any port', () => {
  for (const origin of [
    'https://when.party',
    'https://games.when.party',
    'https://a.b.when.party:8443',
    'http://localhost',
    'http://localhost:5173',
    'http://127.0.0.1:4173'
  ]) {
    assert.equal(isAllowedOrigin(origin), true, origin)
  }
  for (const origin of [
    undefined,
    '',
    'null',
    'http://when.party',
    'https://evilwhen.party',
    'https://when.party.evil.com',
    'https://localhost',
    'http://192.168.0.2',
    'ws://localhost',
    'https://when.party/x',
    'https://u:p@when.party',
    'http://127.1'
  ]) {
    assert.equal(isAllowedOrigin(origin), false, String(origin))
  }
})

test('7-6 the server takes only upgrades at /platform and leaves the others to the signaling deployment', () => {
  const h = new ServerHarness()
  assert.equal(h.upgrade('https://games.when.party', '/').handled, false)
  assert.equal(h.upgrade('https://games.when.party', '/platform?x=1').handled, true)
})

test('7-8 a closed connection frees its place among the 250', () => {
  const h = new ServerHarness()
  const sockets = Array.from({length: 250}, () => h.accept())
  assert.equal(h.upgrade().socket, null)
  sockets[0]?.drop()
  assert.notEqual(h.upgrade().socket, null)
})

test('7-9 a page that names its versions within 10 seconds is not closed', () => {
  const h = new ServerHarness()
  const socket = h.accept()
  h.clock.advance(9_999)
  socket.receive({t: 'hello', v: 1, m: {alpha: 1}})
  h.clock.advance(10_000)
  assert.equal(socket.isClosed, false)
})
