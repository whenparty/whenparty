import assert from 'node:assert/strict'
import {test} from 'node:test'
import {parseCode} from '../protocol.ts'
import {testCells, type Check} from './cells.ts'
import type {FakePeer} from './fake-transport.ts'
import {app, code, ownerWithParticipant, pageHarness, settle, type PageHarness} from './page-harness.ts'
import {connection, request} from './1-room.states.ts'

type ConnectionTable = typeof connection
type ConnectionState = keyof ConnectionTable
type ConnectionEvent = keyof ConnectionTable[ConnectionState]
type ConnectionOutcome = {readonly next: ConnectionState | 'closed'; readonly effects: readonly string[]}

interface World {
  readonly h: PageHarness
  readonly peer: FakePeer
  readonly owner: boolean
  from: number
  sentFrom: number
}

const ownerConnection = async (state: 'ownerConnecting' | 'ownerWaiting' | 'ownerOpen'): Promise<World> => {
  const h = pageHarness()
  await h.owning()
  const signaling = h.latest()
  signaling.receive({t: 'ask', app, code, n: 2, data: null})
  h.requests.at(-1)?.letIn()
  signaling.receive({t: 'named', app, code, n: 2, peer: 'participant peer'})
  const peer = signaling.call('participant peer')
  if (state !== 'ownerConnecting') {
    peer.open()
  }
  if (state === 'ownerOpen') {
    peer.receive('vvisible')
  }
  return {h, peer, owner: true, from: h.mark(), sentFrom: peer.sent.length}
}

const participantConnection = async (state: 'participantConnecting' | 'participantWaiting' | 'participantOpen'): Promise<World> => {
  const h = pageHarness()
  const {peer} = await h.letIn()
  if (state !== 'participantConnecting') {
    peer.open()
  }
  if (state === 'participantOpen') {
    peer.receive('c')
  }
  return {h, peer, owner: false, from: h.mark(), sentFrom: peer.sent.length}
}

const setup = (state: ConnectionState): Promise<World> =>
  state.startsWith('owner')
    ? ownerConnection(state as 'ownerConnecting' | 'ownerWaiting' | 'ownerOpen')
    : participantConnection(state as 'participantConnecting' | 'participantWaiting' | 'participantOpen')

const fireConnection: {readonly [E in ConnectionEvent]: (w: World) => void | Promise<void>} = {
  transportOpens: w => w.peer.open(),
  firstVisibilityArrives: w => w.peer.receive('vhidden'),
  confirmationArrives: w => w.peer.receive('c'),
  participantVisibilityChanges: w => w.h.setVisible('hidden'),
  closes: async w => {
    w.peer.drop()
    await settle()
  },
  outerTimeLimitPasses: w => w.h.clock.advance(w.owner ? 600_000 : 45_000),
  transportReportsPath: w => w.peer.report('turn', 80)
}

const observed = (w: World): ConnectionState | 'closed' => {
  if (w.peer.state === 'closed') {
    return 'closed'
  }
  if (w.owner) {
    return w.peer.sent.includes('c') ? 'ownerOpen' : w.peer.state === 'open' ? 'ownerWaiting' : 'ownerConnecting'
  }
  if (w.h.told('joined').length > 0) {
    return 'participantOpen'
  }
  return w.peer.sent.some(sent => sent.startsWith('v')) ? 'participantWaiting' : 'participantConnecting'
}

const number = (w: World): number => (w.owner ? 2 : 1)

const connectionEffect: {readonly [name: string]: (w: World) => void} = {
  sendsVisibility: w => assert.deepEqual(w.peer.sent.slice(w.sentFrom).at(-1)?.charAt(0), 'v'),
  sendsConfirmation: w => assert.deepEqual(w.peer.sent.slice(w.sentFrom), ['c']),
  appToldPath: w => assert.deepEqual(w.h.told('path').at(-1), [number(w), 'turn', 80]),
  keepsPathForOpening: w => {
    assert.ok(!w.h.namesSince(w.from).includes('path'))
    w.peer.receive(w.owner ? 'vvisible' : 'c')
    assert.deepEqual(w.h.told('path').at(-1), [number(w), 'turn', 80])
  }
}

