import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {Room} from '../api.ts'
import {testCells, type Check, type Scenario} from './cells.ts'
import type {FakePeer, FakeSignaling} from './fake-transport.ts'
import {app, code, ownerPeer, pageHarness, settle, type PageHarness} from './page-harness.ts'
import {table} from './3-participant.states.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = {readonly next: string; readonly reason?: string; readonly effects: readonly string[]}

interface World {
  readonly h: PageHarness
  room: Room
  peer: FakePeer | null
  previous: FakePeer | null
  lostAt: number
  linkOpenAtDeadline: boolean
  from: number
  connectionsFrom: number
  peersFrom: number
  sentFrom: Map<FakeSignaling, number>
}

const peers = (w: World): FakePeer[] => w.h.transport.connections.flatMap(connection => connection.peers)

const sentSince = (w: World, t: string): number =>
  w.h.transport.connections.reduce(
    (count, connection) => count + connection.sent.slice(w.sentFrom.get(connection) ?? 0).filter(sent => sent.t === t).length,
    0
  )

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

type History = 'noRelay' | 'timeout' | 'ownerAway'

const lose = async (w: World, opening: boolean): Promise<void> => {
  if (opening) {
    w.h.latest().drop()
  }
  w.lostAt = w.h.clock.now() - 2_000
  w.previous = w.peer
  w.peer?.drop('broken', w.lostAt)
  w.peer = null
  await settle()
}

const comeBack = async (w: World): Promise<void> => {
  await lose(w, false)
  w.h.latest().answer('owner', {peer: ownerPeer}, 'return')
  w.peer = peers(w).at(-1) ?? null
  w.peer?.open()
  w.peer?.receive('c')
}

const toState = async (w: World, state: State, history: History | undefined, opening: boolean): Promise<void> => {
  if (state === 'in') {
    return
  }
  await lose(w, opening && history === undefined && state === 'lostReturning')
  if (history !== undefined) {
    ensureOpen(w)
    if (history === 'ownerAway') {
      w.h.latest().answer('answer', {a: 'owner away'}, 'return')
    } else {
      w.h.latest().answer('owner', {peer: ownerPeer}, 'return')
      peers(w)
        .at(-1)
        ?.drop(history === 'noRelay' ? 'no relay' : 'timeout')
      await settle()
    }
    if (state !== 'lostPausing') {
      w.h.clock.advance(5_000)
      await settle()
    }
  }
  if (state === 'lostPausing' && history === undefined) {
    ensureOpen(w)
    w.h.latest().answer('answer', {a: 'owner away'}, 'return')
  }
  if (state === 'lostAttempting') {
    ensureOpen(w)
    w.h.latest().answer('owner', {peer: ownerPeer}, 'return')
    w.peer = peers(w).at(-1) ?? null
  }
}

const setup = async (
  state: State,
  {
    history,
    opening = false,
    fromRecordCode = false
  }: {readonly history?: History; readonly opening?: boolean; readonly fromRecordCode?: boolean} = {}
): Promise<World> => {
  const h = pageHarness()
  if (fromRecordCode) {
    h.putRecord(h.participantRecord({ownerLostSince: h.clock.now() - 2_000}))
    const room = await h.join(null, code)
    const w: World = {
      h,
      room,
      peer: null,
      previous: null,
      lostAt: h.clock.now() - 2_000,
      linkOpenAtDeadline: false,
      from: 0,
      connectionsFrom: 0,
      peersFrom: 0,
      sentFrom: new Map()
    }
    markWorld(w)
    return w
  }
  const {room, peer} = await h.inRoom()
  const w: World = {
    h,
    room,
    peer,
    previous: null,
    lostAt: 0,
    linkOpenAtDeadline: false,
    from: 0,
    connectionsFrom: 0,
    peersFrom: 0,
    sentFrom: new Map()
  }
  await toState(w, state, history, opening)
  markWorld(w)
  return w
}

const answerReturn = (w: World, t: string, fields: {readonly [key: string]: unknown} = {}): void => {
  ensureOpen(w)
  w.h.latest().answer(t, fields, 'return')
}

