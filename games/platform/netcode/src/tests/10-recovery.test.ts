import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {Json} from '../index.ts'
import {table} from './10-recovery.states.ts'
import {cellTests, type Scenarios} from './cells.ts'
import {
  format,
  harness,
  lastSnapshot,
  names,
  recordOf,
  recoveringHost,
  snapshots,
  snapshotValue,
  stateLog,
  versions,
  type Harness,
  type SnapshotFields
} from './harness.ts'

type Table = typeof table
type Outcome = Extract<Table['recovering'][keyof Table['recovering']], {readonly outcome: unknown}>['outcome']

const shown = new Set(['presence', 'over'])
const callsSince = (h: Harness, mark: number): string[] =>
  h.calls
    .slice(mark)
    .filter(call => shown.has(call.name))
    .map(call => (call.name === 'presence' ? `presence ${call.detail}` : call.name))

interface Recovered {
  readonly h: Harness
  readonly calls: readonly string[]
}

const recover = (outcome: Outcome, record: Json, roster: readonly number[], configure: (h: Harness) => void = () => {}): Recovered => {
  const h = harness()
  configure(h)
  recoveringHost(h, record)
  const mark = h.told.length
  const callMark = h.calls.length
  h.rooms.on.ownerReturned(2, roster)
  assert.equal(h.netcode.phase, outcome.next)
  const made = snapshots(h, mark)
  if (outcome.change === 'one, the first of the new term') {
    assert.equal(made.length, 1)
    assert.equal(made[0]?.snapshot.term, 2)
    assert.equal(made[0]?.snapshot.number, 1)
  }
  return {h, calls: callsSince(h, callMark)}
}

const usable = (fields: SnapshotFields = {}, time = 0): Json => recordOf(snapshotValue(fields), time)
const madeFresh = (h: Harness, matchNumber: number, seats: readonly (number | null)[], queue: readonly number[] = []): void => {
  const {snapshot} = lastSnapshot(h)
  assert.equal(snapshot.running, false)
  assert.equal(snapshot.state, null)
  assert.deepEqual(snapshot.match, {term: 2, number: matchNumber})
  assert.deepEqual(snapshot.seats, seats)
  assert.deepEqual(snapshot.queue, queue)
}

