import assert from 'node:assert/strict'
import {test} from 'node:test'
import {testCells, type Check, type Scenario} from './cells.ts'
import type {FakePeer} from './fake-transport.ts'
import {app, code, ownerWithParticipant, pageHarness, settle, type PageHarness} from './page-harness.ts'
import {table} from './4-owner.states.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = {readonly next: string; readonly reason?: string; readonly effects: readonly string[]}

interface World {
  readonly h: PageHarness
  readonly participant: FakePeer | null
  lostAt: number
  from: number
  connectionsFrom: number
}

const ensureOpen = (w: World): void => {
  if (w.h.latest().state === 'opening') {
    w.h.latest().open('owner peer 2')
  }
}

const setup = async (state: State, {opening = false, unseen = false, lostLongAgo = false} = {}): Promise<World> => {
  const h = pageHarness()
  let participant: FakePeer | null = null
  if (state === 'creating') {
    await h.create()
    if (!opening) {
      h.latest().open()
    }
  } else {
    participant = (await ownerWithParticipant(h)).peer
  }
  const w: World = {h, participant, lostAt: 0, from: 0, connectionsFrom: 0}
  if (unseen) {
    h.setVisible('hidden')
    participant?.receive('vhidden')
  }
  if (state === 'offlineReconnecting' || state === 'offlinePausing') {
    w.lostAt = h.clock.now() - (lostLongAgo ? 600_000 : 1_000)
    h.latest().drop(w.lostAt)
    if (state === 'offlinePausing') {
      h.latest().drop()
    } else if (!opening) {
      h.latest().open('owner peer 2')
    }
  }
  w.from = h.mark()
  w.connectionsFrom = h.transport.connections.length
  return w
}

const answerCreate = (w: World, a: string): void => {
  ensureOpen(w)
  w.h.latest().answer('answer', {a}, 'create')
}

const fire: {readonly [E in Event]: (w: World) => void | Promise<void>} = {
  createdAnswer: w => {
    ensureOpen(w)
    w.h.latest().answer('created', {code, term: 1, token: 'owner token'}, 'create')
  },
  badAppAnswer: w => answerCreate(w, 'bad app'),
  badWaitAnswer: w => answerCreate(w, 'bad wait'),
  busyAnswer: w => answerCreate(w, 'busy'),
  rosterAnswer: w => {
    ensureOpen(w)
    w.h.latest().answer('roster', {roster: [2]}, 'reconnect')
  },
  noRoomOrRemovedAnswer: w => {
    ensureOpen(w)
    w.h.latest().answer('answer', {a: 'removed'}, 'reconnect')
  },
  noAnswer: w => {
    ensureOpen(w)
    w.h.clock.advance(15_000)
  },
  signalingCannotOpen: w => w.h.latest().drop(),
  signalingCloses: w => {
    w.lostAt = w.h.clock.now() - 2_000
    w.h.latest().drop(w.lostAt)
  },
  timer5s: w => w.h.clock.advance(5_000),
  serverClosedRoom: w => w.h.latest().receive({t: 'closed', app, code}),
  aloneOrUnseenForWaitingTime: w => w.h.clock.advance(600_000)
}

const told: {readonly [effect: string]: string} = {
  appToldCodeAndTerm: 'created',
  appToldServerLost: 'serverLost',
  appToldServerBack: 'serverBack'
}

const effect: {readonly [name: string]: (w: World) => void} = {
  writesRecord: w => assert.equal(w.h.record()?.token, 'owner token'),
  keepsLastArrivalInRecord: w => assert.equal(w.h.record()?.serverLostSince, w.lostAt),
  opensSignaling: w => assert.equal(w.h.transport.connections.length, w.connectionsFrom + 1),
  asksToReconnect: w => {
    ensureOpen(w)
    assert.equal(w.h.latest().sent.at(-1)?.t, 'reconnect')
  },
  sendsRoomClosedToParticipants: w => assert.equal(w.participant?.sent.at(-1), 'e{"reason":"room closed"}'),
  leavesSendingIdle: w => {
    assert.equal(w.participant?.sent.at(-1), 'e{"reason":"idle"}')
    const latest = w.h.latest()
    assert.equal(latest.last('leave') !== undefined, latest.peerId !== null && latest.closedByPage)
  }
}

