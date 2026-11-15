import assert from 'node:assert/strict'
import {test} from 'node:test'
import {testCells, type Check, type Scenario} from './cells.ts'
import type {FakePeer, FakeSignaling} from './fake-transport.ts'
import {ownerPeer, pageHarness, settle, type PageHarness} from './page-harness.ts'
import {table} from './2-join.states.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = {readonly next: string; readonly reason?: string; readonly effects: readonly string[]}

interface World {
  readonly h: PageHarness
  readonly state: State
  peer: FakePeer | null
  letInAt: number
  attemptAt: number
  from: number
  connectionsFrom: number
  peersFrom: number
  sentFrom: Map<FakeSignaling, number>
}

const letInFields = {token: 'participant token', n: 2, wait: 600, owner: ownerPeer}

const sentSince = (w: World, t: string): number =>
  w.h.transport.connections.reduce(
    (count, connection) => count + connection.sent.slice(w.sentFrom.get(connection) ?? 0).filter(sent => sent.t === t).length,
    0
  )

const peers = (w: World): FakePeer[] => w.h.transport.connections.flatMap(connection => connection.peers)

const markWorld = (w: World): void => {
  w.from = w.h.mark()
  w.connectionsFrom = w.h.transport.connections.length
  w.peersFrom = peers(w).length
  w.sentFrom = new Map(w.h.transport.connections.map(connection => [connection, connection.sent.length]))
}

const ensureOpen = (w: World): void => {
  if (w.h.latest().state === 'opening') {
    w.h.latest().open()
  }
}

const returningSetup = async (w: World, opening: boolean): Promise<void> => {
  w.h.latest().drop()
  w.peer?.drop()
  await settle()
  if (!opening) {
    w.h.latest().open()
  }
}

const restart = async (w: World): Promise<void> => {
  await returningSetup(w, false)
  w.h.latest().answer('owner', {peer: ownerPeer}, 'return')
  w.peer = peers(w).at(-1) ?? null
  w.attemptAt = w.h.clock.now()
}

const setup = async (state: State, branch?: string, late = false): Promise<World> => {
  const h = pageHarness()
  const w: World = {h, state, peer: null, letInAt: 0, attemptAt: 0, from: 0, connectionsFrom: 0, peersFrom: 0, sentFrom: new Map()}
  if (state === 'asking') {
    await h.join()
  } else if (state === 'askingAgain' || state === 'waiting') {
    await h.join()
    h.latest().open()
    h.latest().answer('answer', {a: 'owner away'}, 'join')
    if (state === 'askingAgain') {
      h.clock.advance(5_000)
    }
  } else if (state === 'asked') {
    await h.asked()
  } else {
    const entered = await h.letIn()
    w.peer = entered.peer
    w.letInAt = h.clock.now()
    w.attemptAt = w.letInAt
    if (late && state !== 'attempting' && state !== 'lateAttempting') {
      h.clock.advance(26_000)
      if (state === 'spacing') {
        await restart(w)
      }
    }
    if (state === 'returning') {
      await returningSetup(w, branch === 'the signaling connection of the return request is still opening' || branch === undefined)
    } else if (state === 'pausing') {
      const couldNotOpen = branch === 'the signaling connection of the latest return request could not open'
      await returningSetup(w, couldNotOpen)
      if (couldNotOpen) {
        h.latest().drop()
      } else {
        h.latest().answer('answer', {a: 'owner away'}, 'return')
      }
    } else if (state === 'spacing') {
      await returningSetup(w, false)
      h.clock.advance(2_000)
      h.latest().answer('owner', {peer: ownerPeer}, 'return')
    } else if (state === 'lateAttempting') {
      h.clock.advance(30_000)
    }
  }
  markWorld(w)
  return w
}

const answerJoin = (w: World, t: string, fields: {readonly [key: string]: unknown} = {}): void => {
  ensureOpen(w)
  w.h.latest().answer(t, fields, 'join')
}

