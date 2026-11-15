import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {End, Failure} from '../index.ts'
import {createNetcode} from '../index.ts'
import {table} from './3-entry.states.ts'
import {cellTests, type Scenarios} from './cells.ts'
import {FakeRooms} from './fakes.ts'
import {
  code,
  format,
  harness,
  joinedPage,
  names,
  playingPage,
  returningPage,
  since,
  snapshotText,
  versions,
  type Harness
} from './harness.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']

const setups: {readonly [S in State]: (h: Harness) => void} = {
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

const otherVersions: [number, number] = [1, format + 1]

const backIfAway = (h: Harness, state: State): void => {
  if (state === 'hostAway') {
    h.rooms.on.ownerBack()
  }
}

const events: {readonly [E in Event]: (h: Harness, state: State) => void} = {
  asked: h => h.rooms.on.asked(),
  waitingForOwner: h => h.rooms.on.waitingForOwner(),
  letIn: h => h.rooms.on.letIn(),
  joinCompleted: h => h.rooms.on.joined(2),
  refusedOtherVersion: h => h.rooms.on.failed({reason: 'refused', joinData: {versions: otherVersions}}),
  ownerLost: h => h.rooms.on.ownerLost(),
  ownerBack: h => h.rooms.on.ownerBack(),
  removedEntersAsNew: h => h.rooms.on.asked(),
  snapshotTaken: (h, state) => {
    backIfAway(h, state)
    h.rooms.on.text(snapshotText({n: state === 'playing' || state === 'hostAway' ? 2 : 1}), 1)
  },
  snapshotEqual: (h, state) => {
    backIfAway(h, state)
    h.rooms.on.text(snapshotText({n: 1}), 1)
  },
  snapshotDropped: h => h.rooms.on.text(snapshotText({n: 5, seats: [1]}), 1),
  snapshotOtherVersion: h => h.rooms.on.text(snapshotText({versions: otherVersions, n: 5}), 1)
}

const toldOf = (h: Harness, mark: number): string[] =>
  since(h, mark).flatMap(([name, value]) => {
    switch (name) {
      case 'waiting':
        return [value === 'decides' ? 'waiting: host decides' : 'waiting: host offline']
      case 'host away':
      case 'host back':
        return [name]
      case 'failed':
      case 'ended':
        return (value as Failure | End).cause === 'other version' ? ['other version'] : []
      default:
        return []
    }
  })

const run = (state: State, event: Event, outcome: Outcome): void => {
  const h = harness()
  setups[state](h)
  const mark = h.told.length
  events[event](h, state)
  if (event === 'removedEntersAsNew') {
    assert.equal(h.netcode.phase, 'waiting')
    assert.deepEqual(toldOf(h, mark), ['waiting: host decides'])
    return
  }
  if (outcome.next === 'failed' || outcome.next === 'ended') {
    assert.equal(h.netcode.phase, 'none')
    assert.ok(names(h, mark).includes(outcome.next))
  } else {
    assert.equal(h.netcode.phase, outcome.next)
  }
  assert.deepEqual(toldOf(h, mark), outcome.told)
  assert.equal(h.rooms.last.left, outcome.leavesRoom === true)
}

const scenarios = Object.fromEntries(
  Object.entries(table).map(([state, cells]) => [
    state,
    Object.fromEntries(Object.keys(cells).map(event => [event, (outcome: Outcome) => run(state as State, event as Event, outcome)]))
  ])
) as Scenarios<Table>

cellTests(table, scenarios)

test('3-3 entering after the join has no time limit', () => {
  const h = harness()
  joinedPage(h)
  h.clock.advance(3_600_000)
  assert.equal(h.netcode.phase, 'joined')
})

test('3-4 the versions are compared by protocol version first, then by format version', () => {
  for (const [theirs, older] of [
    [[2, 1], 'page'],
    [[1, format + 1], 'page'],
    [[1, format - 1], 'host']
  ] as const) {
    const h = harness()
    playingPage(h)
    h.rooms.on.text(snapshotText({versions: theirs, n: 2}), 1)
    assert.deepEqual(since(h, 0).at(-1), ['ended', {cause: 'other version', older}])
  }
})

test('3-5 the page leaves the room before it tells other version', () => {
  for (const setup of [joinedPage, playingPage]) {
    const base = harness()
    const rooms = new FakeRooms()
    const leftWhenTold: boolean[] = []
    const tell = () => leftWhenTold.push(rooms.last.left)
    const netcode = createNetcode(base.title, {failed: tell, ended: tell}, {...base, rooms, random: () => 0})
    setup({...base, rooms, netcode})
    rooms.on.text(snapshotText({versions: otherVersions, n: 5}), 1)
    assert.deepEqual(leftWhenTold, [true])
  }
})

test('3-5 a refusal that carries the page own versions fails with refused', () => {
  const h = harness()
  h.netcode.enter(code)
  h.rooms.on.asked()
  h.rooms.on.failed({reason: 'refused', joinData: {versions}})
  assert.deepEqual(since(h, 0).at(-1), ['failed', {cause: 'refused'}])
})

test('3-6 host away is told once until host back', () => {
  const h = harness()
  playingPage(h)
  h.rooms.on.ownerLost()
  h.rooms.on.ownerBack()
  h.rooms.on.ownerLost()
  assert.deepEqual(
    names(h, 0).filter(name => name === 'host away'),
    ['host away']
  )
})

test('3-6 a snapshot that the page drops does not complete the return', () => {
  const h = harness()
  playingPage(h)
  h.rooms.on.ownerLost()
  h.rooms.on.ownerBack()
  h.rooms.on.text(snapshotText({n: 2, state: {nolog: true}}), 1)
  assert.equal(h.netcode.phase, 'hostAway')
  h.rooms.on.text(snapshotText({n: 1}), 1)
  assert.equal(h.netcode.phase, 'playing')
})

test('3-7 a return by record ends with the rooms cause before the first snapshot and tells no host away', () => {
  const h = harness()
  returningPage(h)
  h.rooms.on.ownerLost()
  h.rooms.on.ended({reason: 'owner away'})
  assert.deepEqual(names(h, 0), ['entering', 'ended'])
  assert.deepEqual(since(h, 0).at(-1), ['ended', {cause: 'owner away'}])
})
