import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {SignalingConnection} from '../api.ts'
import {signalingUrlFor} from '../environment.ts'
import {transportVersion} from '../protocol.ts'
import {table} from './1-signaling.states.ts'
import {PageHarness, type Notice} from './fake-page.ts'
import {pick, seeded} from './seeded.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']

const modules = ['alpha', 'beta']

class Scene {
  readonly h = new PageHarness()
  connection: SignalingConnection
  readonly startedAt: number
  lastArrivalAt: number | null = null
  sendResult: boolean | null = null
  listResult: Promise<boolean> | null = null
  ownNotices: Notice[] = []
  noticesMark = 0
  sentMark = 0
  closeMark = 0

  constructor() {
    this.startedAt = this.h.clock.now()
    this.connection = this.h.transport.openSignaling(this.h.channels(...modules))
    this.h.socket.open()
  }

  receive(message: unknown, {waiting = false} = {}): void {
    const closed = this.connection.state === 'closed'
    this.h.socket.receive(message)
    if (!closed && !waiting && this.connection.state !== 'closed') {
      this.lastArrivalAt = this.h.clock.now()
    }
  }

  enter(state: State, closeBy: 'page' | 'network' = 'page'): void {
    if (state !== 'opening') {
      this.receive({t: 'id', p: 'peer-1'})
    }
    if (state === 'closed') {
      if (closeBy === 'page') {
        this.connection.close()
      } else {
        this.h.socket.drop()
      }
    }
    this.noticesMark = this.h.notices.length
    this.sentMark = this.h.socket.sent.length
    this.closeMark = this.h.socket.closeCalls
  }

  get told(): Notice[] {
    return this.h.notices.slice(this.noticesMark + this.ownNotices.length)
  }

  get sentSince(): Record<string, unknown>[] {
    return this.h.socket.sent.slice(this.sentMark)
  }
}

const each = (kind: Notice['kind'], value: unknown): Notice[] => modules.map(module => ({module, kind, value}))

const closing = (scene: Scene, reason: object): unknown => ({...reason, lastArrivalAt: scene.lastArrivalAt ?? scene.startedAt})

interface EventCase {
  readonly closeBy?: 'page' | 'network'
  readonly throwing?: Notice['kind']
  run(scene: Scene): void | Promise<void>
}

const events: {readonly [E in Event]: EventCase | null} = {
  'the page closes it': {run: scene => scene.connection.close()},
  'the page unloads or enters the back/forward cache': {run: scene => scene.h.hide()},
  'the page returns from the back/forward cache': {run: () => {}},
  'a module sends a module message': {run: scene => void (scene.sendResult = scene.connection.send('alpha', {a: 1}))},
  'a module sends a value that is not a module message': {
    run: scene => void (scene.sendResult = scene.connection.send('alpha', {a: Number.NaN}))
  },
  'the peer ID arrives': {run: scene => scene.receive({t: 'id', p: 'peer-2'})},
  'the server refuses the versions': {run: scene => scene.receive({t: 'outdated', older: 'page'})},
  'a check arrives': {run: scene => scene.receive({t: 'check', n: 1})},
  'a check arrives while the browser slows the timers of the page': {run: scene => scene.receive({t: 'check', n: 1})},
  'a module message arrives': {run: scene => scene.receive({t: 'module', c: 'alpha', m: {x: 1}})},
  'a message of the transport for a peer connection or for the list of the connection arrives': {
    run: scene => {
      if (scene.connection.state === 'open') {
        scene.listResult = scene.connection.allow('peer-9')
        scene.sentMark = scene.h.socket.sent.length
      }
      scene.receive({t: 'list', r: 1, ok: true})
    }
  },
  'a module handler of a module message throws': {
    throwing: 'message',
    run: scene => {
      scene.receive({t: 'module', c: 'alpha', m: 1})
      scene.receive({t: 'module', c: 'alpha', m: 2})
      scene.ownNotices = [
        {module: 'alpha', kind: 'message', value: 1},
        {module: 'alpha', kind: 'message', value: 2}
      ]
    }
  },
  'a module handler of a notice about the connection throws': {
    throwing: 'open',
    closeBy: 'network',
    run: scene => {
      if (scene.connection.state === 'open') {
        scene.receive({t: 'module', c: 'alpha', m: 3})
        scene.ownNotices = [{module: 'alpha', kind: 'message', value: 3}]
      }
    }
  },
  'the browser reports that the WebSocket connection closed': {run: scene => scene.h.socket.drop()},
  '10 seconds pass without a peer ID': {run: scene => scene.h.clock.advance(10_000)},
  'the scripts resume after 10 seconds without a peer ID, with the peer ID waiting': {
    run: scene => {
      scene.h.clock.sleep(10_000)
      scene.receive({t: 'id', p: 'peer-2'}, {waiting: true})
    }
  },
  '45 seconds pass with nothing arriving': {run: scene => scene.h.clock.advance(45_000)},
  'the scripts resume after 45 seconds with nothing handled, with messages waiting': {
    run: scene => {
      scene.h.clock.sleep(45_000)
      scene.receive({t: 'module', c: 'alpha', m: 'late'}, {waiting: true})
    }
  }
}

