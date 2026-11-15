import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {ActProblem, Json} from '../index.ts'
import {table} from './8-actions.states.ts'
import {cellTests, type Scenarios} from './cells.ts'
import {
  harness,
  hosting,
  lastSnapshot,
  names,
  playingPage,
  recordOf,
  recoveringHost,
  returningPage,
  running,
  since,
  snapshots,
  snapshotText,
  snapshotValue,
  versions,
  type Harness
} from './harness.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']

const numberMax = 2 ** 53 - 1

const parsedSent = (h: Harness): {[key: string]: unknown}[] => h.rooms.last.sent.map(text => JSON.parse(text) as {[key: string]: unknown})
const actionsSent = (h: Harness) => parsedSent(h).filter(value => value.t === 'action')

interface Page {
  readonly h: Harness
  answer?: ActProblem | null
}

const participantStates: {readonly [S in 'none' | 'awaiting' | 'awaitingAway' | 'over']: (h: Harness) => void} = {
  none: h => playingPage(h),
  awaiting: h => {
    playingPage(h)
    assert.equal(h.netcode.act('x'), null)
  },
  awaitingAway: h => {
    participantStates.awaiting(h)
    h.rooms.on.ownerLost()
  },
  over: h => {
    playingPage(h)
    h.rooms.on.ended({reason: 'room closed'})
  }
}

const backIfAway = (h: Harness): void => {
  if (h.netcode.phase === 'hostAway') {
    h.rooms.on.ownerBack()
  }
}

const reloaded = (record: Json | undefined): Harness => {
  const h = harness()
  returningPage(h, record ?? {versions})
  h.rooms.on.text(snapshotText(), 1)
  return h
}

const pageEvents: {
  readonly [
    E in Extract<Event, `act${string}` | `snapshot${string}` | `refusal${string}` | 'hostAway' | 'gameEnds' | 'leave' | 'pageReloads'>
  ]: (page: Page) => unknown
} = {
  actCanAct: page => {
    page.answer = page.h.netcode.act('x')
  },
  actCanActWriteFails: page => {
    page.h.rooms.last.failWrites = true
    page.answer = page.h.netcode.act('x')
  },
  actCannotAct: page => {
    page.answer = page.h.netcode.act('x')
  },
  actNumberExhausted: page => {
    page.answer = page.h.netcode.act('x')
  },
  actNotAnAction: page => {
    page.answer = page.h.netcode.act('not an action')
  },
  actTooLarge: page => {
    page.answer = page.h.netcode.act('a'.repeat(61_439))
  },
  snapshotCovering: page => {
    backIfAway(page.h)
    page.h.rooms.on.text(snapshotText({n: 2, accepted: [[2, 1]]}), 1)
  },
  snapshotNotCovering: page => {
    backIfAway(page.h)
    const awaiting = actionsSent(page.h).length > 0
    page.h.rooms.on.text(snapshotText({n: 2, running: awaiting}), 1)
  },
  snapshotEqual: page => {
    backIfAway(page.h)
    page.h.rooms.on.text(snapshotText({n: 1}), 1)
  },
  snapshotDropped: page => {
    backIfAway(page.h)
    page.h.rooms.on.text(snapshotText({n: 2, seats: [1]}), 1)
  },
  refusalSameNumber: page => page.h.rooms.on.text(JSON.stringify({t: 'refused', n: 1}), 1),
  refusalOtherNumber: page => page.h.rooms.on.text(JSON.stringify({t: 'refused', n: 2}), 1),
  hostAway: page => page.h.rooms.on.ownerLost(),
  gameEnds: page => page.h.rooms.on.ended({reason: 'room closed'}),
  leave: page => page.h.netcode.leave(),
  pageReloads: page => reloaded(page.h.rooms.last.record)
}

