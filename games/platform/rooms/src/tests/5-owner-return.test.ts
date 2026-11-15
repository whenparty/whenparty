import assert from 'node:assert/strict'
import {test} from 'node:test'
import {testCells, type Check, type Scenario} from './cells.ts'
import {app, code, pageHarness, settle, type PageHarness} from './page-harness.ts'
import {table} from './5-owner-return.states.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = {readonly next: string; readonly reason?: string; readonly effects: readonly string[]}

interface World {
  readonly h: PageHarness
  readonly lostAt: number
  from: number
  connectionsFrom: number
}

const ensureOpen = (w: World): void => {
  if (w.h.latest().state === 'opening') {
    w.h.latest().open('owner peer 2')
  }
}

const setup = async (state: State, opening: boolean): Promise<World> => {
  const h = pageHarness()
  const lostAt = h.clock.now() - 1_000
  h.putRecord(h.ownerRecord({serverLostSince: lostAt, numbers: [{n: 2, joined: true, lostSince: null}]}))
  h.rooms.return(app, h.handlers)
  await settle()
  if (state === 'returningPausing') {
    h.latest().drop()
  } else if (!opening) {
    h.latest().open('owner peer 2')
  }
  return {h, lostAt, from: h.mark(), connectionsFrom: h.transport.connections.length}
}

const answer = (w: World, t: string, fields: {readonly [key: string]: unknown}): void => {
  ensureOpen(w)
  w.h.latest().answer(t, fields, 'return')
}

const fire: {readonly [E in Event]: (w: World) => void} = {
  termAndRosterAnswer: w => answer(w, 'roster', {term: 2, roster: [2, 3]}),
  otherTermAnswer: w => answer(w, 'term', {term: 4}),
  noRoomOrRemovedAnswer: w => answer(w, 'answer', {a: 'no room'}),
  noAnswer: w => {
    ensureOpen(w)
    w.h.clock.advance(15_000)
  },
  signalingCannotOpen: w => w.h.latest().drop(),
  signalingCloses: w => {
    ensureOpen(w)
    w.h.latest().drop()
  },
  timer5s: w => w.h.clock.advance(5_000),
  waitingTimePasses: w => w.h.clock.advance(w.lostAt + 600_000 - w.h.clock.now())
}

const effect: {readonly [name: string]: (w: World) => void} = {
  appToldTermAndRoster: w => assert.deepEqual(w.h.told('ownerReturned').at(-1), [2, [2]]),
  writesRecord: w => assert.deepEqual([w.h.record()?.term, w.h.record()?.serverLostSince], [2, null]),
  asksAgainWithThatTerm: w => assert.equal(w.h.latest().sent.at(-1)?.term, 4),
  asksAgainIn5s: () => {},
  asksToReturn: w => {
    ensureOpen(w)
    assert.equal(w.h.latest().sent.at(-1)?.t, 'return')
  }
}

const checkNext = (w: World, next: string, reason: string | undefined): void => {
  const h = w.h
  if (next === 'ended') {
    assert.deepEqual(h.told('ended').at(-1), [{reason}])
    assert.equal(h.record(), null)
    return
  }
  assert.deepEqual(h.told('ended'), [])
  switch (next) {
    case 'owning':
      h.latest().receive({t: 'ask', app, code, n: 9, data: null})
      return assert.deepEqual(h.told('joinRequest').at(-1), [9, null])
    case 'returningAsking':
      return assert.ok(h.latest().state === 'opening' || h.latest().sent.at(-1)?.t === 'return')
    case 'returningPausing': {
      const connections = h.transport.connections.length
      h.clock.advance(4_999)
      assert.equal(h.transport.connections.length, connections)
      h.clock.advance(1)
      return assert.equal(h.transport.connections.length, connections + 1)
    }
  }
  assert.fail(`no check of ${next}`)
}

const scenario = (state: State, event: Event): Scenario<Outcome> => {
  const run: Check<Outcome> = async outcome => {
    const w = await setup(state, event === 'signalingCannotOpen')
    fire[event](w)
    await settle()
    for (const name of outcome.effects) {
      assert.ok(effect[name], `no check of ${name}`)
      effect[name](w)
    }
    if (!outcome.effects.includes('appToldTermAndRoster')) {
      assert.deepEqual(w.h.told('ownerReturned'), [])
    }
    checkNext(w, outcome.next, outcome.reason)
  }
  const cell = table[state][event]
  if ('ids' in cell && 'branches' in cell.outcome) {
    return Object.fromEntries(cell.outcome.branches.map(branch => [branch.when, run]))
  }
  return run
}

const forState = (state: State) =>
  Object.fromEntries((Object.keys(table[state]) as Event[]).map(event => [event, scenario(state, event)])) as {
    readonly [E in Event]: Scenario<Outcome>
  }

testCells<Table, Outcome>('owner return', table, {
  returningAsking: forState('returningAsking'),
  returningPausing: forState('returningPausing')
})

test('5-1 5-5 the return asks with the term and the leaves that the record keeps', async () => {
  const h = pageHarness()
  h.putRecord(h.ownerRecord({term: 3, leaves: [4]}))
  h.rooms.return(app, h.handlers)
  await settle()
  h.latest().open()
  const request = h.latest().last('return')
  assert.deepEqual([request?.term, request?.leaves, request?.token], [3, [4], 'owner token'])
  assert.deepEqual(h.told('returning'), [['owner', 1, undefined]])
})

test('5-2 the roster keeps the joined numbers of the record, a new number is lost since the answer, and a left-out one is forgotten', async () => {
  const h = pageHarness()
  const started = h.clock.now()
  h.putRecord(
    h.ownerRecord({
      numbers: [
        {n: 2, joined: true, lostSince: started - 10_000},
        {n: 3, joined: false, lostSince: null},
        {n: 4, joined: true, lostSince: null}
      ]
    })
  )
  h.rooms.return(app, h.handlers)
  await settle()
  h.latest().open()
  h.clock.advance(1_000)
  h.latest().answer('roster', {term: 2, roster: [2, 3, 5]}, 'return')
  assert.deepEqual(h.told('ownerReturned'), [[2, [2]]])
  assert.deepEqual(
    (h.record()?.numbers as {readonly n: number}[]).map(entry => entry.n),
    [2, 3, 5]
  )
  assert.deepEqual(h.told('participantLost'), [])
  h.clock.advance(589_000)
  assert.deepEqual(h.told('participantLeft'), [[2]])
  const leaves = () =>
    h
      .latest()
      .sent.filter(sent => sent.t === 'left')
      .map(sent => sent.n)
  h.clock.advance(10_000)
  assert.deepEqual(leaves(), [2, 3])
  h.clock.advance(999)
  assert.deepEqual(leaves(), [2, 3])
  h.clock.advance(1)
  assert.deepEqual(leaves(), [2, 3, 5])
})

test('5-4 a record that keeps the owner connection gets the moment the return started', async () => {
  const h = pageHarness()
  h.putRecord(h.ownerRecord())
  h.rooms.return(app, h.handlers)
  await settle()
  assert.equal(h.record()?.serverLostSince, h.clock.now())
})
