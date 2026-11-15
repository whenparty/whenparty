import assert from 'node:assert/strict'
import {test} from 'node:test'
import {table} from './5-matches.states.ts'
import {cellTests, type Scenarios} from './cells.ts'
import {
  harness,
  hosting,
  lastSnapshot,
  names,
  playingPage,
  recordOf,
  recoveringHost,
  running,
  snapshots,
  snapshotValue,
  stateLog,
  type Harness,
  type TitleOptions
} from './harness.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']

const shown = new Set(['initial state', 'presence', 'over'])

const callsSince = (h: Harness, mark: number): string[] =>
  h.calls
    .slice(mark)
    .filter(call => shown.has(call.name))
    .map(call => (call.name === 'presence' ? `presence ${call.detail}` : call.name))

interface Run {
  readonly h: Harness
  readonly calls: readonly string[]
  readonly log: readonly string[]
  readonly logBefore: readonly string[]
  readonly matchBefore: number
}

const act = (outcome: Outcome, setup: (h: Harness) => void, event: (h: Harness) => void, options: TitleOptions = {}): Run => {
  const h = harness(options)
  setup(h)
  const before = h.told.some(([name]) => name === 'snapshot') ? lastSnapshot(h) : null
  const mark = h.told.length
  const callMark = h.calls.length
  event(h)
  const made = snapshots(h, mark)
  if (outcome.change === 'none') {
    assert.equal(made.length, 0)
  } else if (outcome.change !== undefined) {
    assert.equal(made.length, 1)
  }
  const after = h.told.some(([name]) => name === 'snapshot') ? lastSnapshot(h) : null
  if (after !== null && before !== null && h.netcode.phase === 'hosting') {
    assert.equal(after.snapshot.running, outcome.next === 'running')
  }
  if (outcome.matchNumber === 'grows by 1') {
    assert.equal(after?.snapshot.match.number, (before?.snapshot.match.number ?? 0) + 1)
  }
  assert.equal(names(h, mark).includes('cannot start'), outcome.told === 'cannot start')
  return {
    h,
    calls: callsSince(h, callMark),
    log: after === null ? [] : stateLog(after),
    logBefore: before === null ? [] : stateLog(before),
    matchBefore: before?.snapshot.match.number ?? 0
  }
}

const twoPlayers = (h: Harness) => hosting(h, [2])
const lostAndHidden = (h: Harness) => {
  hosting(h, [2])
  h.rooms.on.participantLost(2)
  h.visibility.set(true)
}
const start = (h: Harness) => h.netcode.startMatch()
const lose2 = (h: Harness) => h.rooms.on.participantLost(2)
const lose3 = (h: Harness) => h.rooms.on.participantLost(3)
const leave2 = (h: Harness) => h.rooms.on.participantLeft(2)
const leave3 = (h: Harness) => h.rooms.on.participantLeft(3)
const runningWith3 = (h: Harness) => running(h, [3])

const recoveryRecord = recordOf(snapshotValue({running: true, state: {log: ['initial']}, match: [1, 1], seats: [1, 2]}))

