import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {JoinRequest, Room} from '../api.ts'
import {testCells, type Check} from './cells.ts'
import type {FakePeer, FakeSignaling} from './fake-transport.ts'
import {app, code, ownerWithParticipant, pageHarness, settle, type PageHarness} from './page-harness.ts'
import {table} from './6-presence.states.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = {readonly next: State; readonly effects: readonly string[]}

interface World {
  readonly h: PageHarness
  readonly room: Room
  request: JoinRequest | null
  current: FakePeer | null
  older: FakePeer | null
  incoming: FakePeer | null
  from: number
  sentFrom: Map<FakeSignaling, number>
  eventAt: number
  lossAt: number
}

const named = (w: World, peer: string): void => w.h.latest().receive({t: 'named', app, code, n: 2, peer})

const sent = (w: World, t: string) =>
  w.h.transport.connections
    .flatMap(connection => connection.sent.slice(w.sentFrom.get(connection) ?? 0))
    .filter(message => message.t === t && message.n === 2)

const markWorld = (w: World): void => {
  w.from = w.h.mark()
  w.sentFrom = new Map(w.h.transport.connections.map(connection => [connection, connection.sent.length]))
  w.eventAt = w.h.clock.now()
}

const setup = async (state: State, event: Event): Promise<World> => {
  const h = pageHarness()
  if (state === 'pending' && event === 'handlerThrowsOrRejects') {
    h.setJoinRequestMode('reject')
  }
  const room = await h.owning()
  const w: World = {
    h,
    room,
    request: null,
    current: null,
    older: null,
    incoming: null,
    from: 0,
    sentFrom: new Map(),
    eventAt: 0,
    lossAt: 0
  }
  h.latest().receive({t: 'ask', app, code, n: 2, data: {seat: 'x'}})
  w.request = h.requests.at(-1) ?? null
  if (state === 'unknown') {
    w.request?.refuse()
  }
  if (state !== 'pending' && state !== 'unknown') {
    w.request?.letIn()
  }
  if (['lostNew', 'open', 'lostJoined', 'removed'].includes(state)) {
    named(w, 'peer A')
    w.lossAt = h.clock.now()
  }
  if (['open', 'lostJoined', 'removed'].includes(state)) {
    w.current = h.latest().call('peer A')
    w.current.open()
    w.current.receive('vvisible')
  }
  if (state === 'lostJoined') {
    w.current?.drop()
    w.lossAt = h.clock.now()
    w.older = w.current
    w.current = null
  }
  if (state === 'removed') {
    w.current?.receive('l')
  }
  if (state === 'lostNew' && (event === 'serverNamesNewPeer' || event === 'incomingFromNamedPeer')) {
    w.current = h.latest().call('peer A')
  }
  markWorld(w)
  return w
}

const incoming = (w: World, peer: string): FakePeer => {
  const call = w.h.latest().call(peer)
  w.incoming = call
  return call
}

const reconnectWith = async (w: World, roster: readonly number[]): Promise<void> => {
  w.h.latest().drop()
  w.h.latest().open('owner peer 2')
  w.h.latest().answer('roster', {roster}, 'reconnect')
  await settle()
}

const fire: {readonly [E in Event]: (w: World) => void | Promise<void>} = {
  appLetsIn: w => void w.request?.letIn(),
  appRefuses: w => void w.request?.refuse({why: 1}),
  appRefusesWithOtherData: w => void w.request?.refuse(() => 1),
  handlerThrowsOrRejects: () => settle(),
  serverEndsRequest: w => w.h.latest().receive({t: 'ended', app, code, n: 2}),
  signalingClosesWhilePending: w => w.h.latest().drop(),
  serverNamesNewPeer: w => {
    w.older = w.current
    named(w, 'peer B')
  },
  serverNamesSamePeer: w => named(w, 'peer A'),
  incomingFromNamedPeer: w => {
    w.older = w.current
    incoming(w, 'peer A')
  },
  incomingFromOtherPeer: w => void incoming(w, 'peer X'),
  firstVisibilityArrives: w => {
    const peer = incoming(w, 'peer A')
    peer.open()
    peer.receive('vhidden')
  },
  laterVisibilityArrives: w => w.current?.receive('vhidden'),
  openConnectionCloses: w => w.current?.drop(),
  attemptCloses: w => {
    const peer = incoming(w, 'peer A')
    peer.drop('timeout')
  },
  lossPassesWaitingTime: w => w.h.clock.advance(600_000),
  leaveArrivesOverPeer: w => w.current?.receive('l'),
  serverReportsLeft: w => w.h.latest().receive({t: 'left', app, code, n: 2}),
  rosterLeavesOut: w => reconnectWith(w, []),
  rosterIncludes: w => reconnectWith(w, [2])
}