const answerReturn = (w: World, t: string, fields: {readonly [key: string]: unknown} = {}): void => {
  ensureOpen(w)
  w.h.latest().answer(t, fields, 'return')
}

const untilLetIn = (w: World, milliseconds: number): void => w.h.clock.advance(w.letInAt + milliseconds - w.h.clock.now())

const fire: {readonly [E in Event]: (w: World, branch?: string) => void | Promise<void>} = {
  joinAsked: w => {
    ensureOpen(w)
    w.h.latest().receive({t: 'asked', r: w.h.latest().last('join')?.r})
  },
  joinOwnerAway: w => answerJoin(w, 'answer', {a: 'owner away'}),
  joinNoRoom: w => answerJoin(w, 'answer', {a: 'no room'}),
  joinFull: w => answerJoin(w, 'answer', {a: 'full'}),
  joinBusy: w => answerJoin(w, 'answer', {a: 'busy'}),
  joinBadApp: w => answerJoin(w, 'answer', {a: 'bad app'}),
  joinLetIn: w => answerJoin(w, 'let in', letInFields),
  joinRefused: w => answerJoin(w, 'refused', {data: {why: 1}}),
  returnOwnerPeer: (w, branch) => {
    ensureOpen(w)
    w.h.clock.advance(branch === '5 seconds have passed since the previous attempt started' ? 5_000 : 2_000)
    markWorld(w)
    answerReturn(w, 'owner', {peer: ownerPeer})
  },
  returnOwnerAway: w => answerReturn(w, 'answer', {a: 'owner away'}),
  returnNoRoom: w => answerReturn(w, 'answer', {a: 'no room'}),
  returnRemoved: w => answerReturn(w, 'answer', {a: 'removed'}),
  noAnswer: w => {
    ensureOpen(w)
    w.h.clock.advance(w.state === 'asked' ? 65_000 : 15_000)
  },
  timer5s: w => w.h.clock.advance(w.state === 'spacing' ? w.attemptAt + 5_000 - w.h.clock.now() : 5_000),
  signalingCannotOpen: w => w.h.latest().drop(),
  signalingClosesWhileNeeded: w => {
    ensureOpen(w)
    w.h.latest().drop()
  },
  attemptOpensForRooms: w => {
    w.peer?.open()
    w.peer?.receive('c')
  },
  attemptCloses: async w => {
    w.peer?.drop()
    await settle()
  },
  passes30s: (w, branch) => {
    if (branch === 'otherwise') {
      ensureOpen(w)
    }
    markWorld(w)
    untilLetIn(w, 30_000)
  },
  passes45s: w => untilLetIn(w, 45_000)
}

const told: {readonly [effect: string]: string} = {
  appToldAsked: 'asked',
  appToldWaitingForOwner: 'waitingForOwner',
  appToldLetIn: 'letIn',
  appToldNumber: 'joined'
}

const effect: {readonly [name: string]: (w: World) => void} = {
  asksToJoin: w => assert.ok(sentSince(w, 'join') > 0),
  asksToReturn: w => assert.ok(sentSince(w, 'return') > 0 || w.h.transport.connections.length > w.connectionsFrom),
  asksAgainIn5s: () => {},
  connectsToOwner: w => assert.equal(peers(w).slice(w.peersFrom).at(-1)?.peerId, ownerPeer),
  writesRecord: w => assert.equal(w.h.record()?.token, 'participant token'),
  appGetsRefusalData: w => assert.deepEqual(w.h.told('failed').at(-1), [{reason: 'refused', joinData: {why: 1}}]),
  tellsServerLeaveIfSignalingOpen: w =>
    assert.equal(sentSince(w, 'leave'), w.h.latest().state === 'closed' && w.h.latest().closedByPage ? 1 : 0),
  closesAttempt: w => assert.ok(w.peer?.closedByModule)
}

