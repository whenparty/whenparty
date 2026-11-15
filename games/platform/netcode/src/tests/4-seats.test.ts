import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {JoinRequestAnswer, SeatContext} from '../index.ts'
import {table} from './4-seats.states.ts'
import {cellTests, type Scenarios} from './cells.ts'
import type {FakeJoinRequest} from './fakes.ts'
import {
  code,
  format,
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
  versions,
  type Harness
} from './harness.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']

type Place = 'seat' | 'queue' | 'none'

const placeOf = (h: Harness, number: number): Place => {
  const {snapshot} = lastSnapshot(h)
  return snapshot.seats.includes(number) ? 'seat' : snapshot.queue.includes(number) ? 'queue' : 'none'
}

const places: {readonly [S in State]: Place} = {
  unknown: 'none',
  asked: 'none',
  player: 'seat',
  spectator: 'queue',
  host: 'seat',
  gone: 'none'
}

const answerOf = (joinRequest: FakeJoinRequest): string | undefined => {
  const [first] = joinRequest.answers
  if (first === undefined) {
    return undefined
  }
  if (first.answer === 'refuse with data') {
    assert.deepEqual(first.joinData, {versions})
    return "refuse with the host's versions"
  }
  return first.answer
}

const contextOfSeat = (h: Harness, seat: string): SeatContext => {
  h.netcode.startMatch()
  const call = h.calls.filter(each => each.name === 'initial state').at(-1)
  assert.ok(call?.context, 'the match did not start')
  const context = call.context.seats[seat]
  assert.ok(context)
  return context
}

const contextOf: {readonly [C in NonNullable<Outcome['context']>]: (context: SeatContext) => void} = {
  lost: context => assert.equal(context.lost, true),
  'not lost': context => assert.equal(context.lost, false),
  hidden: context => assert.equal(context.hidden, true),
  visible: context => assert.equal(context.hidden, false)
}

const toldOf = (h: Harness, mark: number): string[] => names(h, mark).filter(name => name === 'join request' || name === 'request ended')

const check = (h: Harness, mark: number, number: number, outcome: Outcome, joinRequest?: FakeJoinRequest): void => {
  assert.equal(placeOf(h, number), places[outcome.next])
  assert.deepEqual(toldOf(h, mark), outcome.told === undefined ? [] : [outcome.told])
  if (joinRequest !== undefined) {
    assert.equal(answerOf(joinRequest), outcome.answer)
  }
}

const askedRequest = (h: Harness): {readonly joinRequest: FakeJoinRequest; readonly answer: JoinRequestAnswer} => {
  running(h)
  const joinRequest = request(h, 3)
  const answer = since(h, 0).find(([name]) => name === 'join request')?.[1] as JoinRequestAnswer
  assert.equal(answer.number, 3)
  return {joinRequest, answer}
}

const asSpectatorPlayer = (h: Harness): SeatContext => {
  h.rooms.on.participantLeft(2)
  assert.equal(placeOf(h, 3), 'seat')
  return contextOfSeat(h, 'B')
}