const expectTold = (scene: Scene, outcome: Outcome): void => {
  const expected: Record<Outcome['told'], Notice[]> = {
    nothing: [],
    'open, with the peer ID': each('open', 'peer-2'),
    'the module message': [{module: 'alpha', kind: 'message', value: {x: 1}}],
    'closed: offline, with the moment the last message arrived, or the page began to open it': each(
      'closed',
      closing(scene, {reason: 'offline'})
    ),
    'closed: outdated, with the older side and the moment the last message arrived, or the page began to open it': each(
      'closed',
      closing(scene, {reason: 'outdated', older: 'page'})
    )
  }
  assert.deepEqual(scene.told, expected[outcome.told])
}

const expectPage = async (scene: Scene, outcome: Outcome): Promise<void> => {
  const socket = scene.h.socket
  const closedNow = socket.closeCalls > scene.closeMark
  switch (outcome.page) {
    case 'nothing':
    case 'drops it':
      assert.deepEqual(scene.sentSince, [])
      assert.equal(closedNow, false)
      assert.equal(scene.h.sockets.length, 1)
      return
    case 'closes the WebSocket connection':
    case 'closes the WebSocket connection and drops what waits':
      assert.equal(closedNow, true)
      assert.deepEqual(scene.sentSince, [])
      return
    case 'closes the WebSocket connection once the browser has sent what the page sent':
      assert.equal(closedNow, true)
      assert.equal(socket.log.at(-1), 'close')
      return
    case 'answers the check at once':
      assert.deepEqual(scene.sentSince, [{t: 'answer', n: 1}])
      return
    case 'sends the message':
      assert.equal(scene.sendResult, true)
      assert.deepEqual(scene.sentSince, [{t: 'module', c: 'alpha', m: {a: 1}}])
      return
    case 'sending fails':
      assert.equal(scene.sendResult, false)
      assert.deepEqual(scene.sentSince, [])
      return
    case 'delivers it':
      assert.equal(await scene.listResult, true)
      return
    case 'counts it as delivered and goes on':
      assert.deepEqual(scene.h.notices.slice(scene.noticesMark, scene.noticesMark + scene.ownNotices.length), scene.ownNotices)
      if (scene.connection.state === 'closed') {
        assert.deepEqual(
          scene.h.notices.filter(notice => notice.kind === 'closed').map(notice => notice.module),
          modules
        )
      }
  }
}

for (const [state, cells] of Object.entries(table) as [State, Table[State]][]) {
  for (const [event, cell] of Object.entries(cells) as [Event, Table[State][Event]][]) {
    if (!('outcome' in cell)) {
      continue
    }
    test(`${cell.ids.join(' ')} ${state}: ${event}`, async () => {
      const scene = new Scene()
      const eventCase = events[event]
      assert.ok(eventCase, `no scenario for ${event}`)
      if (eventCase.throwing === 'open' && state === 'closed') {
        scene.h.throwing.add('closed')
      } else if (eventCase.throwing !== undefined) {
        scene.h.throwing.add(eventCase.throwing)
      }
      scene.enter(state, eventCase.closeBy)
      if (eventCase.throwing === 'open' && state !== 'closed') {
        scene.h.throwing.clear()
      }
      if (eventCase.throwing === 'message') {
        scene.h.throwing.clear()
        scene.h.throwing.add('message')
      }
      if (state === 'closed' && eventCase.closeBy === 'network') {
        scene.noticesMark = 0
        scene.ownNotices = []
      }
      await eventCase.run(scene)
      assert.equal(scene.connection.state, cell.outcome.state)
      if (!(state === 'closed' && eventCase.closeBy === 'network')) {
        expectTold(scene, cell.outcome)
      }
      await expectPage(scene, cell.outcome)
    })
  }
}