const told: {readonly [effect: string]: string} = {
  appToldRequestEnded: 'requestEnded',
  appToldJoined: 'participantJoined',
  appToldBack: 'participantBack',
  appToldVisibility: 'visibility',
  appToldLost: 'participantLost',
  appToldLeft: 'participantLeft'
}

const effect: {readonly [name: string]: (w: World) => void} = {
  sendsLetIn: w => assert.equal(sent(w, 'admit').length, 1),
  sendsRefusal: w => assert.equal(sent(w, 'refuse').length, 1),
  sendsRefusalWithoutData: w => assert.deepEqual(Object.keys(sent(w, 'refuse')[0] ?? {}).includes('data'), false),
  startsLoss: () => {},
  closesOtherPeerConnections: w => assert.ok(w.older === null || w.older.closedByModule),
  keepsIncoming: w => assert.notEqual(w.incoming?.state, 'closed'),
  closesOlderFromSamePeer: w => assert.ok(w.older === null || w.older.state === 'closed'),
  closesIncoming: w => assert.ok(w.incoming?.closedByModule),
  closesConnections: w => assert.ok(w.current === null || w.current.closedByModule || w.current.state === 'closed'),
  tellsServerLeave: w => assert.equal(sent(w, 'left').length, 1),
  tellsServerLeaveAgain: w => assert.equal(sent(w, 'left').length, 1)
}

const recorded = (w: World) =>
  (w.h.record()?.numbers as {readonly n: number; readonly joined: boolean; readonly lostSince: number | null}[] | undefined)?.find(
    entry => entry.n === 2
  )

const checkLoss = (w: World, since: number): void => {
  w.h.clock.advance(since + 599_999 - w.h.clock.now())
  assert.notEqual(recorded(w), undefined)
  w.h.clock.advance(1)
  assert.equal(recorded(w), undefined)
}

const keepsLossStart = new Set<Event>(['serverNamesSamePeer', 'serverNamesNewPeer', 'attemptCloses', 'incomingFromNamedPeer'])

const keepsStart = (state: State, event: Event): boolean => (state === 'lostNew' || state === 'lostJoined') && keepsLossStart.has(event)

const checkNext = (w: World, next: State, effects: readonly string[]): void => {
  const entry = recorded(w)
  switch (next) {
    case 'pending':
      assert.equal(entry, undefined)
      return assert.equal(w.request?.letIn(), true)
    case 'letInSent':
      assert.equal(entry, undefined)
      assert.equal(w.request?.letIn(), false)
      named(w, 'peer C')
      return assert.equal(recorded(w)?.joined, false)
    case 'unknown':
      assert.equal(entry, undefined)
      assert.equal(w.request?.letIn() ?? false, false)
      markWorld(w)
      named(w, 'peer C')
      return assert.deepEqual([recorded(w), sent(w, 'left')], [undefined, []])
    case 'lostNew':
      assert.deepEqual([entry?.joined, w.room.sendTo(2, 'hello')], [false, false])
      break
    case 'open':
      assert.deepEqual([entry?.joined, entry?.lostSince, w.room.sendTo(2, 'hello')], [true, null, true])
      break
    case 'lostJoined':
      assert.deepEqual([entry?.joined, typeof entry?.lostSince, w.room.sendTo(2, 'hello')], [true, 'number', false])
      break
    case 'removed':
      assert.deepEqual([entry, w.room.sendTo(2, 'hello')], [undefined, false])
      markWorld(w)
      named(w, 'peer D')
      return assert.equal(sent(w, 'left').length, 1)
  }
  if (effects.includes('startsLoss')) {
    checkLoss(w, w.eventAt)
  }
}