const scenarios: Scenarios<Table> = {
  none: {
    startAllowed: outcome => {
      const run = act(outcome, lostAndHidden, start)
      assert.deepEqual(run.calls, ['initial state', 'presence lost B', 'presence hidden A', 'over'])
      assert.deepEqual(run.log, ['initial', 'lost B', 'hidden A'])
    },
    startPresenceFails: outcome => {
      const run = act(
        outcome,
        h => {
          lostAndHidden(h)
          h.failing.presence.add('lost')
        },
        start
      )
      assert.deepEqual(run.calls, ['initial state', 'presence lost B', 'presence hidden A', 'over'])
      assert.deepEqual(run.log, ['initial', 'hidden A'])
      assert.ok(names(run.h, 0).includes('rules error'))
    },
    startRefused: outcome => {
      const run = act(outcome, h => hosting(h), start)
      assert.deepEqual(run.calls, [])
    },
    startInitialFails: outcome => {
      const run = act(
        outcome,
        h => {
          twoPlayers(h)
          h.failing.initialState = true
        },
        start
      )
      assert.deepEqual(run.calls, ['initial state'])
      assert.ok(names(run.h, 0).includes('rules error'))
    },
    startOnOtherPage: outcome => {
      const run = act(outcome, h => playingPage(h, {running: false}), start)
      assert.deepEqual(run.h.rooms.last.sent, [])
      assert.deepEqual(run.calls, [])
    },
    playerEvent: outcome => assert.deepEqual(act(outcome, twoPlayers, lose2).calls, []),
    spectatorEvent: outcome => assert.deepEqual(act(outcome, h => hosting(h, [2, 3]), lose3).calls, []),
    playerEventNoPresenceTitle: outcome => assert.deepEqual(act(outcome, twoPlayers, lose2, {presence: false}).calls, []),
    playerLeaves: outcome => assert.deepEqual(act(outcome, twoPlayers, leave2).calls, []),
    playerLeavesNoPresenceTitle: outcome => assert.deepEqual(act(outcome, twoPlayers, leave2, {presence: false}).calls, []),
    spectatorLeaves: outcome => assert.deepEqual(act(outcome, h => hosting(h, [2, 3]), leave3).calls, []),
    otherChange: outcome => assert.deepEqual(act(outcome, twoPlayers, h => h.rooms.on.participantJoined(3, 'visible')).calls, [])
  },
  running: {
    startAllowed: outcome => assert.deepEqual(act(outcome, h => running(h), start).calls, []),
    startPresenceFails: outcome => assert.deepEqual(act(outcome, h => running(h), start).calls, []),
    startRefused: outcome => assert.deepEqual(act(outcome, h => running(h), start).calls, []),
    startInitialFails: outcome => assert.deepEqual(act(outcome, h => running(h), start).calls, []),
    startOnOtherPage: outcome => {
      const run = act(outcome, h => playingPage(h), start)
      assert.deepEqual(run.h.rooms.last.sent, [])
    },
    playerEvent: outcome => {
      const run = act(outcome, h => running(h), lose2)
      assert.deepEqual(run.calls, ['presence lost B', 'over'])
      assert.equal(run.log.at(-1), 'lost B')
    },
    playerEventPresenceFails: outcome => {
      const run = act(
        outcome,
        h => {
          running(h)
          h.failing.presence.add('lost')
        },
        lose2
      )
      assert.deepEqual(run.calls, ['presence lost B'])
      assert.ok(names(run.h, 0).includes('rules error'))
    },
    recoveryPresenceFails: outcome => {
      const run = act(
        outcome,
        h => {
          recoveringHost(h, recoveryRecord)
          h.failing.presence.add('lost')
        },
        h => h.rooms.on.ownerReturned(2, [2])
      )
      assert.deepEqual(run.calls, ['presence lost B', 'presence visible A', 'over'])
      assert.deepEqual(run.log, ['initial', 'visible A'])
    },
    spectatorEvent: outcome => assert.deepEqual(act(outcome, runningWith3, lose3).calls, []),
    playerEventNoPresenceTitle: outcome => assert.deepEqual(act(outcome, h => running(h), lose2, {presence: false}).calls, []),
    playerLeaves: outcome => {
      const run = act(outcome, h => running(h), leave2)
      assert.deepEqual(run.calls, ['presence left B', 'over'])
      assert.equal(run.log.at(-1), 'left B')
    },
    playerLeavesNoPresenceTitle: outcome => {
      const run = act(outcome, h => running(h), leave2, {presence: false})
      assert.deepEqual(run.calls, [])
      assert.deepEqual(run.log, run.logBefore)
    },
    playerLeavesPresenceFails: outcome => {
      const run = act(
        outcome,
        h => {
          running(h)
          h.failing.presence.add('left')
        },
        leave2
      )
      assert.deepEqual(run.calls, ['presence left B'])
      assert.deepEqual(run.log, run.logBefore)
    },
    spectatorLeaves: outcome => {
      const run = act(outcome, runningWith3, leave3)
      assert.deepEqual(run.calls, ['over'])
      assert.deepEqual(run.log, run.logBefore)
    },
    otherChange: outcome =>
      assert.deepEqual(
        act(
          outcome,
          h => running(h),
          h => h.rooms.on.participantJoined(3, 'visible')
        ).calls,
        ['over']
      ),
    overYes: outcome => {
      const run = act(
        outcome,
        h => running(h),
        h => h.netcode.act('win')
      )
      assert.deepEqual(run.calls, ['over'])
    }
  }
}

cellTests(table, scenarios)

test('5-2 can start gets the last state and the seats that have players', () => {
  const seen: unknown[] = []
  const h = harness({
    canStart: (last, seats) => {
      seen.push([last, seats])
      return true
    }
  })
  hosting(h)
  h.netcode.startMatch()
  assert.deepEqual(seen, [[null, ['A']]])
  assert.equal(lastSnapshot(h).snapshot.running, true)
})

test('5-2 when can start answers no, the netcode tells cannot start and nothing changes', () => {
  const h = harness({canStart: () => false})
  hosting(h, [2])
  const mark = h.told.length
  h.netcode.startMatch()
  assert.deepEqual(names(h, mark), ['cannot start'])
  assert.equal(
    h.calls.some(call => call.name === 'initial state'),
    false
  )
})

test('5-5 the match ID is the term of the host page and the match number', () => {
  const h = harness()
  h.netcode.start()
  h.rooms.on.created('BCDFG', 4)
  h.rooms.on.participantJoined(2, 'visible')
  assert.deepEqual(lastSnapshot(h).snapshot.match, {term: 4, number: 0})
  h.netcode.startMatch()
  assert.deepEqual(lastSnapshot(h).snapshot.match, {term: 4, number: 1})
})

test('5-6 after back the netcode calls presence with the visibility told with it', () => {
  const h = harness()
  running(h)
  h.rooms.on.participantLost(2)
  const mark = h.calls.length
  h.rooms.on.participantBack(2, 'hidden')
  assert.deepEqual(callsSince(h, mark), ['presence back B', 'over', 'presence hidden B', 'over'])
})

test('5-6 the host page tells hidden and visible about the host', () => {
  const h = harness()
  running(h)
  const mark = h.calls.length
  h.visibility.set(true)
  h.visibility.set(false)
  assert.deepEqual(callsSince(h, mark), ['presence hidden A', 'over', 'presence visible A', 'over'])
})