const connectionScenario =
  (state: ConnectionState, event: ConnectionEvent): Check<ConnectionOutcome> =>
  async outcome => {
    const w = await setup(state)
    await fireConnection[event](w)
    assert.equal(observed(w), outcome.next)
    for (const name of outcome.effects) {
      assert.ok(connectionEffect[name], `no check of ${name}`)
      connectionEffect[name](w)
    }
  }

const connectionScenarios = (state: ConnectionState) =>
  Object.fromEntries((Object.keys(connection[state]) as ConnectionEvent[]).map(event => [event, connectionScenario(state, event)])) as {
    readonly [E in ConnectionEvent]: Check<ConnectionOutcome>
  }

testCells<ConnectionTable, ConnectionOutcome>('peer connection', connection, {
  ownerConnecting: connectionScenarios('ownerConnecting'),
  ownerWaiting: connectionScenarios('ownerWaiting'),
  ownerOpen: connectionScenarios('ownerOpen'),
  participantConnecting: connectionScenarios('participantConnecting'),
  participantWaiting: connectionScenarios('participantWaiting'),
  participantOpen: connectionScenarios('participantOpen')
})

type RequestTable = typeof request
type RequestState = keyof RequestTable
type RequestEvent = keyof RequestTable[RequestState]
type RequestOutcome = {readonly next: string; readonly closesSignaling: boolean}

interface RequestTimes {
  readonly sentAt: number
  readonly askedAt: number
}

const fireRequest: {readonly [E in RequestEvent]: (h: PageHarness, times: RequestTimes) => void} = {
  answerArrives: h =>
    h.told('asked').length > 0
      ? h.latest().answer('let in', {token: 'participant token', n: 2, wait: 600, owner: 'owner peer'}, 'join')
      : h.latest().answer('answer', {a: 'owner away'}),
  askedArrives: h => h.latest().receive({t: 'asked', r: h.latest().last('join')?.r}),
  fifteenSecondsSinceSent: (h, {sentAt}) => {
    h.clock.advance(sentAt + 14_999 - h.clock.now())
    assert.ok(!h.latest().closedByPage)
    h.clock.advance(1)
  },
  sixtyFiveSecondsSinceAsked: (h, {askedAt}) => {
    h.clock.advance(askedAt + 64_999 - h.clock.now())
    assert.ok(!h.latest().closedByPage)
    h.clock.advance(1)
  }
}

const requestScenario =
  (state: RequestState, event: RequestEvent): Check<RequestOutcome> =>
  async outcome => {
    const h = pageHarness()
    await h.join()
    h.latest().open()
    const sentAt = h.clock.now()
    if (state === 'askedArrived') {
      h.clock.advance(3_000)
      h.latest().receive({t: 'asked', r: h.latest().last('join')?.r})
    }
    const from = h.mark()
    fireRequest[event](h, {sentAt, askedAt: h.clock.now()})
    assert.equal(h.latest().closedByPage, outcome.closesSignaling)
    const names = h.namesSince(from)
    const answered = names.includes('letIn') || names.includes('waitingForOwner')
    const seen =
      names.includes('failed') && outcome.closesSignaling
        ? 'noAnswer'
        : names.includes('asked')
          ? 'askedArrived'
          : answered
            ? 'answered'
            : state
    assert.equal(seen, outcome.next)
    if (outcome.next === 'noAnswer') {
      assert.deepEqual(h.told('failed').at(-1), [{reason: 'offline'}])
    }
  }

const requestScenarios = (state: RequestState) =>
  Object.fromEntries((Object.keys(request[state]) as RequestEvent[]).map(event => [event, requestScenario(state, event)])) as {
    readonly [E in RequestEvent]: Check<RequestOutcome>
  }

testCells<RequestTable, RequestOutcome>('request', request, {
  sent: requestScenarios('sent'),
  askedArrived: requestScenarios('askedArrived')
})

test('1-2 an app ID of 1 to 64 lowercase letters, digits, dots, hyphens and slashes is valid for joining', async () => {
  for (const [appId, valid] of [
    ['a', true],
    ['a'.repeat(64), true],
    ['games/tic-tac.toe', true],
    ['a'.repeat(65), false],
    ['Tic', false],
    ['', false]
  ] as const) {
    const h = pageHarness()
    h.rooms.join(appId, code, null, h.handlers)
    await settle()
    assert.equal(h.told('failed').length > 0, !valid, appId)
    assert.equal(h.transport.connections.length, valid ? 1 : 0)
  }
})

