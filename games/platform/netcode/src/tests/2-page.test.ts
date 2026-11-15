import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {End, Failure} from '../index.ts'
import {table} from './2-page.states.ts'
import {cellTests, type Scenarios} from './cells.ts'
import {
  code,
  harness,
  hosting,
  joinedPage,
  names,
  playingPage,
  recoveringHost,
  returningPage,
  since,
  versions,
  type Harness
} from './harness.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']

const setups: {readonly [S in State]: (h: Harness) => void} = {
  none: () => {},
  starting: h => h.netcode.start(),
  recovering: h => recoveringHost(h, {versions}),
  hosting: h => hosting(h),
  joining: h => h.netcode.enter(code),
  waiting: h => {
    h.netcode.enter(code)
    h.rooms.on.asked()
  },
  joined: h => joinedPage(h),
  returning: h => returningPage(h),
  playing: h => playingPage(h),
  hostAway: h => {
    playingPage(h)
    h.rooms.on.ownerLost()
  }
}

const events: {readonly [E in Event]: (h: Harness) => void} = {
  start: h => h.netcode.start(),
  enterNew: h => h.netcode.enter(code),
  enterRecordParticipant: h => returningPage(h),
  enterRecordHost: h => recoveringHost(h, {versions}),
  badRules: h => {
    h.failing.seats = true
    h.netcode.start()
  },
  leave: h => h.netcode.leave(),
  openElsewhere: h => h.rooms.on.failed({reason: 'open elsewhere'}),
  roomCreated: h => h.rooms.on.created(code, 1),
  roomsFails: h => h.rooms.on.failed({reason: 'outdated', older: 'server'}),
  roomEnds: h => h.rooms.on.ended({reason: 'outdated', older: 'server'}),
  serverLost: h => h.rooms.on.serverLost(),
  serverBack: h => h.rooms.on.serverBack()
}

const toldKinds = new Set(['entering', 'code', 'failed', 'ended', 'server lost', 'server back'])
const hostStates = new Set<State>(['recovering', 'hosting'])

const run = (state: State, event: Event, outcome: Outcome): void => {
  const h = harness()
  setups[state](h)
  const mark = h.told.length
  const roomsBefore = h.rooms.rooms.length
  events[event](h)
  assert.equal(h.netcode.phase, outcome.next)
  assert.deepEqual(
    names(h, mark).filter(name => toldKinds.has(name)),
    outcome.told
  )
  const ending = since(h, mark).find(([name]) => name === 'failed' || name === 'ended')?.[1] as Failure | End | undefined
  if (outcome.cause !== undefined) {
    const expected = outcome.cause === 'open elsewhere' || outcome.cause === 'bad rules' ? outcome.cause : 'outdated'
    assert.equal(ending?.cause, expected)
  }
  if (outcome.olderSide) {
    assert.equal(ending !== undefined && 'older' in ending ? ending.older : undefined, 'server')
  }
  const previous = h.rooms.rooms[roomsBefore - 1]
  const leftPrevious = previous?.left ?? false
  assert.equal(leftPrevious, outcome.leavesLastGameFirst === true || outcome.leavesRoom === true)
  if (outcome.roomClosesForAll) {
    assert.ok(hostStates.has(state) && leftPrevious)
  }
}

const scenarios = Object.fromEntries(
  Object.entries(table).map(([state, cells]) => [
    state,
    Object.fromEntries(Object.keys(cells).map(event => [event, (outcome: Outcome) => run(state as State, event as Event, outcome)]))
  ])
) as Scenarios<Table>

cellTests(table, scenarios)

test('2-2 starting fails with open elsewhere when the rooms module gives no room', () => {
  const h = harness()
  h.rooms.refuseCalls = true
  h.netcode.start()
  assert.deepEqual(since(h, 0), [['failed', {cause: 'open elsewhere'}]])
  assert.equal(h.netcode.phase, 'none')
})

test('2-3 starting creates a room with the app ID and waiting time, and completes with the code', () => {
  const h = harness()
  hosting(h)
  assert.deepEqual(h.rooms.calls[0], {kind: 'create', appId: 'when.party/test', waitingSeconds: 600})
  assert.deepEqual(since(h, 0)[0], ['code', code])
})