const fire: {readonly [E in Event]: (w: World) => void | Promise<void>} = {
  openConnectionCloses: async w => {
    w.lostAt = w.h.clock.now() - 3_000
    w.peer?.drop('broken', w.lostAt)
    await settle()
  },
  attemptCloses: async w => {
    w.peer?.drop('timeout')
    await settle()
  },
  attemptOpensForRooms: w => {
    w.peer?.open()
    w.peer?.receive('c')
  },
  returnOwnerPeer: w => answerReturn(w, 'owner', {peer: ownerPeer}),
  returnOwnerAway: w => answerReturn(w, 'answer', {a: 'owner away'}),
  returnNoRoom: w => answerReturn(w, 'answer', {a: 'no room'}),
  returnRemoved: w => answerReturn(w, 'answer', {a: 'removed'}),
  noAnswer: w => {
    ensureOpen(w)
    w.h.clock.advance(15_000)
  },
  timer5s: async w => {
    w.h.clock.advance(5_000)
    await settle()
  },
  signalingCannotOpen: w => w.h.latest().drop(),
  signalingCloses: w => {
    ensureOpen(w)
    w.h.latest().drop()
  },
  ownerSendsEnd: w => w.peer?.receive('e{"reason":"idle"}'),
  waitingTimePasses: w => {
    w.h.clock.advance(w.lostAt + 599_999 - w.h.clock.now())
    w.linkOpenAtDeadline = w.h.latest().state === 'open'
    w.h.clock.advance(1)
  },
  previousConnectionEvent: w => {
    const previous = w.previous ?? w.peer
    previous?.handlers.text?.('tlate')
    previous?.handlers.closed?.({reason: 'broken', lastArrivalAt: w.h.clock.now()})
  }
}

const told: {readonly [effect: string]: string} = {appToldOwnerLost: 'ownerLost', appToldOwnerBack: 'ownerBack'}

const effect: {readonly [name: string]: (w: World) => void} = {
  keepsLastArrivalInRecord: w => assert.equal(w.h.record()?.ownerLostSince, w.lostAt),
  asksToReturn: w => assert.ok(sentSince(w, 'return') > 0 || w.h.transport.connections.length > w.connectionsFrom),
  asksAgainIn5s: () => {},
  connectsToOwner: w => assert.equal(peers(w).slice(w.peersFrom).at(-1)?.peerId, ownerPeer),
  deletesRecordAndJoinsAsNew: w => {
    assert.equal(w.h.record(), null)
    assert.equal(sentSince(w, 'join'), 1)
  },
  tellsServerLeaveIfSignalingOpen: w => assert.equal(sentSince(w, 'leave'), w.linkOpenAtDeadline ? 1 : 0)
}

const checkNext = async (w: World, next: string, reason: string | undefined): Promise<void> => {
  const h = w.h
  if (next === 'ended') {
    assert.deepEqual(h.told('ended').at(-1), [{reason: reason === 'the reason the owner page sent' ? 'idle' : reason}])
    assert.equal(h.record(), null)
    return
  }
  assert.deepEqual(h.told('ended'), [])
  switch (next) {
    case 'in':
      return assert.ok(w.room.send('hello'))
    case 'joiningAsNew':
      return assert.equal(h.record(), null)
    case 'lostReturning':
      assert.equal(w.room.send('hello'), false)
      return assert.ok(sentSince(w, 'return') > 0 || h.latest().state === 'opening' || h.latest().sent.at(-1)?.t === 'return')
    case 'lostPausing': {
      markWorld(w)
      h.clock.advance(4_999)
      assert.equal(sentSince(w, 'return') + h.transport.connections.length - w.connectionsFrom, 0)
      h.clock.advance(1)
      await settle()
      return assert.ok(sentSince(w, 'return') > 0 || h.transport.connections.length > w.connectionsFrom)
    }
    case 'lostAttempting':
      assert.equal(w.room.send('hello'), false)
      return assert.notEqual(peers(w).at(-1)?.state, 'closed')
  }
  assert.fail(`no check of ${next}`)
}

