import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {GameHandlers, Json, Rules, Title} from '../index.ts'
import {createNetcode} from '../index.ts'
import {FakeClock, FakeRooms, FakeVisibility} from './fakes.ts'
import {
  code,
  harness,
  hosting,
  lastSnapshot,
  names,
  recordOf,
  recoveringHost,
  request,
  running,
  since,
  snapshotValue,
  stateLog,
  type Harness
} from './harness.ts'

const baseRules: Rules = {
  seats: () => ['X', 'O'],
  initialState: () => ({board: 0}),
  step: state => state,
  over: () => false,
  isAction: () => true,
  isState: value => typeof value === 'object' && value !== null
}

const startWith = (rules: Partial<Record<keyof Rules, unknown>>, formatVersion = 1): {failed: unknown[]; rooms: FakeRooms} => {
  const failed: unknown[] = []
  const rooms = new FakeRooms()
  const title = {appId: 'when.party/test', waitingSeconds: null, formatVersion, rules: {...baseRules, ...rules}} as unknown as Title
  const handlers: GameHandlers = {failed: failure => failed.push(failure)}
  const netcode = createNetcode(title, handlers, {rooms, clock: new FakeClock(), visibility: new FakeVisibility(), random: () => 7})
  netcode.start()
  return {failed, rooms}
}

const badRules = (rules: Partial<Record<keyof Rules, unknown>>, formatVersion = 1): boolean => {
  const {failed, rooms} = startWith(rules, formatVersion)
  const bad = failed.length === 1 && (failed[0] as {cause: string}).cause === 'bad rules'
  assert.equal(rooms.calls.length, bad ? 0 : 1)
  return bad
}

test('1-1 seats are 1 to 12 distinct names of 1 to 16 code points without lone surrogates', () => {
  assert.equal(badRules({seats: () => ['A']}), false)
  assert.equal(badRules({seats: () => Array.from({length: 12}, (_, index) => `S${index}`)}), false)
  assert.equal(badRules({seats: () => Array.from({length: 13}, (_, index) => `S${index}`)}), true)
  assert.equal(badRules({seats: () => []}), true)
  assert.equal(badRules({seats: () => ['😀'.repeat(16)]}), false)
  assert.equal(badRules({seats: () => ['😀'.repeat(17)]}), true)
  assert.equal(badRules({seats: () => ['']}), true)
  assert.equal(badRules({seats: () => ['A', 'A']}), true)
  assert.equal(badRules({seats: () => ['\ud800']}), true)
  assert.equal(badRules({seats: () => [1]}), true)
})

test('1-1 the format version is a whole number from 1 to 1,000,000', () => {
  assert.equal(badRules({}, 1), false)
  assert.equal(badRules({}, 1_000_000), false)
  assert.equal(badRules({}, 0), true)
  assert.equal(badRules({}, 1_000_001), true)
  assert.equal(badRules({}, 1.5), true)
})

test('1-1 a random number is drawn anew for each call', () => {
  const h = harness()
  const seen: number[] = []
  const rules = h.title.rules
  const initial = rules.initialState.bind(rules)
  ;(rules as {initialState: Rules['initialState']}).initialState = (random, context) => {
    seen.push(random)
    return initial(random, context)
  }
  running(h)
  h.netcode.act('win')
  h.netcode.startMatch()
  assert.equal(seen.length, 2)
  assert.notEqual(seen[0], seen[1])
})

test('1-2 in a call of presence the context already shows the event, and for left the player still sits', () => {
  const h = harness()
  running(h)
  h.rooms.on.participantLost(2)
  const lost = h.calls.find(call => call.detail === 'lost B')?.context?.seats.B
  assert.deepEqual(lost, {taken: true, lost: true, hidden: false})
  h.rooms.on.participantLeft(2)
  const left = h.calls.find(call => call.detail === 'left B')?.context?.seats.B
  assert.equal(left?.taken, true)
})

test('1-3 a function gets a copy of its input and the netcode keeps the value read back from JSON', () => {
  const h = harness()
  running(h)
  const earlier = lastSnapshot(h).snapshot
  const rules = h.title.rules
  ;(rules as {step: Rules['step']}).step = state => {
    ;(state as {log: string[]}).log.push('mutated')
    return {log: ['stepped'], gone: undefined, nan: Number.NaN} as unknown as Json
  }
  h.netcode.act('x')
  assert.deepEqual(earlier.state, {log: ['initial']})
  assert.deepEqual(lastSnapshot(h).snapshot.state, {log: ['stepped'], nan: null})
})

test('1-3 is state, is action and over get the value that the netcode keeps', () => {
  const h = harness()
  running(h)
  const kept = {isAction: {move: 1, nan: null}, isState: {log: ['stepped'], nan: null}, over: {log: ['stepped'], nan: null}}
  const rules = h.title.rules as unknown as {[name: string]: unknown}
  const seen: [keyof typeof kept, unknown][] = []
  for (const name of ['isState', 'isAction', 'over'] as const) {
    const rule = (rules[name] as (value: Json) => boolean).bind(rules)
    rules[name] = (value: Json) => {
      seen.push([name, value])
      return rule(value)
    }
  }
  ;(rules as {step: Rules['step']}).step = () => ({log: ['stepped'], gone: undefined, nan: Number.NaN}) as unknown as Json
  h.netcode.act({move: 1, gone: undefined, nan: Number.NaN} as unknown as Json)
  assert.deepEqual(new Set(seen.map(([name]) => name)), new Set(Object.keys(kept)))
  for (const [name, value] of seen) {
    assert.deepEqual(value, kept[name])
  }
})