const scenarios: Scenarios<Table> = {
  recovering: {
    rosterWithUsableRecord: outcome => {
      const {h} = recover(outcome, usable({running: false, state: {log: ['kept']}, match: [1, 4], seats: [1, 2]}), [2])
      const {snapshot} = lastSnapshot(h)
      assert.deepEqual(stateLog(lastSnapshot(h)), ['kept'])
      assert.deepEqual(snapshot.match, {term: 1, number: 4})
    },
    rosterWithRecordOfOtherVersions: outcome => {
      const {h} = recover(
        outcome,
        {versions: [1, format + 1], snapshot: snapshotValue({match: [1, 3], seats: [1, 3]}) as Json, time: 0},
        [2, 3, 4]
      )
      madeFresh(h, 3, [1, 2], [3, 4])
    },
    rosterWithRecordOfOtherForm: outcome => {
      const {h} = recover(outcome, usable({match: [1, 3], state: {nolog: true}}), [2])
      madeFresh(h, 3, [1, 2])
    },
    rosterWithoutRecordSnapshot: outcome => {
      const {h} = recover(outcome, {versions}, [3, 2])
      madeFresh(h, 0, [1, 2], [3])
    },
    rosterLacksParticipant: outcome => {
      const {h} = recover(outcome, usable({running: false, seats: [1, 2], queue: [3]}), [2])
      assert.deepEqual(lastSnapshot(h).snapshot.queue, [])
    },
    rosterLacksPlayerWhileMatchRuns: outcome => {
      const {h, calls} = recover(outcome, usable({running: true, seats: [1, 2]}), [])
      assert.deepEqual(calls, ['presence left B', 'presence visible A', 'over'])
      assert.deepEqual(lastSnapshot(h).snapshot.seats, [1, null])
    },
    rosterHasNewParticipant: outcome => {
      const {h} = recover(outcome, usable({running: false, seats: [1, 2]}), [2, 4])
      assert.deepEqual(lastSnapshot(h).snapshot.queue, [4])
      h.rooms.on.participantLeft(2)
      h.netcode.startMatch()
      const context = h.calls.filter(call => call.name === 'initial state').at(-1)?.context?.seats.B
      assert.deepEqual(context, {taken: true, lost: true, hidden: false})
    },
    rosterHasPlayerWhileMatchRuns: outcome => {
      const {h, calls} = recover(outcome, usable({running: true, seats: [1, 2]}), [2])
      assert.deepEqual(calls, ['presence lost B', 'presence visible A', 'over'])
      const context = h.calls.find(call => call.detail === 'lost B')?.context?.seats.B
      assert.deepEqual(context, {taken: true, lost: true, hidden: false})
    },
    noMatchRunsAtEnd: outcome => {
      const {h, calls} = recover(outcome, usable({running: false, seats: [1, null], queue: [3]}), [3])
      assert.deepEqual(calls, [])
      assert.deepEqual(lastSnapshot(h).snapshot.seats, [1, 3])
    },
    deadlinesDueAtEnd: outcome => {
      const {h} = recover(outcome, usable({running: true, state: {log: ['initial'], due: [100, 9000]}}, 5000), [2])
      assert.deepEqual(
        h.calls.filter(call => call.name === 'deadline').map(call => call.detail),
        ['100']
      )
      h.clock.advance(4000)
      assert.deepEqual(
        h.calls.filter(call => call.name === 'deadline').map(call => call.detail),
        ['100', '9000']
      )
    },
    pageHiddenOrVisible: outcome => {
      const h = harness()
      recoveringHost(h, usable())
      const mark = h.told.length
      h.visibility.set(true)
      h.visibility.set(false)
      assert.equal(h.netcode.phase, outcome.next)
      assert.deepEqual(names(h, mark), [])
      assert.deepEqual(h.rooms.last.writes, [])
    },
    startMatchCalled: outcome => {
      const h = harness()
      recoveringHost(h, usable())
      const mark = h.told.length
      h.netcode.startMatch()
      assert.equal(h.netcode.phase, outcome.next)
      assert.deepEqual(names(h, mark), [])
    }
  }
}

cellTests(table, scenarios)

test('10-1 a snapshot that recovery makes without a usable record has the record time, or 0 without one', () => {
  for (const [record, time] of [
    [{versions: [1, format + 1], snapshot: snapshotValue({time: 9000}), time: 7000}, 7000],
    [{versions, snapshot: snapshotValue({state: {nolog: true}, time: 9000})}, 0]
  ] as const) {
    const h = harness()
    recoveringHost(h, record as Json)
    h.rooms.on.ownerReturned(2, [])
    assert.equal(lastSnapshot(h).snapshot.state, null)
    assert.equal(lastSnapshot(h).snapshot.roomTime, time)
  }
})

test('10-4 the batch after the end of recovery sets the timer, so a failing deadlines tells one rules error', () => {
  const h = harness()
  h.failing.deadlines = true
  recoveringHost(h, usable({running: true, state: {log: ['initial'], due: [100]}}))
  const mark = h.told.length
  h.rooms.on.ownerReturned(2, [2])
  assert.equal(names(h, mark).filter(name => name === 'rules error').length, 1)
})

test('10-2 recovery tells nothing but entering and accepts no action', () => {
  const h = harness()
  recoveringHost(h, usable())
  h.rooms.on.text(JSON.stringify({t: 'action', n: 1, match: [1, 1], action: 'x'}), 2)
  h.clock.advance(60_000)
  assert.deepEqual(names(h, 0), ['entering'])
  assert.equal(h.netcode.act('x'), 'cannot act')
})

test('10-3 the host page visibility goes to the host seat at the end of recovery', () => {
  const h = harness()
  recoveringHost(h, usable({running: true}))
  h.visibility.set(true)
  const mark = h.calls.length
  h.rooms.on.ownerReturned(2, [2])
  assert.deepEqual(callsSince(h, mark), ['presence lost B', 'presence hidden A', 'over'])
})

test('10-5 a host page whose scripts were suspended keeps its game', () => {
  const h = harness()
  h.netcode.start()
  h.rooms.on.created('BCDFG', 1)
  h.clock.jump(600_000)
  assert.equal(h.netcode.phase, 'hosting')
  assert.equal(h.rooms.calls.length, 1)
})