const checkNext = (w: World, next: string, reason: string | undefined): void => {
  const h = w.h
  if (next === 'failed' || next === 'ended') {
    assert.deepEqual(h.told(next).at(-1), [{reason}])
    if (next === 'ended') {
      assert.equal(h.record(), null)
    }
    return
  }
  assert.deepEqual([h.told('failed'), h.told('ended')], [[], []])
  switch (next) {
    case 'owning':
      h.latest().receive({t: 'ask', app, code, n: 9, data: null})
      return assert.deepEqual(h.told('joinRequest').at(-1), [9, null])
    case 'offlineReconnecting':
      return assert.ok(h.latest().state === 'opening' || h.latest().sent.at(-1)?.t === 'reconnect')
    case 'offlinePausing': {
      const connections = h.transport.connections.length
      h.clock.advance(4_999)
      assert.equal(h.transport.connections.length, connections)
      h.clock.advance(1)
      return assert.equal(h.transport.connections.length, connections + 1)
    }
  }
  assert.fail(`no check of ${next}`)
}

const check = (w: World, outcome: Outcome): void => {
  for (const [name, handler] of Object.entries(told)) {
    assert.equal(w.h.namesSince(w.from).includes(handler), outcome.effects.includes(name), name)
  }
  for (const name of outcome.effects) {
    if (!(name in told)) {
      assert.ok(effect[name], `no check of ${name}`)
      effect[name](w)
    }
  }
  checkNext(w, outcome.next, outcome.reason)
}

const scenario = (state: State, event: Event): Scenario<Outcome> => {
  const run =
    (when?: string): Check<Outcome> =>
    async outcome => {
      const lostLongAgo = when === 'the waiting time has passed since the owner connection was lost'
      const w = await setup(state, {opening: event === 'signalingCannotOpen', unseen: event === 'aloneOrUnseenForWaitingTime', lostLongAgo})
      await fire[event](w)
      await settle()
      check(w, outcome)
    }
  const cell = table[state][event]
  if ('ids' in cell && 'branches' in cell.outcome) {
    return Object.fromEntries(cell.outcome.branches.map(branch => [branch.when, run(branch.when)]))
  }
  return run()
}

const forState = (state: State) =>
  Object.fromEntries((Object.keys(table[state]) as Event[]).map(event => [event, scenario(state, event)])) as {
    readonly [E in Event]: Scenario<Outcome>
  }

testCells<Table, Outcome>('owner page', table, {
  creating: forState('creating'),
  owning: forState('owning'),
  offlineReconnecting: forState('offlineReconnecting'),
  offlinePausing: forState('offlinePausing')
})

test('4-3 4-2 the app is told the term 1 when the room is created', async () => {
  const h = pageHarness()
  await h.owning()
  assert.deepEqual(h.told('created'), [[code, 1]])
  assert.equal(h.record()?.term, 1)
})

test('4-4 the app is not told "server lost" again before "server back"', async () => {
  const h = pageHarness()
  await h.owning()
  h.latest().drop()
  h.latest().drop()
  h.clock.advance(5_000)
  h.latest().open()
  h.latest().drop()
  assert.equal(h.told('serverLost').length, 1)
})

test('4-7 an owner page that is alone for 599 seconds stays, and a join request restarts the count', async () => {
  const h = pageHarness()
  await h.owning()
  h.clock.advance(599_000)
  h.latest().receive({t: 'ask', app, code, n: 2, data: null})
  h.latest().receive({t: 'ended', app, code, n: 2})
  h.clock.advance(599_999)
  assert.deepEqual(h.told('ended'), [])
  h.clock.advance(1)
  assert.deepEqual(h.told('ended'), [[{reason: 'idle'}]])
})

test('4-7 a visible participant keeps a hidden owner page from idling', async () => {
  const h = pageHarness()
  await ownerWithParticipant(h, 'visible')
  h.setVisible('hidden')
  h.clock.advance(3_600_000)
  assert.deepEqual(h.told('ended'), [])
})

test('4-1 the owner page goes from creating to owning, offline and back to owning', async () => {
  const h = pageHarness()
  await h.owning()
  h.latest().drop()
  h.latest().open('owner peer 2')
  h.latest().answer('roster', {roster: []}, 'reconnect')
  assert.deepEqual(
    h.events.map(event => event[0]),
    ['created', 'serverLost', 'serverBack']
  )
})
