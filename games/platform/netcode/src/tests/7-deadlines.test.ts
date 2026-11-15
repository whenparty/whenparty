import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {Rules} from '../index.ts'
import {table} from './7-deadlines.states.ts'
import {cellTests, type Scenarios} from './cells.ts'
import {harness, hosting, names, running, snapshots, type Harness, type Play} from './harness.ts'

type Table = typeof table

const deadlineCalls = (h: Harness, mark = 0) => h.calls.slice(mark).filter(call => call.name === 'deadline')
const deadlineTimes = (h: Harness, mark = 0): number[] => deadlineCalls(h, mark).map(call => Number(call.detail))
const errors = (h: Harness, mark = 0): number => names(h, mark).filter(name => name === 'rules error').length

const runningWith = (due: readonly number[], configure: (h: Harness) => void = () => {}): Harness => {
  const h = harness()
  h.failing.initialDue = due
  configure(h)
  running(h)
  return h
}

const skipping = (configure: (h: Harness) => void = () => {}): Harness => {
  const h = runningWith([5000, 9000], each => {
    each.failing.deadline.add(5000)
    configure(each)
  })
  h.clock.advance(5000)
  assert.equal(errors(h), 1)
  return h
}

const scenarios: Scenarios<Table> = {
  idle: {
    batchStarts: () => {
      const h = harness()
      hosting(h, [2])
      const mark = h.calls.length
      h.rooms.on.participantJoined(3, 'visible')
      assert.deepEqual(
        h.calls.slice(mark).filter(call => call.name === 'deadlines' || call.name === 'deadline'),
        []
      )
    },
    otherChange: () => {
      const h = harness()
      hosting(h, [2])
      const mark = h.told.length
      h.rooms.on.participantJoined(3, 'visible')
      assert.equal(snapshots(h, mark).length, 1)
      h.clock.advance(60_000)
      assert.deepEqual(deadlineTimes(h), [])
    },
    matchStarts: () => {
      const h = runningWith([1000])
      h.clock.advance(999)
      assert.deepEqual(deadlineTimes(h), [])
      h.clock.advance(1)
      assert.deepEqual(deadlineTimes(h), [1000])
    }
  },
  waiting: {
    batchStarts: () => {
      const h = runningWith([5000, 5500])
      const rules = h.title.rules as {deadline: NonNullable<Rules['deadline']>}
      const deadline = rules.deadline.bind(rules)
      rules.deadline = (...args) => {
        h.clock.jump(1)
        return deadline(...args)
      }
      h.clock.jump(6000)
      const mark = h.told.length
      const writes = h.rooms.last.writes.length
      h.netcode.act('x')
      const calls = deadlineCalls(h)
      assert.deepEqual(
        calls.map(call => call.detail),
        ['5000', '5500']
      )
      assert.deepEqual(
        calls.map(call => call.context?.roomTime),
        [6000, 6000]
      )
      assert.deepEqual(
        snapshots(h, mark)
          .slice(0, 2)
          .map(view => view.snapshot.roomTime),
        [6000, 6000]
      )
      assert.deepEqual(
        h.rooms.last.writes.slice(writes, writes + 2).map(write => (write as {time: number}).time),
        [6000, 6000]
      )
    },
    dueTimeGiven: () => {
      const h = runningWith([5000, 9000])
      const mark = h.told.length
      h.clock.advance(5000)
      assert.deepEqual(deadlineTimes(h), [5000])
      assert.equal(snapshots(h, mark).length, 1)
      h.clock.advance(4000)
      assert.deepEqual(deadlineTimes(h), [5000, 9000])
    },
    deadlineFails: () => {
      const h = skipping()
      assert.deepEqual(deadlineTimes(h), [5000])
      h.clock.advance(3999)
      assert.deepEqual(deadlineTimes(h), [5000])
      h.clock.advance(1)
      assert.deepEqual(deadlineTimes(h), [5000, 9000])
    },
    deadlinesFails: () => {
      const h = runningWith([5000, 9000])
      h.failing.deadlines = true
      h.clock.advance(5000)
      h.failing.deadlines = false
      assert.equal(errors(h), 1)
      h.clock.advance(60_000)
      h.netcode.act('refuse')
      assert.deepEqual(deadlineTimes(h), [])
      assert.equal(errors(h), 1)
    },
    hundredGivenAndMoreDue: () => {
      const h = runningWith([1, 5000], each => (each.failing.chainBelow = 1000))
      h.clock.jump(1000)
      h.clock.advance(1)
      const times = deadlineTimes(h)
      assert.equal(times.length, 100)
      assert.deepEqual(times.slice(0, 2), [1, 2])
      assert.equal(times.at(-1), 100)
      assert.equal(errors(h), 1)
      h.clock.advance(3998)
      assert.equal(deadlineTimes(h).length, 100)
      h.clock.advance(1)
      assert.equal(deadlineTimes(h).at(100), 5000)
    },
    otherChange: () => {
      const h = runningWith([5000])
      h.clock.advance(1000)
      const mark = h.told.length
      h.netcode.act('x')
      assert.equal(snapshots(h, mark).length, 1)
      h.clock.advance(4000)
      assert.deepEqual(deadlineTimes(h), [5000])
    },
    matchEnds: () => {
      const h = runningWith([5000])
      h.netcode.act('win')
      h.clock.advance(60_000)
      assert.deepEqual(deadlineTimes(h), [])
    }
  },
  skipping: {
    batchStarts: () => {
      const h = skipping()
      h.clock.jump(1000)
      const mark = h.calls.length
      h.netcode.act('refuse')
      assert.deepEqual(deadlineTimes(h, mark), [])
      assert.ok(h.calls.slice(mark).some(call => call.name === 'deadlines'))
    },
    dueTimeGiven: () => {
      const h = runningWith([5000, 9000, 12_000], each => each.failing.deadline.add(5000))
      h.clock.advance(5000)
      const mark = h.told.length
      h.clock.advance(4000)
      assert.deepEqual(deadlineTimes(h), [5000, 9000])
      assert.equal(snapshots(h, mark).length, 1)
      h.clock.advance(3000)
      assert.deepEqual(deadlineTimes(h), [5000, 9000, 12_000])
    },
    deadlineFails: () => {
      const h = skipping(each => each.failing.deadline.add(9000))
      h.clock.advance(4000)
      assert.deepEqual(deadlineTimes(h), [5000, 9000])
      assert.equal(errors(h), 2)
      h.clock.advance(60_000)
      assert.deepEqual(deadlineTimes(h), [5000, 9000])
    },
    deadlinesFails: () => {
      const h = skipping()
      h.failing.deadlines = true
      h.clock.advance(4000)
      h.failing.deadlines = false
      assert.equal(errors(h), 2)
      h.clock.advance(60_000)
      h.netcode.act('refuse')
      assert.deepEqual(deadlineTimes(h), [5000])
      assert.equal(errors(h), 2)
    },
    hundredGivenAndMoreDue: () => {
      const h = runningWith([500, 6000, 50_000], each => {
        each.failing.deadline.add(500)
        each.failing.chainBelow = 7000
      })
      h.clock.advance(500)
      assert.equal(errors(h), 1)
      h.clock.jump(7000)
      h.clock.advance(5500)
      const times = deadlineTimes(h)
      assert.equal(times.length, 101)
      assert.deepEqual(times.slice(0, 3), [500, 6000, 6001])
      assert.equal(errors(h), 2)
      h.clock.advance(50_000 - 13_000 - 1)
      assert.equal(deadlineTimes(h).length, 101)
      h.clock.advance(1)
      assert.equal(deadlineTimes(h).at(-1), 50_000)
    },
    otherChange: () => {
      const h = skipping()
      h.failing.deadline.clear()
      h.clock.advance(1000)
      h.netcode.act('x')
      h.clock.advance(0)
      assert.deepEqual(deadlineTimes(h), [5000, 5000])
    },
    matchEnds: () => {
      const h = skipping()
      h.netcode.act('win')
      h.clock.advance(60_000)
      assert.deepEqual(deadlineTimes(h), [5000])
    }
  }
}