const scenarios: Scenarios<Table> = {
  unknown: {
    requestOtherVersion: outcome => {
      const h = harness()
      hosting(h)
      const mark = h.told.length
      check(h, mark, 3, outcome, request(h, 3, {versions: [1, format + 1]}))
    },
    requestBadForm: outcome => {
      const h = harness()
      hosting(h)
      const mark = h.told.length
      check(h, mark, 3, outcome, request(h, 3, 'no versions'))
    },
    requestAdmitted: outcome => {
      const h = harness()
      hosting(h)
      const mark = h.told.length
      check(h, mark, 3, outcome, request(h, 3))
    },
    requestNotAdmitted: outcome => {
      const h = harness({admit: () => false})
      hosting(h)
      const mark = h.told.length
      check(h, mark, 3, outcome, request(h, 3))
    },
    requestAfterFirstMatch: outcome => {
      const h = harness()
      running(h)
      const mark = h.told.length
      check(h, mark, 3, outcome, request(h, 3))
    },
    requestEnds: outcome => {
      const h = harness()
      hosting(h)
      const mark = h.told.length
      h.rooms.on.requestEnded(3)
      check(h, mark, 3, outcome)
    },
    joinedSeatFree: outcome => {
      const h = harness()
      hosting(h)
      const mark = h.told.length
      h.rooms.on.participantJoined(2, 'visible')
      check(h, mark, 2, outcome)
      contextOf['not lost'](contextOfSeat(h, 'B'))
    },
    joinedNoSeat: outcome => {
      const h = harness()
      hosting(h, [2])
      const mark = h.told.length
      h.rooms.on.participantJoined(3, 'visible')
      check(h, mark, 3, outcome)
      contextOf['not lost'](asSpectatorPlayer(h))
    },
    startingCompletes: outcome => {
      const h = harness()
      h.netcode.start()
      h.rooms.on.created(code, 1)
      check(h, 0, 1, outcome)
      assert.equal(lastSnapshot(h).snapshot.seats[0], 1)
    }
  },
  asked: {
    pageLetsIn: outcome => {
      const h = harness()
      const {joinRequest, answer} = askedRequest(h)
      const mark = h.told.length
      answer.letIn()
      check(h, mark, 3, outcome, joinRequest)
    },
    pageRefuses: outcome => {
      const h = harness()
      const {joinRequest, answer} = askedRequest(h)
      const mark = h.told.length
      answer.refuse()
      check(h, mark, 3, outcome, joinRequest)
    },
    requestEnds: outcome => {
      const h = harness()
      const {joinRequest} = askedRequest(h)
      const mark = h.told.length
      h.rooms.on.requestEnded(3)
      check(h, mark, 3, outcome, joinRequest)
      assert.deepEqual(since(h, mark).at(-1), ['request ended', 3])
    }
  },
  player: {
    requestEnds: outcome => {
      const h = harness()
      hosting(h, [2])
      const mark = h.told.length
      h.rooms.on.requestEnded(2)
      check(h, mark, 2, outcome)
    },
    joinedSeatFree: outcome => {
      const h = harness({seats: ['A', 'B', 'C']})
      hosting(h, [2])
      const mark = h.told.length
      h.rooms.on.participantJoined(2, 'visible')
      check(h, mark, 2, outcome)
      assert.equal(lastSnapshot(h).snapshot.seats[1], 2)
      assert.equal(h.rooms.last.sentTo.at(-1)?.[0], 2)
    },
    joinedNoSeat: outcome => {
      const h = harness()
      hosting(h, [2])
      const mark = h.told.length
      h.rooms.on.participantJoined(2, 'visible')
      check(h, mark, 2, outcome)
    },
    lost: outcome => {
      const h = harness()
      hosting(h, [2])
      h.rooms.on.participantLost(2)
      check(h, 0, 2, outcome)
      contextOf.lost(contextOfSeat(h, 'B'))
    },
    back: outcome => {
      const h = harness()
      hosting(h, [2])
      h.rooms.on.participantLost(2)
      h.rooms.on.participantBack(2, 'visible')
      check(h, 0, 2, outcome)
      contextOf['not lost'](contextOfSeat(h, 'B'))
    },
    hidden: outcome => {
      const h = harness()
      hosting(h, [2])
      h.rooms.on.visibility(2, 'hidden')
      check(h, 0, 2, outcome)
      contextOf.hidden(contextOfSeat(h, 'B'))
    },
    visible: outcome => {
      const h = harness()
      hosting(h, [2])
      h.rooms.on.visibility(2, 'hidden')
      h.rooms.on.visibility(2, 'visible')
      check(h, 0, 2, outcome)
      contextOf.visible(contextOfSeat(h, 'B'))
    },
    left: outcome => {
      const h = harness()
      running(h)
      h.rooms.on.text(JSON.stringify({t: 'action', n: 1, match: [1, 1], action: 'x'}), 2)
      assert.deepEqual(lastSnapshot(h).snapshot.accepted, [[2, 1]])
      const mark = h.told.length
      h.rooms.on.participantLeft(2)
      check(h, mark, 2, outcome)
      assert.equal(lastSnapshot(h).snapshot.seats[1], null)
      assert.deepEqual(lastSnapshot(h).snapshot.accepted, [])
    }
  },
  spectator: {
    requestEnds: outcome => {
      const h = harness()
      hosting(h, [2, 3])
      const mark = h.told.length
      h.rooms.on.requestEnded(3)
      check(h, mark, 3, outcome)
    },
    joinedSeatFree: outcome => {
      const h = harness()
      running(h, [3])
      h.rooms.on.participantLeft(2)
      assert.equal(lastSnapshot(h).snapshot.seats[1], null)
      const mark = h.told.length
      h.rooms.on.participantJoined(3, 'visible')
      check(h, mark, 3, outcome)
    },
    joinedNoSeat: outcome => {
      const h = harness()
      hosting(h, [2, 3])
      const mark = h.told.length
      h.rooms.on.participantJoined(3, 'visible')
      check(h, mark, 3, outcome)
    },
    lost: outcome => {
      const h = harness()
      hosting(h, [2, 3])
      h.rooms.on.participantLost(3)
      check(h, 0, 3, outcome)
      contextOf.lost(asSpectatorPlayer(h))
    },
    back: outcome => {
      const h = harness()
      hosting(h, [2, 3])
      h.rooms.on.participantLost(3)
      h.rooms.on.participantBack(3, 'visible')
      check(h, 0, 3, outcome)
      contextOf['not lost'](asSpectatorPlayer(h))
    },
    hidden: outcome => {
      const h = harness()
      hosting(h, [2, 3])
      h.rooms.on.visibility(3, 'hidden')
      check(h, 0, 3, outcome)
      contextOf.hidden(asSpectatorPlayer(h))
    },
    visible: outcome => {
      const h = harness()
      hosting(h, [2, 3])
      h.rooms.on.visibility(3, 'hidden')
      h.rooms.on.visibility(3, 'visible')
      check(h, 0, 3, outcome)
      contextOf.visible(asSpectatorPlayer(h))
    },
    left: outcome => {
      const h = harness()
      recoveringHost(
        h,
        recordOf(snapshotValue({running: false, state: null, match: [1, 1], seats: [1, 2], queue: [3], accepted: [[3, 4]]}))
      )
      h.rooms.on.ownerReturned(2, [2, 3])
      assert.deepEqual(lastSnapshot(h).snapshot.accepted, [[3, 4]])
      const mark = h.told.length
      h.rooms.on.participantLeft(3)
      check(h, mark, 3, outcome)
      assert.deepEqual(lastSnapshot(h).snapshot.accepted, [])
    },
    seatGoesToIt: outcome => {
      const h = harness()
      hosting(h, [2, 3])
      const mark = h.told.length
      h.rooms.on.participantLeft(2)
      check(h, mark, 3, outcome)
      assert.equal(lastSnapshot(h).snapshot.seats[1], 3)
    }
  },
  host: {
    hidden: outcome => {
      const h = harness()
      hosting(h, [2])
      h.visibility.set(true)
      check(h, 0, 1, outcome)
      contextOf.hidden(contextOfSeat(h, 'A'))
    },
    visible: outcome => {
      const h = harness()
      hosting(h, [2])
      h.visibility.set(true)
      h.visibility.set(false)
      check(h, 0, 1, outcome)
      contextOf.visible(contextOfSeat(h, 'A'))
    }
  },
  gone: {
    pageLetsIn: outcome => {
      const h = harness()
      const {joinRequest, answer} = askedRequest(h)
      answer.refuse()
      const mark = h.told.length
      answer.letIn()
      check(h, mark, 3, outcome)
      assert.deepEqual(joinRequest.answers, [{answer: 'refuse without data'}])
    },
    pageRefuses: outcome => {
      const h = harness()
      const {joinRequest, answer} = askedRequest(h)
      h.rooms.on.requestEnded(3)
      const mark = h.told.length
      answer.refuse()
      check(h, mark, 3, outcome)
      assert.deepEqual(joinRequest.answers, [])
    },
    requestEnds: outcome => {
      const h = harness()
      const {answer} = askedRequest(h)
      answer.refuse()
      const mark = h.told.length
      h.rooms.on.requestEnded(3)
      check(h, mark, 3, outcome)
    }
  }
}