const scenario =
  (state: State, event: Event): Check<Outcome> =>
  async outcome => {
    const w = await setup(state, event)
    if (keepsStart(state, event)) {
      w.h.clock.advance(3_000)
    }
    await fire[event](w)
    await settle()
    for (const [name, handler] of Object.entries(told)) {
      assert.equal(w.h.namesSince(w.from).includes(handler), outcome.effects.includes(name), name)
    }
    for (const name of outcome.effects) {
      if (!(name in told)) {
        assert.ok(effect[name], `no check of ${name}`)
        effect[name](w)
      }
    }
    checkNext(w, outcome.next, outcome.effects)
    if (keepsStart(state, event)) {
      checkLoss(w, w.lossAt)
    }
  }

const forState = (state: State) =>
  Object.fromEntries((Object.keys(table[state]) as Event[]).map(event => [event, scenario(state, event)])) as {
    readonly [E in Event]: Check<Outcome>
  }

testCells<Table, Outcome>('number on the owner page', table, {
  pending: forState('pending'),
  letInSent: forState('letInSent'),
  unknown: forState('unknown'),
  lostNew: forState('lostNew'),
  open: forState('open'),
  lostJoined: forState('lostJoined'),
  removed: forState('removed')
})

test('6-1 the app is told the number and the join data of a join request', async () => {
  const h = pageHarness()
  await h.owning()
  h.latest().receive({t: 'ask', app, code, n: 7, data: {seat: 'x'}})
  assert.deepEqual(h.told('joinRequest'), [[7, {seat: 'x'}]])
})

test('6-1 a handler that throws refuses the request', async () => {
  const h = pageHarness()
  h.setJoinRequestMode('throw')
  await h.owning()
  h.latest().receive({t: 'ask', app, code, n: 2, data: null})
  assert.equal(h.latest().last('refuse')?.n, 2)
})

test('6-4 the loss of a number starts at the last arrival that the transport reports with the closing', async () => {
  const h = pageHarness()
  const {peer} = await ownerWithParticipant(h)
  peer.drop('broken', h.clock.now() - 100_000)
  h.clock.advance(499_999)
  assert.deepEqual(h.told('participantLeft'), [])
  h.clock.advance(1)
  assert.deepEqual(h.told('participantLeft'), [[2]])
})

test('6-6 6-3 the page sends texts to a number only over the connection from the peer ID last named', async () => {
  const h = pageHarness()
  const {room, signaling, peer} = await ownerWithParticipant(h)
  signaling.receive({t: 'named', app, code, n: 2, peer: 'participant peer 2'})
  assert.equal(peer.state, 'closed')
  const other = signaling.call('participant peer')
  assert.equal(other.state, 'closed')
  const next = signaling.call('participant peer 2')
  next.open()
  next.receive('vvisible')
  assert.ok(room.sendTo(2, 'hello'))
  assert.equal(next.sent.at(-1), 'thello')
})

test('6-7 a leave that the page cannot tell at once goes with the next request to reconnect', async () => {
  const h = pageHarness()
  const {peer} = await ownerWithParticipant(h)
  h.latest().drop()
  peer.receive('l')
  h.latest().open('owner peer 2')
  assert.deepEqual(h.latest().last('reconnect')?.leaves, [2])
  h.latest().answer('roster', {roster: []}, 'reconnect')
  assert.equal(h.latest().last('left'), undefined)
  assert.deepEqual(h.record()?.leaves, [])
})

test('6-7 a leave of a number removed while a reconnect is under way goes right after it succeeds', async () => {
  const h = pageHarness()
  const {peer} = await ownerWithParticipant(h)
  h.latest().drop()
  h.latest().open('owner peer 2')
  peer.receive('l')
  h.latest().answer('roster', {roster: [2]}, 'reconnect')
  assert.equal(h.latest().last('left')?.n, 2)
})