test('1-9 1-14 in any order of events, each module is told of the closing at most once and of nothing after it', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const random = seeded(seed)
    const h = new PageHarness()
    const connection = h.transport.openSignaling(h.channels(...modules))
    const steps: (() => void)[] = [
      () => h.socket.open(),
      () => h.socket.receive({t: 'id', p: 'peer-1'}),
      () => h.socket.receive({t: 'outdated', older: 'server'}),
      () => h.socket.receive({t: 'check', n: 1}),
      () => h.socket.receive({t: 'module', c: 'alpha', m: 1}),
      () => h.socket.drop(),
      () => connection.close(),
      () => h.hide(),
      () => connection.send('beta', 2),
      () => void connection.allow('peer-2'),
      () => h.clock.advance(Math.floor(random() * 30_000)),
      () => h.clock.sleep(Math.floor(random() * 30_000))
    ]
    let closedSeen = false
    for (let step = 0; step < 25; step += 1) {
      pick(random, steps)()
      closedSeen ||= connection.state === 'closed'
      assert.equal(connection.state === 'closed', closedSeen, `seed ${seed}`)
    }
    for (const module of modules) {
      const kinds = h.notices.filter(notice => notice.module === module).map(notice => notice.kind)
      assert.ok(kinds.filter(kind => kind === 'closed').length <= 1, `seed ${seed}`)
      assert.ok(kinds.filter(kind => kind === 'open').length <= 1, `seed ${seed}`)
      assert.ok(!kinds.includes('closed') || kinds.at(-1) === 'closed', `seed ${seed}`)
    }
  }
})

test('1-1 each module that the page names gets a channel to its server part, and the connection goes from opening to open to closed', () => {
  const h = new PageHarness()
  const connection = h.transport.openSignaling(h.channels('alpha', 'beta'))
  assert.equal(connection.state, 'opening')
  h.socket.open()
  h.socket.receive({t: 'id', p: 'peer-1'})
  assert.equal(connection.state, 'open')
  assert.equal(connection.send('alpha', 'a'), true)
  assert.equal(connection.send('beta', 'b'), true)
  assert.equal(connection.send('gamma', 'c'), false)
  h.socket.receive({t: 'module', c: 'beta', m: 'to beta'})
  assert.deepEqual(h.notices.at(-1), {module: 'beta', kind: 'message', value: 'to beta'})
  h.socket.drop()
  assert.equal(connection.state, 'closed')
})

test('1-2 the page names the version of the transport and of each module that it names', () => {
  const h = new PageHarness()
  h.transport.openSignaling({alpha: {version: 3, handlers: {}}, beta: {version: 7, handlers: {}}})
  h.socket.open()
  assert.deepEqual(h.socket.sent, [{t: 'hello', v: transportVersion, m: {alpha: 3, beta: 7}}])
})

test('1-2 outdated names the side whose version is older', () => {
  for (const older of ['page', 'server'] as const) {
    const h = new PageHarness()
    const connection = h.transport.openSignaling(h.channels('alpha'))
    h.socket.open()
    h.socket.receive({t: 'outdated', older})
    assert.equal(connection.state, 'closed')
    assert.deepEqual(h.notices, [{module: 'alpha', kind: 'closed', value: {reason: 'outdated', older, lastArrivalAt: h.clock.now()}}])
  }
})

test('1-3 each signaling connection gets its own peer ID, and each module is told it', () => {
  const h = new PageHarness()
  const first = h.transport.openSignaling(h.channels('alpha'))
  h.sockets[0]?.open()
  h.sockets[0]?.receive({t: 'id', p: 'first-peer-id-aaaaaaaa'})
  const second = h.transport.openSignaling(h.channels('alpha'))
  h.sockets[1]?.open()
  h.sockets[1]?.receive({t: 'id', p: 'second-peer-id-bbbbbbb'})
  assert.equal(first.peerId, 'first-peer-id-aaaaaaaa')
  assert.equal(second.peerId, 'second-peer-id-bbbbbbb')
  assert.deepEqual(
    h.notices.map(notice => notice.value),
    ['first-peer-id-aaaaaaaa', 'second-peer-id-bbbbbbb']
  )
})