test('1-3 typed text turns into a room code without white space and hyphens, with small letters made capital', () => {
  assert.equal(parseCode(' bc-df g\n'), 'BCDFG')
  assert.equal(parseCode('b c d f g'), 'BCDFG')
  assert.equal(parseCode('BCDF'), null)
  assert.equal(parseCode('BCDFGH'), null)
  assert.equal(parseCode('BCDF1'), null)
  assert.equal(parseCode('BCDFA'), null)
  assert.equal(parseCode('BCDF_G'), null)
  assert.equal(parseCode('23456'), '23456')
})

test('1-5 the app is told numbers and never tokens', async () => {
  const h = pageHarness()
  await h.inRoom()
  const o = pageHarness()
  await ownerWithParticipant(o)
  for (const events of [h.events, o.events]) {
    assert.ok(!JSON.stringify(events).includes('token'))
  }
  assert.deepEqual(h.told('joined'), [[2]])
})

test('1-6 a room without a waiting time waits 600 seconds', async () => {
  const h = pageHarness()
  await h.owning()
  assert.equal(h.latest().last('create')?.wait, null)
  const signaling = h.latest()
  signaling.receive({t: 'ask', app, code, n: 2, data: null})
  h.requests.at(-1)?.letIn()
  signaling.receive({t: 'named', app, code, n: 2, peer: 'participant peer'})
  h.clock.advance(599_999)
  assert.equal(signaling.last('left'), undefined)
  h.clock.advance(1)
  assert.equal(signaling.last('left')?.n, 2)
})

test('1-7 after the scripts resume, the page first acts on its time limits that passed', async () => {
  const h = pageHarness()
  await h.asked()
  h.clock.jump(65_000)
  h.latest().answer('let in', {token: 'participant token', n: 2, wait: 600, owner: 'owner peer'}, 'join')
  assert.deepEqual(h.told('failed'), [[{reason: 'offline'}]])
  assert.deepEqual(h.told('letIn'), [])
})

test('1-11 the module goes on when a handler of the app throws or returns a rejected promise', async () => {
  const h = pageHarness()
  for (const name of Object.keys(h.handlers)) {
    if (name !== 'joinRequest') {
      ;(h.handlers as {[key: string]: unknown})[name] = () => Promise.reject(new Error('app'))
    }
  }
  h.handlers.joined = () => {
    throw new Error('app')
  }
  const {peer} = await h.inRoom().catch(() => ({peer: h.latest().peers.at(-1)}))
  assert.equal(peer?.state, 'open')
  assert.ok(h.record())
})

test('1-13 a connection that closes with offline before it opens cannot open, and one refused as outdated is not one', async () => {
  const offline = pageHarness()
  await offline.join()
  offline.latest().drop()
  assert.deepEqual(offline.told('failed'), [[{reason: 'offline'}]])
  const outdated = pageHarness()
  await outdated.join()
  outdated.latest().outdated('server')
  assert.deepEqual(outdated.told('failed'), [[{reason: 'outdated', older: 'server'}]])
})

test('1-14 1-15 a join with more than 1,024 bytes of join data fails and sends nothing, and one of 1,024 goes on', async () => {
  const h = pageHarness()
  assert.equal(h.rooms.join(app, code, 'x'.repeat(1_023), h.handlers), null)
  assert.equal(
    h.rooms.join(app, code, () => 1, h.handlers),
    null
  )
  await settle()
  assert.equal(h.transport.connections.length, 0)
  assert.ok(h.rooms.join(app, code, 'x'.repeat(1_022), h.handlers))
  await settle()
  h.latest().open()
  assert.equal(h.latest().last('join')?.data, 'x'.repeat(1_022))
})

test('1-1 the page talks to the rooms server over a signaling connection with the channel of the rooms module', async () => {
  const h = pageHarness()
  await h.join()
  assert.deepEqual(h.latest().versions, {rooms: 1})
})

test('1-4 the owner has number 1, and a participant connects only to the owner page', async () => {
  const h = pageHarness()
  h.putRecord(h.ownerRecord())
  h.rooms.return(app, h.handlers)
  await settle()
  assert.deepEqual(h.told('returning'), [['owner', 1, undefined]])
  const participant = pageHarness()
  await participant.inRoom()
  assert.deepEqual(
    participant.transport.connections.flatMap(connection => connection.peers.map(peer => peer.peerId)),
    ['owner peer']
  )
})