cellTests(table, scenarios)

test('4-2 admit gets the public number of the participant', () => {
  const asked: number[] = []
  const h = harness({
    admit: number => {
      asked.push(number)
      return true
    }
  })
  hosting(h)
  request(h, 7)
  assert.deepEqual(asked, [7])
})

test('4-4 a participant sits on the first free seat in the order of the seats', () => {
  const h = harness({seats: ['A', 'B', 'C']})
  hosting(h, [2, 3])
  h.rooms.on.participantLeft(2)
  h.rooms.on.participantJoined(4, 'visible')
  assert.deepEqual(lastSnapshot(h).snapshot.seats, [1, 4, 3])
})

test('4-5 free seats go to the first spectators when the match ends', () => {
  const h = harness({seats: ['A', 'B', 'C']})
  running(h, [3, 4, 5])
  h.rooms.on.participantLeft(2)
  h.rooms.on.participantLeft(3)
  assert.deepEqual(lastSnapshot(h).snapshot.seats, [1, null, null])
  h.netcode.act('win')
  assert.deepEqual(lastSnapshot(h).snapshot.seats, [1, 4, 5])
  assert.deepEqual(lastSnapshot(h).snapshot.queue, [])
})

test('4-8 the host keeps whether its page is hidden and changes it in the change that its visibility makes', () => {
  const h = harness()
  h.failing.initialDue = [5000]
  running(h)
  h.clock.jump(6000)
  h.visibility.set(true)
  assert.equal(h.calls.find(call => call.name === 'deadline')?.context?.seats.A?.hidden, false)
  assert.equal(h.calls.find(call => call.detail === 'hidden A')?.context?.seats.A?.hidden, true)
})

test('4-7 the host keeps its seat', () => {
  const h = harness()
  hosting(h, [2])
  h.rooms.on.participantLeft(2)
  assert.equal(lastSnapshot(h).snapshot.seats[0], 1)
})