const checkNext = async (w: World, next: string, reason: string | undefined): Promise<void> => {
  const h = w.h
  if (next === 'failed') {
    assert.deepEqual(h.told('failed').at(-1)?.[0], reason === 'refused' ? {reason, joinData: {why: 1}} : {reason})
    return
  }
  assert.deepEqual(h.told('failed'), [])
  switch (next) {
    case 'in':
      return assert.deepEqual(h.told('joined'), [[2]])
    case 'asked':
      return assert.ok(h.told('asked').length > 0)
    case 'askingAgain':
      return assert.ok(sentSince(w, 'join') > 0)
    case 'waiting': {
      markWorld(w)
      h.clock.advance(4_999)
      assert.equal(sentSince(w, 'join'), 0)
      h.clock.advance(1)
      return assert.equal(sentSince(w, 'join'), 1)
    }
    case 'attempting':
      return assert.equal(peers(w).slice(w.peersFrom).length, 1)
    case 'returning':
      return assert.ok(sentSince(w, 'return') > 0 || h.transport.connections.length > w.connectionsFrom)
    case 'pausing': {
      markWorld(w)
      h.clock.advance(4_999)
      assert.equal(sentSince(w, 'return') + h.transport.connections.length - w.connectionsFrom, 0)
      h.clock.advance(1)
      await settle()
      return assert.ok(sentSince(w, 'return') > 0 || h.transport.connections.length > w.connectionsFrom)
    }
    case 'spacing': {
      h.clock.advance(w.attemptAt + 4_999 - h.clock.now())
      assert.equal(peers(w).slice(w.peersFrom).length, 0)
      h.clock.advance(1)
      return assert.equal(peers(w).slice(w.peersFrom).length, 1)
    }
    case 'lateAttempting': {
      const attempt = peers(w).at(-1)
      assert.notEqual(attempt?.state, 'closed')
      untilLetIn(w, 45_000)
      return assert.deepEqual(h.told('failed').at(-1), [{reason: 'unreachable'}])
    }
  }
  assert.fail(`no check of ${next}`)
}

const check = async (
  w: World,
  outcome: {readonly next: string; readonly reason?: string; readonly effects: readonly string[]}
): Promise<void> => {
  for (const [name, handler] of Object.entries(told)) {
    assert.equal(w.h.namesSince(w.from).includes(handler), outcome.effects.includes(name), name)
  }
  for (const name of outcome.effects) {
    if (!(name in told)) {
      assert.ok(effect[name], `no check of ${name}`)
      effect[name](w)
    }
  }
  await checkNext(w, outcome.next, outcome.reason)
}

const scenario = (state: State, event: Event): Scenario<Outcome> => {
  const cell = table[state][event]
  const run =
    (branch?: string): Check<Outcome> =>
    async outcome => {
      const w = await setup(state, branch, event === 'passes30s' || event === 'passes45s')
      await fire[event](w, branch)
      await check(w, outcome)
    }
  if ('ids' in cell && 'branches' in cell.outcome) {
    return Object.fromEntries(cell.outcome.branches.map(branch => [branch.when, run(branch.when)]))
  }
  return run()
}

const forState = (state: State) =>
  Object.fromEntries((Object.keys(table[state]) as Event[]).map(event => [event, scenario(state, event)])) as {
    readonly [E in Event]: Scenario<Outcome>
  }

testCells<Table, Outcome>('joining', table, {
  asking: forState('asking'),
  askingAgain: forState('askingAgain'),
  waiting: forState('waiting'),
  asked: forState('asked'),
  attempting: forState('attempting'),
  returning: forState('returning'),
  pausing: forState('pausing'),
  spacing: forState('spacing'),
  lateAttempting: forState('lateAttempting')
})

test('2-2 joining fails with "bad app" or "no room" before the page opens a signaling connection', async () => {
  const h = pageHarness()
  h.rooms.join('Bad', 'BCDFG', null, h.handlers)
  await settle()
  const other = pageHarness()
  other.rooms.join('tictactoe', 'BCD', null, other.handlers)
  await settle()
  assert.deepEqual([h.told('failed'), other.told('failed')], [[[{reason: 'bad app'}]], [[{reason: 'no room'}]]])
  assert.equal(h.transport.connections.length + other.transport.connections.length, 0)
})