const check = async (w: World, outcome: Outcome): Promise<void> => {
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

const branchSetup: {readonly [when: string]: {readonly history?: History; readonly fromRecordCode?: boolean; readonly waited?: boolean}} = {
  'the latest answer to its returns gave the owner page peer ID, and its latest peer connection closed with no relay': {history: 'noRelay'},
  'the latest answer to its returns gave the owner page peer ID': {history: 'timeout'},
  'the waiting time has passed since the owner was lost': {waited: true},
  'the return started from a join with the record code': {fromRecordCode: true},
  otherwise: {}
}

const scenario = (state: State, event: Event): Scenario<Outcome> => {
  const run =
    (when?: string): Check<Outcome> =>
    async outcome => {
      const branch = when === undefined ? {} : (branchSetup[when] ?? {})
      const history = branch.history ?? (when === 'otherwise' && event === 'waitingTimePasses' ? 'ownerAway' : undefined)
      const w = await setup(state, {history, opening: event === 'signalingCannotOpen', fromRecordCode: branch.fromRecordCode})
      if (state === 'in' && event === 'previousConnectionEvent') {
        await comeBack(w)
        markWorld(w)
      }
      if (branch.waited) {
        w.h.clock.jump(600_000)
      }
      await fire[event](w)
      await check(w, outcome)
    }
  const cell = table[state][event]
  if ('ids' in cell && 'branches' in cell.outcome) {
    return Object.fromEntries(
      cell.outcome.branches.map(branch => [
        branch.when,
        state === 'lostAttempting' && event === 'waitingTimePasses' && branch.when === 'otherwise'
          ? {impossible: 'a page attempts to connect only after an answer that gave it the owner page peer ID (3-4)'}
          : run(branch.when)
      ])
    )
  }
  return run()
}

const forState = (state: State) =>
  Object.fromEntries((Object.keys(table[state]) as Event[]).map(event => [event, scenario(state, event)])) as {
    readonly [E in Event]: Scenario<Outcome>
  }

testCells<Table, Outcome>('participant', table, {
  in: forState('in'),
  lostReturning: forState('lostReturning'),
  lostPausing: forState('lostPausing'),
  lostAttempting: forState('lostAttempting')
})

test('3-1 3-9 a participant page that returns from its record is lost from the moment the record keeps, without "owner lost"', async () => {
  const h = pageHarness()
  const lostAt = h.clock.now() - 100_000
  h.putRecord(h.participantRecord({ownerLostSince: lostAt}))
  await h.join(null, code)
  assert.deepEqual(h.told('returning'), [['participant', 2, undefined]])
  assert.deepEqual(h.told('ownerLost'), [])
  h.clock.advance(499_999)
  assert.deepEqual(h.told('ended'), [])
  h.clock.advance(1)
  assert.deepEqual(h.told('ended'), [[{reason: 'owner away'}]])
})

test('3-9 a record without a lost moment gets the moment the return started', async () => {
  const h = pageHarness()
  h.putRecord(h.participantRecord())
  h.rooms.return(app, h.handlers)
  await settle()
  assert.equal(h.record()?.ownerLostSince, h.clock.now())
})

test('3-2 a participant page opens a signaling connection only when it needs to ask', async () => {
  const h = pageHarness()
  const {peer} = await h.inRoom()
  h.latest().drop()
  h.clock.advance(60_000)
  assert.equal(h.transport.connections.length, 1)
  peer.drop()
  await settle()
  assert.equal(h.transport.connections.length, 2)
})

test('3-10 the page starts a new peer connection to the owner only after closing the previous one', async () => {
  const h = pageHarness()
  const {peer} = await h.inRoom()
  peer.drop()
  await settle()
  h.latest().answer('owner', {peer: ownerPeer}, 'return')
  const attempts = h.transport.connections.flatMap(connection => connection.peers)
  assert.equal(attempts.length, 2)
  assert.equal(attempts.filter(attempt => attempt.state !== 'closed').length, 1)
})