cellTests(table, scenarios)

test('7-3 deadlines fails when it returns a time later than 2^31 - 1 milliseconds after the time read', () => {
  const late = runningWith([2 ** 31])
  assert.equal(errors(late), 1)
  const edge = runningWith([2 ** 31 - 1])
  assert.equal(errors(edge), 0)
})

test('7-3 deadlines fails when it returns more than 64 times', () => {
  const many = runningWith(Array.from({length: 65}, (_, index) => 10_000 + index))
  assert.equal(errors(many), 1)
  const most = runningWith(Array.from({length: 64}, (_, index) => 10_000 + index))
  assert.equal(errors(most), 0)
})

test('7-3 7-4 when deadlines throws after 100 times were given, the host skips only the times not later than the time read', () => {
  const h = runningWith([1, 5000], each => (each.failing.chainBelow = 1000))
  const rules = h.title.rules as {deadlines: NonNullable<Rules['deadlines']>}
  const deadlines = rules.deadlines.bind(rules)
  let throwing = true
  rules.deadlines = state => {
    if (throwing && (state as unknown as Play).log.length === 101) {
      throw new Error('deadlines')
    }
    return deadlines(state)
  }
  h.clock.jump(1000)
  h.clock.advance(1)
  throwing = false
  assert.equal(deadlineTimes(h).length, 100)
  assert.equal(errors(h), 1)
  h.clock.jump(5000)
  const mark = h.calls.length
  h.netcode.act('refuse')
  assert.deepEqual(deadlineTimes(h, mark), [5000])
})

test('7-1 a title without deadlines never gets a call of deadline', () => {
  const h = harness()
  running(h)
  h.clock.advance(60_000)
  assert.deepEqual(deadlineTimes(h), [])
})