const checkPage = (state: State, event: Event, outcome: Outcome): void => {
  const h = harness()
  if (event === 'actNumberExhausted' && state === 'none') {
    returningPage(h, {versions, action: numberMax})
    h.rooms.on.text(snapshotText(), 1)
  } else if (event === 'actCannotAct' && state === 'none') {
    playingPage(h, {running: false})
  } else {
    participantStates[state as keyof typeof participantStates](h)
  }
  const mark = h.told.length
  const sentBefore = actionsSent(h).length
  const page: Page = {h}
  const run = pageEvents[event as keyof typeof pageEvents]
  const next = (run(page) as Harness | undefined) ?? h
  if (next !== h) {
    assert.equal(next.netcode.act('y'), null)
    const [sent] = actionsSent(next)
    const recordAction = (h.rooms.last.record as {action?: number} | undefined)?.action ?? 0
    assert.equal(sent?.n, recordAction + 1)
    return
  }
  assert.equal(page.answer, outcome.answer ?? (event.startsWith('act') ? null : undefined))
  const sent = actionsSent(h).slice(sentBefore)
  switch (outcome.sends) {
    case 'the action with its number and match ID':
      assert.deepEqual(sent, [{t: 'action', n: 1, match: [1, 1], action: 'x'}])
      break
    case 'the action again with its first number and match ID':
      assert.deepEqual(sent, [{t: 'action', n: 1, match: [1, 1], action: 'x'}])
      break
    default:
      assert.deepEqual(sent, [])
  }
  const record = h.rooms.last.record as {action?: number} | undefined
  if (outcome.writesNumber) {
    assert.equal(record?.action, 1)
  } else if (event === 'actCanActWriteFails') {
    assert.equal(record?.action, undefined)
    assert.equal(h.rooms.last.writes.length > 0, true)
  }
  const told = names(h, mark)
  assert.equal(told.includes('refused'), outcome.told?.includes('refused with the number') ?? false)
  assert.equal(told.includes('can act'), outcome.told?.includes('can act changed') ?? false)
  if (outcome.next === 'over') {
    assert.equal(h.netcode.phase, 'none')
  } else if (outcome.next === 'awaitingAway') {
    assert.equal(h.netcode.phase, 'hostAway')
  } else if (outcome.next === 'awaiting') {
    assert.equal(h.netcode.phase, 'playing')
    assert.equal(h.netcode.act('z'), 'cannot act')
  }
}

const hostRunning = (h: Harness): void => {
  running(h)
}

const hostChecks = (h: Harness, mark: number, outcome: Outcome, from: number, number: number): void => {
  const made = snapshots(h, mark)
  const refusal = h.rooms.last.sentTo.find(([to, text]) => to === from && (JSON.parse(text) as {t: string}).t === 'refused')
  switch (outcome.judged) {
    case 'accepted':
      assert.equal(made.length, 1)
      assert.deepEqual(
        made[0]?.snapshot.accepted.find(([participant]) => participant === from),
        [from, number]
      )
      break
    case 'refused':
      assert.equal(made.length, 0)
      if (from === 1) {
        assert.deepEqual(
          since(h, mark).find(([name]) => name === 'refused'),
          ['refused', number]
        )
      } else {
        assert.deepEqual(JSON.parse(refusal?.[1] ?? '{}'), {t: 'refused', n: number})
      }
      break
    case 'not judged':
      assert.equal(made.length, 0)
      assert.equal(refusal, undefined)
      assert.deepEqual(JSON.parse(h.rooms.last.sentTo.at(-1)?.[1] ?? '{}').t, 'snapshot')
      break
    case 'dropped':
      assert.equal(made.length, 0)
      assert.deepEqual(h.rooms.last.sentTo, [])
  }
}

const arrive = (h: Harness, from: number, number: number, match: readonly [number, number], action: Json): void => {
  h.rooms.on.text(JSON.stringify({t: 'action', n: number, match, action}), from)
}

const judge = (setup: (h: Harness) => void, event: (h: Harness) => unknown, from: number, number: number) => (outcome: Outcome) => {
  const h = harness()
  setup(h)
  const mark = h.told.length
  event(h)
  hostChecks(h, mark, outcome, from, number)
}

const endedMatchWithAccepted = (h: Harness): void => {
  running(h)
  arrive(h, 2, 1, [1, 1], 'x')
  h.netcode.act('win')
  assert.equal(lastSnapshot(h).snapshot.running, false)
}

const hostPage = (setup: (h: Harness) => void, event: (h: Harness) => unknown) => (outcome: Outcome) => {
  const h = harness()
  setup(h)
  const mark = h.told.length
  const answer = event(h) as ActProblem | null | undefined
  if (outcome.answer !== undefined) {
    assert.equal(answer, outcome.answer)
  }
  if (outcome.told?.includes('refused with the number')) {
    assert.ok(names(h, mark).includes('refused'))
  }
  if (outcome.judged === 'at once, as 8-5 and 8-6 say') {
    assert.equal(answer, null)
    assert.deepEqual(lastSnapshot(h).snapshot.accepted, [[1, 1]])
  }
  assert.equal(h.netcode.phase, outcome.next === 'over' ? 'none' : 'hosting')
  assert.deepEqual(actionsSent(h), [])
}

const scenarios = {} as {[S in State]: {[E in Event]?: (outcome: Outcome) => void}}
for (const state of ['none', 'awaiting', 'awaitingAway', 'over'] as const) {
  scenarios[state] = Object.fromEntries(
    Object.keys(pageEvents).map(event => [event, (outcome: Outcome) => checkPage(state, event as Event, outcome)])
  )
}