test('1-3 a state of more than 61,440 bytes fails', () => {
  const h = harness()
  running(h)
  const rules = h.title.rules
  ;(rules as {step: Rules['step']}).step = (_state, _seat, action) => ({log: ['x'.repeat(Number(action))]})
  const overhead = JSON.stringify({log: ['']}).length
  h.netcode.act(61_440 - overhead)
  assert.equal(stateLog(lastSnapshot(h))[0]?.length, 61_440 - overhead)
  const mark = h.told.length
  h.netcode.act(61_441 - overhead)
  assert.ok(names(h, mark).includes('rules error'))
})

test('1-3 a value without JSON text has the wrong form', () => {
  const h = harness()
  running(h)
  const rules = h.title.rules
  ;(rules as {step: Rules['step']}).step = () => {
    const cycle: {log: string[]; self?: unknown} = {log: []}
    cycle.self = cycle
    return cycle as unknown as Json
  }
  const mark = h.told.length
  h.netcode.act('x')
  assert.ok(names(h, mark).includes('rules error'))
})

const snapshotsAndErrors = (h: Harness, mark: number): string[] =>
  names(h, mark).filter(name => name === 'snapshot' || name === 'rules error')

test('1-4 when a function fails in a change that gives no snapshot, the host page gets rules error and the state stays', () => {
  const failures: [string, (h: Harness) => void, (h: Harness) => void][] = [
    [
      'step',
      h => running(h),
      h => {
        h.failing.step = true
        h.netcode.act('x')
      }
    ],
    [
      'initial state',
      h => hosting(h, [2]),
      h => {
        h.failing.initialState = true
        h.netcode.startMatch()
      }
    ],
    [
      'presence',
      h => running(h),
      h => {
        h.failing.presence.add('lost')
        h.rooms.on.participantLost(2)
      }
    ],
    [
      'deadline',
      h => {
        h.failing.initialDue = [5000]
        h.failing.deadline.add(5000)
        running(h)
      },
      h => h.clock.advance(5000)
    ]
  ]
  for (const [name, setup, fail] of failures) {
    const h = harness()
    setup(h)
    const before = lastSnapshot(h).snapshot
    const mark = h.told.length
    fail(h)
    assert.deepEqual(snapshotsAndErrors(h, mark), ['rules error'], name)
    assert.deepEqual(lastSnapshot(h).snapshot, before, name)
  }
})

test('1-4 when a function fails in a change that gives a snapshot, the host page gets rules error', () => {
  const failures: [string, (h: Harness) => void, (h: Harness) => void][] = [
    [
      'presence at the start of a match',
      h => {
        hosting(h, [2])
        h.rooms.on.participantLost(2)
        h.failing.presence.add('lost')
      },
      h => h.netcode.startMatch()
    ],
    [
      'presence for left',
      h => {
        running(h)
        h.failing.presence.add('left')
      },
      h => h.rooms.on.participantLeft(2)
    ],
    [
      'presence at the end of recovery',
      h => {
        recoveringHost(h, recordOf(snapshotValue({running: true, seats: [1, 2]})))
        h.failing.presence.add('lost')
      },
      h => h.rooms.on.ownerReturned(2, [2])
    ],
    [
      'deadlines after the start of a match',
      h => {
        hosting(h, [2])
        h.failing.deadlines = true
      },
      h => h.netcode.startMatch()
    ]
  ]
  for (const [name, setup, fail] of failures) {
    const h = harness()
    setup(h)
    const mark = h.told.length
    fail(h)
    assert.deepEqual(snapshotsAndErrors(h, mark).sort(), ['rules error', 'snapshot'], name)
  }
})

test('1-4 when over fails its answer counts as no', () => {
  const h = harness()
  running(h)
  h.failing.over = true
  h.netcode.act('win')
  assert.equal(lastSnapshot(h).snapshot.running, true)
})

test('1-4 when admit or can start fails its answer counts as no', () => {
  const fail = () => {
    throw new Error('rule')
  }
  for (const admit of [fail, () => 1 as unknown as boolean]) {
    const h = harness({admit})
    hosting(h)
    const joinRequest = request(h, 3)
    assert.deepEqual(joinRequest.answers, [{answer: 'refuse without data'}])
  }
  for (const canStart of [fail, () => 'yes' as unknown as boolean]) {
    const h = harness({canStart})
    hosting(h, [2])
    const mark = h.told.length
    h.netcode.startMatch()
    assert.deepEqual(names(h, mark), ['cannot start'])
  }
})

test('1-5 presence repeats the visibility after back and when a match starts', () => {
  const h = harness()
  hosting(h, [2])
  h.rooms.on.visibility(2, 'hidden')
  h.netcode.startMatch()
  h.rooms.on.participantLost(2)
  h.rooms.on.participantBack(2, 'hidden')
  assert.deepEqual(
    h.calls.filter(call => call.name === 'presence').map(call => call.detail),
    ['hidden B', 'lost B', 'back B', 'hidden B']
  )
})

test('1-6 rules are bad when a function is missing, an optional one is not a function, or deadlines comes without deadline', () => {
  assert.equal(badRules({step: undefined}), true)
  assert.equal(badRules({isState: 1}), true)
  assert.equal(badRules({presence: 'no'}), true)
  assert.equal(badRules({deadlines: () => []}), true)
  assert.equal(badRules({deadline: (state: Json) => state}), false)
  assert.equal(
    badRules({
      seats: () => {
        throw new Error('seats')
      }
    }),
    true
  )
})

test('1-6 entering fails with bad rules before the netcode enters the room', () => {
  const h = harness()
  h.failing.seats = true
  h.netcode.enter(code)
  assert.deepEqual(since(h, 0), [['failed', {cause: 'bad rules'}]])
  assert.deepEqual(h.rooms.calls, [])
})