test('1-4 an opening connection without a peer ID stays opening until 10 seconds pass', () => {
  const h = new PageHarness()
  const connection = h.transport.openSignaling(h.channels('alpha'))
  h.socket.open()
  h.clock.advance(9_999)
  assert.equal(connection.state, 'opening')
  h.clock.advance(1)
  assert.equal(connection.state, 'closed')
})

test('1-6 an open connection closes only when 45 seconds pass with nothing arriving', () => {
  const h = new PageHarness()
  const connection = h.transport.openSignaling(h.channels('alpha'))
  h.socket.open()
  h.socket.receive({t: 'id', p: 'peer-1'})
  h.clock.advance(44_999)
  h.socket.receive({t: 'check', n: 1})
  h.clock.advance(44_999)
  assert.equal(connection.state, 'open')
  h.clock.advance(1)
  assert.equal(connection.state, 'closed')
})

test('1-7 after the scripts resume, the page checks its time limits before it handles what arrived', () => {
  const h = new PageHarness()
  const connection = h.transport.openSignaling(h.channels('alpha'))
  h.socket.open()
  h.socket.receive({t: 'id', p: 'peer-1'})
  const openedAt = h.clock.now()
  h.clock.sleep(600_000)
  h.socket.receive({t: 'module', c: 'alpha', m: 'waiting'})
  assert.equal(connection.state, 'closed')
  assert.deepEqual(h.notices.slice(1), [{module: 'alpha', kind: 'closed', value: {reason: 'offline', lastArrivalAt: openedAt}}])
})

test('1-9 a module is told of the closing once, before the WebSocket connection has closed, and gets nothing after', () => {
  const h = new PageHarness()
  const connection = h.transport.openSignaling(h.channels('alpha'))
  h.socket.open()
  h.socket.receive({t: 'id', p: 'peer-1'})
  h.clock.advance(45_000)
  h.socket.receive({t: 'module', c: 'alpha', m: 'after'})
  h.socket.drop()
  assert.equal(connection.state, 'closed')
  assert.deepEqual(
    h.notices.map(notice => notice.kind),
    ['open', 'closed']
  )
})

test('1-8 1-9 when a module closes the connection on being told that it opened, no module after it is told anything', () => {
  const h = new PageHarness()
  const told: string[] = []
  const connection = h.transport.openSignaling({
    alpha: {
      version: 1,
      handlers: {
        open: () => {
          told.push('alpha open')
          connection.close()
        }
      }
    },
    beta: {version: 1, handlers: {open: () => void told.push('beta open'), closed: () => void told.push('beta closed')}}
  })
  h.socket.open()
  h.socket.receive({t: 'id', p: 'peer-1'})
  assert.equal(connection.state, 'closed')
  assert.deepEqual(told, ['alpha open'])
})

test('1-10 a module message of 16,384 bytes is sent, and one of 16,385 bytes fails', () => {
  const h = new PageHarness()
  const connection = h.transport.openSignaling(h.channels('alpha'))
  h.socket.open()
  h.socket.receive({t: 'id', p: 'peer-1'})
  assert.equal(connection.send('alpha', 'x'.repeat(16_382)), true)
  assert.equal(connection.send('alpha', 'x'.repeat(16_383)), false)
  assert.equal(connection.send('alpha', 'é'.repeat(8_191)), true)
  assert.equal(connection.send('alpha', 'é'.repeat(8_192)), false)
  assert.equal(h.socket.sent.length, 3)
})

test('1-10 values that are not JSON, or hold lone surrogates, fail', () => {
  const h = new PageHarness()
  const connection = h.transport.openSignaling(h.channels('alpha'))
  h.socket.open()
  h.socket.receive({t: 'id', p: 'peer-1'})
  const cyclic: Record<string, unknown> = {}
  cyclic.self = cyclic
  for (const value of [
    undefined,
    Number.POSITIVE_INFINITY,
    1n,
    () => 1,
    new Date(0),
    [1, , 3],
    {a: undefined},
    '\ud800',
    {'\udc00': 1},
    cyclic,
    new Map(),
    {toJSON: () => 1},
    [{a: 1, toJSON: () => 'b'}]
  ]) {
    assert.equal(connection.send('alpha', value), false, String(value))
  }
  for (const value of [null, true, false, 0, -1.5, '', 'text', [], {}, [null, {a: [1, 'b']}], Object.create(null)]) {
    assert.equal(connection.send('alpha', value), true, JSON.stringify(value))
  }
  assert.equal(connection.send('gamma', 1), false)
})