test('2-4 the app is told once that the page waits for the owner while it asks again every 5 seconds', async () => {
  const h = pageHarness()
  await h.join()
  h.latest().open()
  for (let round = 0; round < 3; round += 1) {
    h.latest().answer('answer', {a: 'owner away'}, 'join')
    h.clock.advance(5_000)
  }
  assert.equal(h.told('waitingForOwner').length, 1)
  assert.equal(h.latest().sent.filter(sent => sent.t === 'join').length, 4)
})

test('2-7 the page does not write the record before the join completes', async () => {
  const h = pageHarness()
  await h.letIn()
  assert.equal(h.record(), null)
})

test('2-9 an attempt starts 5 seconds after the previous one at the earliest, and none later than 30 seconds after the page was let in', async () => {
  const h = pageHarness()
  const {peer} = await h.letIn()
  const attempts = () => h.transport.connections.flatMap(connection => connection.peers)
  h.clock.advance(27_000)
  peer.drop()
  await settle()
  h.latest().answer('owner', {peer: ownerPeer}, 'return')
  assert.equal(attempts().length, 2)
  h.clock.advance(1_000)
  attempts().at(-1)?.drop()
  await settle()
  h.latest().answer('owner', {peer: ownerPeer}, 'return')
  h.clock.advance(1_999)
  assert.equal(attempts().length, 2)
  assert.deepEqual(h.told('failed'), [])
  h.clock.advance(1)
  assert.deepEqual(h.told('failed'), [[{reason: 'unreachable'}]])
  assert.equal(attempts().length, 2)
})

test('2-9 an attempt that is due 30 seconds after the page was let in starts', async () => {
  const h = pageHarness()
  const {peer} = await h.letIn()
  const attempts = () => h.transport.connections.flatMap(connection => connection.peers)
  h.clock.advance(25_000)
  peer.drop()
  await settle()
  h.latest().answer('owner', {peer: ownerPeer}, 'return')
  h.clock.advance(1_000)
  attempts().at(-1)?.drop()
  await settle()
  h.latest().answer('owner', {peer: ownerPeer}, 'return')
  h.clock.advance(3_999)
  assert.equal(attempts().length, 2)
  h.clock.advance(1)
  assert.equal(attempts().length, 3)
  assert.deepEqual(h.told('failed'), [])
  attempts().at(-1)?.open()
  attempts().at(-1)?.receive('c')
  assert.deepEqual(h.told('joined'), [[2]])
})

test('2-10 joining fails with "unreachable" and a leave when the latest return connection opened after an earlier one could not', async () => {
  const h = pageHarness()
  const {peer} = await h.letIn()
  h.latest().drop()
  peer.drop()
  await settle()
  h.latest().drop()
  h.clock.advance(26_000)
  h.latest().open()
  h.latest().answer('answer', {a: 'owner away'}, 'return')
  h.clock.advance(4_000)
  assert.deepEqual(h.told('failed'), [[{reason: 'unreachable'}]])
  assert.equal(h.latest().last('leave')?.token, 'participant token')
})

test('2-10 joining fails with "offline" when no attempt is open and the return connection could not open', async () => {
  const h = pageHarness()
  const {peer} = await h.letIn()
  h.latest().drop()
  peer.drop()
  await settle()
  h.latest().drop()
  h.clock.advance(30_000)
  assert.deepEqual(h.told('failed').at(-1), [{reason: 'offline'}])
})

test('2-1 a new participant goes from asking through asked and admitted into the room', async () => {
  const h = pageHarness()
  await h.inRoom()
  assert.deepEqual(
    h.events.map(event => event[0]),
    ['asked', 'letIn', 'joined', 'path']
  )
})