const recoveredHost = (accepted: number) => (h: Harness) => {
  recoveringHost(h, recordOf(snapshotValue({accepted: [[1, accepted]]})))
  h.rooms.on.ownerReturned(2, [2])
}

scenarios.host = {
  actCanAct: hostPage(hostRunning, h => h.netcode.act('x')),
  actCannotAct: hostPage(
    h => hosting(h, [2]),
    h => h.netcode.act('x')
  ),
  actNumberExhausted: hostPage(recoveredHost(numberMax), h => h.netcode.act('x')),
  actNotAnAction: hostPage(hostRunning, h => h.netcode.act('not an action')),
  actTooLarge: hostPage(hostRunning, h => h.netcode.act('a'.repeat(61_439))),
  refusalSameNumber: hostPage(hostRunning, h => h.netcode.act('refuse')),
  gameEnds: hostPage(hostRunning, h => h.rooms.on.ended({reason: 'idle'})),
  leave: hostPage(hostRunning, h => h.netcode.leave()),
  pageReloads: () => {
    const h = harness()
    recoveredHost(4)(h)
    assert.equal(h.netcode.act('x'), null)
    assert.deepEqual(lastSnapshot(h).snapshot.accepted, [[1, 5]])
  }
}

scenarios.judgeRunning = {
  arrivesOldNumber: judge(
    h => {
      running(h)
      arrive(h, 2, 1, [1, 1], 'x')
    },
    h => arrive(h, 2, 1, [1, 1], 'x'),
    2,
    1
  ),
  arrivesFromSpectator: judge(
    h => running(h, [3]),
    h => arrive(h, 3, 1, [1, 1], 'x'),
    3,
    1
  ),
  arrivesOtherMatchId: judge(hostRunning, h => arrive(h, 2, 1, [1, 2], 'x'), 2, 1),
  arrivesNotAnAction: judge(hostRunning, h => arrive(h, 2, 1, [1, 1], 'not an action'), 2, 1),
  arrivesStepNull: judge(hostRunning, h => arrive(h, 2, 1, [1, 1], 'refuse'), 2, 1),
  arrivesStepFails: judge(
    h => {
      running(h)
      h.failing.step = true
    },
    h => arrive(h, 2, 1, [1, 1], 'x'),
    2,
    1
  ),
  arrivesAccepted: judge(hostRunning, h => arrive(h, 2, 1, [1, 1], 'x'), 2, 1),
  arrivesOtherText: judge(hostRunning, h => h.rooms.on.text('{"t":"action","n":0}', 2), 2, 0)
}

scenarios.judgeIdle = {
  arrivesOldNumber: judge(endedMatchWithAccepted, h => arrive(h, 2, 1, [1, 1], 'x'), 2, 1),
  arrivesFromSpectator: judge(
    h => hosting(h, [2, 3]),
    h => arrive(h, 3, 1, [1, 0], 'x'),
    3,
    1
  ),
  arrivesOtherMatchId: judge(
    h => hosting(h, [2]),
    h => arrive(h, 2, 1, [1, 0], 'x'),
    2,
    1
  ),
  arrivesNotAnAction: judge(
    h => hosting(h, [2]),
    h => arrive(h, 2, 1, [1, 0], 'not an action'),
    2,
    1
  ),
  arrivesOtherText: judge(
    h => hosting(h, [2]),
    h => h.rooms.on.text('not json', 2),
    2,
    0
  )
}

cellTests(table, scenarios as Scenarios<Table>)

test('8-1 a spectator cannot act', () => {
  const h = harness()
  playingPage(h, {seats: [1, 3], queue: [2]})
  assert.equal(h.netcode.act('x'), 'cannot act')
})

test('8-2 an action of exactly 61,440 bytes is not too large', () => {
  const h = harness()
  playingPage(h)
  assert.equal(h.netcode.act('é'.repeat(30_719)), null)
  const p = harness()
  playingPage(p)
  assert.equal(p.netcode.act('é'.repeat(30_720)), 'too large')
})

test('8-3 the action number is 1 more than the larger of the record and the last accepted one', () => {
  const h = harness()
  returningPage(h, {versions, action: 3})
  h.rooms.on.text(snapshotText({accepted: [[2, 9]]}), 1)
  h.netcode.act('x')
  assert.equal(actionsSent(h)[0]?.n, 10)
  assert.equal((h.rooms.last.record as {action: number}).action, 10)
})

test('8-8 a participant page drops a text from the host that is neither a snapshot nor a refusal', () => {
  const h = harness()
  playingPage(h)
  const mark = h.told.length
  h.rooms.on.text(JSON.stringify({t: 'action', n: 1, match: [1, 1], action: 'x'}), 1)
  h.rooms.on.text('[]', 1)
  assert.deepEqual(since(h, mark), [])
})
