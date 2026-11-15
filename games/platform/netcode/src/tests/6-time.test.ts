import assert from 'node:assert/strict'
import {test} from 'node:test'
import {table} from './6-time.states.ts'
import {cellTests, type Scenarios} from './cells.ts'
import {
  harness,
  hosting,
  joinedPage,
  playingPage,
  recordOf,
  recoveringHost,
  running,
  snapshotText,
  snapshotValue,
  versions,
  type Harness
} from './harness.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']

const setups: {readonly [S in State]: (h: Harness) => void} = {
  hostRecovering: h => recoveringHost(h, recordOf(snapshotValue({time: 7000}), 5000)),
  hostCounting: h => hosting(h),
  hostHeld: h => {
    hosting(h)
    h.clock.jump(-10_000)
  },
  participantNone: h => joinedPage(h),
  participantCounting: h => playingPage(h, {time: 1000}),
  participantHeld: h => {
    playingPage(h, {time: 1000})
    h.clock.jump(-10_000)
  },
  participantStopped: h => {
    playingPage(h, {time: 1000})
    h.rooms.on.ownerLost()
  }
}

const events: {readonly [E in Event]: (h: Harness, state: State) => void} = {
  clockAdvances: h => h.clock.advance(1000),
  clockJumpsBack: h => h.clock.jump(-1000),
  clockReachesHeldTime: (h, state) => {
    if (state === 'hostHeld') {
      h.clock.advance(10_000)
    } else if (state === 'participantHeld') {
      h.clock.advance(10_000)
    } else {
      h.clock.jump(-1000)
      h.clock.advance(1000)
    }
  },
  clockJumpsForward: h => h.clock.jump(60_000),
  fiveSecondsSinceWrite: h => h.clock.advance(5000),
  scriptsNotRunningNormally: (h, state) => h.clock.jump(state === 'hostHeld' ? 5000 : 20_000),
  pageHidden: h => h.visibility.set(true),
  recoveryEnds: h => h.rooms.on.ownerReturned(2, []),
  snapshotTaken: (h, state) => {
    if (state === 'participantStopped') {
      h.rooms.on.ownerBack()
    }
    h.rooms.on.text(snapshotText({n: state === 'participantNone' ? 1 : 2, time: 4000}), 1)
  },
  hostAway: h => h.rooms.on.ownerLost(),
  hostBackWithEqualSnapshot: h => {
    h.clock.advance(3000)
    h.rooms.on.ownerBack()
    h.rooms.on.text(snapshotText({n: 1, time: 1000}), 1)
  }
}

const expected = (state: State, event: Event, before: number | null, outcome: Outcome): number | null => {
  switch (outcome.roomTime) {
    case 'none':
      return null
    case 'stays':
    case 'goes on from where it stood':
      return before
    case "the snapshot's":
      return 4000
    case "the larger of the record's and the snapshot's":
      return 7000
    case 'grows with the clock':
      if (event === 'clockReachesHeldTime') {
        return before
      }
      return (
        (before ?? 0) +
        (event === 'fiveSecondsSinceWrite' ? 5000 : event === 'scriptsNotRunningNormally' ? 20_000 : event === 'pageHidden' ? 0 : 1000)
      )
    case 'jumps with the clock':
      return (before ?? 0) + 60_000 - (state === 'hostHeld' || state === 'participantHeld' ? 10_000 : 0)
  }
}

const probe = (h: Harness, next: State): void => {
  const at = h.netcode.roomTime()
  if (next === 'hostRecovering' || next === 'participantNone') {
    assert.equal(at, null)
    return
  }
  const grows = next === 'hostCounting' || next === 'participantCounting'
  h.clock.jump(grows ? 1000 : 1)
  assert.equal(h.netcode.roomTime(), grows ? (at ?? 0) + 1000 : at)
}

const writesOf = (h: Harness): number => h.rooms.last.writes.length

const run = (state: State, event: Event, outcome: Outcome): void => {
  const h = harness()
  setups[state](h)
  const before = h.netcode.roomTime()
  const writes = writesOf(h)
  events[event](h, state)
  assert.equal(h.netcode.roomTime(), expected(state, event, before, outcome))
  if (outcome.writes === 'now') {
    assert.ok(writesOf(h) > writes)
    const last = h.rooms.last.writes.at(-1) as {time: number}
    assert.equal(last.time, h.netcode.roomTime())
  } else if (outcome.writes !== undefined || (state === 'hostRecovering' && event !== 'recoveryEnds')) {
    assert.equal(writesOf(h), writes)
  }
  probe(h, outcome.next)
}

const scenarios = Object.fromEntries(
  Object.entries(table).map(([state, cells]) => [
    state,
    Object.fromEntries(Object.keys(cells).map(event => [event, (outcome: Outcome) => run(state as State, event as Event, outcome)]))
  ])
) as Scenarios<Table>

cellTests(table, scenarios)

test('6-1 room time is a whole number of milliseconds', () => {
  const h = harness()
  hosting(h)
  h.clock.advance(1234)
  assert.equal(h.netcode.roomTime(), 1234)
})

test('6-2 room time starts at 0 when starting completes, and the host writes it at least every 5 seconds', () => {
  const h = harness()
  hosting(h)
  assert.equal(h.netcode.roomTime(), 0)
  const writes = h.rooms.last.writes.length
  h.clock.advance(15_000)
  assert.deepEqual(
    h.rooms.last.writes.slice(writes).map(write => (write as {time: number}).time),
    [5000, 10_000, 15_000]
  )
})

test('6-3 recovery goes on from the record time when it is larger', () => {
  const h = harness()
  recoveringHost(h, recordOf(snapshotValue({time: 2000}), 9000))
  h.rooms.on.ownerReturned(2, [])
  assert.equal(h.netcode.roomTime(), 9000)
})

test('6-4 the snapshot gives the room time of the change to the participant', () => {
  const h = harness()
  running(h)
  h.clock.advance(2500)
  h.rooms.on.participantLost(2)
  const sent = JSON.parse(h.rooms.last.sent.at(-1) ?? '{}') as {time: number}
  assert.equal(sent.time, 2500)
  const p = harness()
  playingPage(p, {time: sent.time, versions})
  assert.equal(p.netcode.roomTime(), 2500)
})