test('1-10 a module message is sent as it was when the module sent it', () => {
  const h = new PageHarness()
  const connection = h.transport.openSignaling(h.channels('alpha'))
  h.socket.open()
  h.socket.receive({t: 'id', p: 'peer-1'})
  const message = {moves: [1]}
  connection.send('alpha', message)
  message.moves.push(2)
  assert.deepEqual(h.socket.last('module'), {t: 'module', c: 'alpha', m: {moves: [1]}})
})

test('1-11 messages of all channels and of the transport arrive in the order sent', async () => {
  const h = new PageHarness()
  const connection = h.transport.openSignaling(h.channels('alpha', 'beta'))
  h.socket.open()
  h.socket.receive({t: 'id', p: 'peer-1'})
  const order: string[] = []
  void connection.allow('peer-2').then(() => order.push('list'))
  h.socket.receive({t: 'module', c: 'beta', m: 1})
  h.socket.receive({t: 'module', c: 'alpha', m: 2})
  h.socket.receive({t: 'list', r: 1, ok: true})
  h.socket.receive({t: 'module', c: 'beta', m: 3})
  await Promise.resolve()
  connection.send('alpha', 'a')
  connection.send('beta', 'b')
  assert.deepEqual(
    h.notices.slice(2).map(notice => `${notice.module}:${String(notice.value)}`),
    ['beta:1', 'alpha:2', 'beta:3']
  )
  assert.deepEqual(order, ['list'])
  assert.deepEqual(
    h.socket.sent.slice(-2).map(message => message.c),
    ['alpha', 'beta']
  )
})

test('1-12 the transport does not wait for a promise of a handler and ignores its rejection', () => {
  const h = new PageHarness()
  const delivered: unknown[] = []
  const connection = h.transport.openSignaling({
    alpha: {
      version: 1,
      handlers: {
        message: message => {
          delivered.push(message)
          return Promise.reject(new Error('rejected'))
        }
      }
    }
  })
  h.socket.open()
  h.socket.receive({t: 'id', p: 'peer-1'})
  h.socket.receive({t: 'module', c: 'alpha', m: 1})
  h.socket.receive({t: 'module', c: 'alpha', m: 2})
  assert.deepEqual(delivered, [1, 2])
  assert.equal(connection.state, 'open')
})

test('1-13 a page on localhost or 127.0.0.1 connects to ws://localhost:8080/platform, any other to wss://signaling.when.party/platform', () => {
  assert.equal(signalingUrlFor('localhost'), 'ws://localhost:8080/platform')
  assert.equal(signalingUrlFor('127.0.0.1'), 'ws://localhost:8080/platform')
  assert.equal(signalingUrlFor('games.when.party'), 'wss://signaling.when.party/platform')
  assert.equal(signalingUrlFor('localhost.when.party'), 'wss://signaling.when.party/platform')
})

test('1-14 a closed connection does not open again, and the page opens no other by itself', () => {
  const h = new PageHarness()
  const connection = h.transport.openSignaling(h.channels('alpha'))
  h.socket.open()
  h.socket.drop()
  h.clock.advance(600_000)
  h.socket.receive({t: 'id', p: 'peer-1'})
  assert.equal(connection.state, 'closed')
  assert.equal(h.sockets.length, 1)
})

test('1-15 the closing notice gives the moment the last message arrived, checks included', () => {
  const h = new PageHarness()
  const connection = h.transport.openSignaling(h.channels('alpha'))
  h.socket.open()
  h.clock.advance(1_000)
  h.socket.receive({t: 'id', p: 'peer-1'})
  h.clock.advance(20_000)
  h.socket.receive({t: 'check', n: 1})
  const checkAt = h.clock.now()
  h.clock.advance(45_000)
  assert.equal(connection.state, 'closed')
  assert.deepEqual(h.notices.at(-1)?.value, {reason: 'offline', lastArrivalAt: checkAt})
})