test('2-3 each cause of a failed creation passes through', () => {
  for (const reason of ['bad app', 'bad wait', 'busy', 'offline'] as const) {
    const h = harness()
    h.netcode.start()
    h.rooms.on.failed({reason})
    assert.deepEqual(since(h, 0), [['failed', {cause: reason}]])
  }
})

test('2-4 the netcode turns typed text into a room code as the rooms module does', () => {
  const h = harness()
  assert.equal(h.netcode.parseCode(' bc-dfg '), 'BCDFG')
  assert.equal(h.netcode.parseCode('BCDF'), null)
})

test('2-5 entering joins with the page versions as the join data', () => {
  const h = harness()
  h.netcode.enter(code)
  assert.deepEqual(h.rooms.calls[0], {kind: 'join', appId: 'when.party/test', code, joinData: {versions}})
})

test('2-6 a page is told entering when it enters, and again when waiting for the host ends', () => {
  const h = harness()
  h.netcode.enter(code)
  h.rooms.on.asked()
  h.rooms.on.letIn()
  assert.deepEqual(names(h, 0), ['entering', 'waiting', 'entering'])
})

test('2-7 after the game ended the netcode tells nothing more', () => {
  const h = harness()
  playingPage(h)
  const room = h.rooms.last
  room.handlers.ended?.({reason: 'room closed'})
  const mark = h.told.length
  room.handlers.ownerLost?.()
  room.handlers.text?.('{}', 1)
  room.handlers.ended?.({reason: 'idle'})
  assert.deepEqual(since(h, mark), [])
})

test('2-7 every cause of the end of a room passes through', () => {
  for (const reason of ['room closed', 'idle', 'owner away', 'removed', 'unreachable', 'no relay'] as const) {
    const h = harness()
    playingPage(h)
    h.rooms.on.ended({reason})
    assert.deepEqual(since(h, 0).at(-1), ['ended', {cause: reason}])
  }
})

test('2-8 outdated tells the older side that the rooms module tells', () => {
  for (const [older, side] of [
    ['page', 'page'],
    ['server', 'server'],
    ['owner', 'page']
  ] as const) {
    const h = harness()
    playingPage(h)
    h.rooms.on.ended({reason: 'outdated', older})
    assert.deepEqual(since(h, 0).at(-1), ['ended', {cause: 'outdated', older: side}])
  }
})

test('2-10 with each snapshot the page is told its number, seat and whether it hosts', () => {
  const h = harness()
  hosting(h, [2, 3])
  const host = since(h, 0)
    .filter(([name]) => name === 'snapshot')
    .at(-1)?.[1] as {participant: number; seat: string | null; isHost: boolean}
  assert.deepEqual([host.participant, host.seat, host.isHost], [1, 'A', true])
  const p = harness()
  playingPage(p, {seats: [1, null], queue: [2]})
  const view = since(p, 0)
    .filter(([name]) => name === 'snapshot')
    .at(-1)?.[1] as {participant: number; seat: string | null; isHost: boolean}
  assert.deepEqual([view.participant, view.seat, view.isHost], [2, null, false])
})

test('2-11 a late answer after leaving creates nothing', () => {
  const h = harness()
  h.netcode.start()
  const room = h.rooms.last
  h.netcode.leave()
  room.handlers.created?.(code, 1)
  assert.equal(h.netcode.phase, 'none')
  assert.deepEqual(since(h, 0), [])
  assert.deepEqual(room.sent, [])
})

test('2-13 a first entry fails with the cause of the failed join', () => {
  for (const reason of ['bad app', 'no room', 'full', 'busy', 'refused', 'unreachable', 'offline'] as const) {
    const h = harness()
    h.netcode.enter(code)
    h.rooms.on.failed(reason === 'refused' ? {reason, joinData: undefined} : {reason})
    assert.deepEqual(since(h, 0).at(-1), ['failed', {cause: reason}])
  }
})

test('2-13 an end of the room after the join and before the first snapshot fails as the table says', () => {
  for (const [reason, cause] of [
    ['room closed', 'no room'],
    ['idle', 'no room'],
    ['owner away', 'owner away'],
    ['removed', 'unreachable'],
    ['unreachable', 'unreachable'],
    ['no relay', 'unreachable']
  ] as const) {
    const h = harness()
    joinedPage(h)
    h.rooms.on.ended({reason})
    assert.deepEqual(since(h, 0).at(-1), ['failed', {cause}])
  }
})
