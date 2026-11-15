import assert from 'node:assert/strict'
import {test} from 'node:test'
import {testCells, type Check} from './cells.ts'
import {serverHarness, type RoomRef, type ServerHarness} from './server-harness.ts'
import {table} from './10-server-room.states.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = {
  readonly next: State | 'gone'
  readonly answer?: string
  readonly effects: readonly string[]
}

interface World {
  h: ServerHarness
  readonly state: State
  readonly createdAt: number
  readonly room: RoomRef
  readonly member: {readonly n: number; readonly token: string} | null
  readonly from: number
  requester: string | null
  restarted: ServerHarness | null
}

interface Options {
  readonly wait?: number | null
  readonly member?: boolean
  readonly ownerClosesAfter?: number
}

const world = (state: State, {wait = null, member = true, ownerClosesAfter = 0}: Options = {}): World => {
  const h = serverHarness()
  const createdAt = h.clock.now()
  const room = h.create('owner', wait)
  const participant = member ? h.member('owner', 'p2', room) : null
  h.join('joiner', room)
  if (state === 'away') {
    h.clock.advance(ownerClosesAfter)
    h.close('owner')
  }
  if (state === 'closed') {
    h.leave('owner', room, room.token)
  }
  return {h, state, createdAt, room, member: participant, from: h.mark(), requester: null, restarted: null}
}

const leaves = (w: World): number[] => (w.member ? [w.member.n] : [])

const fire: {readonly [E in Event]: (w: World) => void} = {
  reconnectFromOwnersPage: w => {
    w.requester = 'owner 2'
    w.h.reconnect('owner 2', w.room, {page: 'page of owner', leaves: leaves(w)})
  },
  reconnectFromOtherPage: w => {
    w.requester = 'owner 2'
    w.h.reconnect('owner 2', w.room, {page: 'another page', leaves: leaves(w)})
  },
  reconnectWithoutOwnerToken: w => {
    w.requester = 'owner 2'
    w.h.reconnect('owner 2', w.room, {page: 'page of owner', token: w.member?.token ?? 'unknown'})
  },
  ownerReturnFromOwnersPage: w => {
    w.requester = 'owner 2'
    w.h.ownerReturn('owner 2', w.room, {term: 1, page: 'page of owner', leaves: leaves(w)})
  },
  ownerReturnWithRoomTerm: w => {
    w.requester = 'owner 2'
    w.h.ownerReturn('owner 2', w.room, {term: 1, page: 'new page', leaves: leaves(w)})
  },
  ownerReturnWithOtherTerm: w => {
    w.requester = 'owner 2'
    w.h.ownerReturn('owner 2', w.room, {term: 7, page: 'new page', leaves: leaves(w)})
  },
  ownerConnectionCloses: w => w.h.close('owner'),
  ownerLeaveArrives: w => {
    w.requester = 'leaver'
    w.h.leave('leaver', w.room, w.room.token)
  },
  participantLeaveArrives: w => {
    w.requester = 'leaver'
    w.h.leave('leaver', w.room, w.member?.token ?? 'unknown')
  },
  ownerRequestFromOtherConnection: w => {
    w.requester = 'stranger'
    w.h.admit('stranger', w.room, 3)
    w.h.say('stranger', {t: 'left', app: w.room.app, code: w.room.code, n: 2})
  },
  waitingTimeWithoutOwnerConnection: w => w.h.clock.advance(600_000),
  sixHundredSecondsWithoutOwnerConnectionOrMember: w => w.h.clock.advance(600_000),
  twentyFourHoursSinceCreated: w => {
    w.h.clock.advance(w.createdAt + 86_399_999 - w.h.clock.now())
    assert.equal(w.h.probe(w.room), w.state)
    w.h.clock.advance(1)
  },
  serverRestarts: w => {
    w.restarted = serverHarness()
  },
  unreadableRequest: w => {
    w.requester = 'reader'
    w.h.say('reader', {t: 'join', r: w.h.next(), app: w.room.app, code: w.room.code, data: 'x'.repeat(2_000)})
  }
}

const answerOf = (w: World): unknown => (w.requester === null ? undefined : w.h.since(w.from, w.requester).at(-1))

const checkAnswer = (w: World, answer: string, effects: readonly string[]): void => {
  const sent = answerOf(w) as {readonly t?: string; readonly a?: string; readonly term?: number} | undefined
  switch (answer) {
    case 'none':
      return assert.equal(sent, undefined)
    case 'roster':
      return assert.deepEqual([sent?.t, sent?.term], ['roster', undefined])
    case 'term and roster':
      return assert.deepEqual([sent?.t, sent?.term], ['roster', effects.includes('raisesTerm') ? 2 : 1])
    case 'room term':
      return assert.deepEqual([sent?.t, sent?.term], ['term', 1])
    default:
      return assert.equal(sent?.a, answer)
  }
}

const effect: {readonly [name: string]: (w: World) => void} = {
  appliesLeaves: w => assert.equal(w.h.returnAs('checker', w.room, w.member?.token ?? '')?.a, 'removed'),
  makesOwnerConnection: w => {
    w.h.join('probe joiner', w.room)
    assert.equal(w.h.last(w.requester ?? '')?.t, 'ask')
  },
  raisesTerm: w => assert.equal((answerOf(w) as {readonly term?: number}).term, 2),
  requestPageBecomesOwnersPage: w => assert.equal(w.h.reconnect('owner 3', w.room, {page: 'new page'})?.t, 'roster'),
  cancelsTokens: w => {
    assert.equal(w.h.port.listed('owner', 'p2'), false)
    assert.equal(w.h.returnAs('checker', w.room, w.member?.token ?? '')?.a, 'no room')
  },
  cancelsThatToken: w => {
    assert.equal(w.h.port.listed('owner', 'p2'), false)
    assert.equal(w.h.returnAs('checker', w.room, w.member?.token ?? '')?.a, 'removed')
  },
  endsPendingJoinRequests: w => assert.notEqual(w.h.last('joiner')?.t, 'asked'),
  freesCode: w => assert.equal(w.h.join('checker', w.room)?.a, 'no room'),
  tellsOwnerConnectionRoomClosed: w => assert.equal(w.h.last('owner')?.t, 'closed'),
  dropsRequest: w => assert.deepEqual(w.requester === null ? [] : w.h.since(w.from, w.requester), []),
  forgetsEveryRoom: w => assert.equal(w.restarted?.join('checker', w.room)?.a, 'no room')
}

const effectOrder = [
  'raisesTerm',
  'dropsRequest',
  'tellsOwnerConnectionRoomClosed',
  'endsPendingJoinRequests',
  'appliesLeaves',
  'cancelsTokens',
  'cancelsThatToken',
  'freesCode',
  'forgetsEveryRoom',
  'makesOwnerConnection',
  'requestPageBecomesOwnersPage'
]

const checkOutcome = (w: World, outcome: Outcome): void => {
  if (outcome.answer !== undefined) {
    checkAnswer(w, outcome.answer, outcome.effects)
  }
  for (const name of [...outcome.effects].sort((a, b) => effectOrder.indexOf(a) - effectOrder.indexOf(b))) {
    assert.ok(effect[name], `no check of ${name}`)
    effect[name](w)
  }
  if (outcome.next === 'gone') {
    assert.equal(w.restarted?.probe(w.room), 'closed')
  } else {
    assert.equal(w.h.probe(w.room), outcome.next)
  }
}

const returnAnswers: {readonly [S in State]: {readonly t: string; readonly a?: string; readonly peer?: string}} = {
  owned: {t: 'owner', peer: 'owner'},
  away: {t: 'answer', a: 'owner away'},
  closed: {t: 'answer', a: 'no room'}
}

const extraChecks: {readonly [E in Event]?: (w: World) => void} = {
  ownerRequestFromOtherConnection: w => {
    assert.notEqual(w.h.last('joiner')?.t, 'let in')
    const answer = w.h.returnAs('p2', w.room, w.member?.token ?? '')
    assert.deepEqual(answer, {...returnAnswers[w.state], r: answer?.r})
  }
}

const scenario =
  (state: State, event: Event, options?: Options): Check<Outcome> =>
  outcome => {
    const w = world(state, options)
    fire[event](w)
    checkOutcome(w, outcome)
    extraChecks[event]?.(w)
  }

const forState = (state: State, options: {readonly [E in Event]?: Options} = {}) =>
  Object.fromEntries((Object.keys(table[state]) as Event[]).map(event => [event, scenario(state, event, options[event])])) as {
    readonly [E in Event]: Check<Outcome>
  }

testCells<Table, Outcome>('room on the server', table, {
  owned: forState('owned'),
  away: forState('away', {
    sixHundredSecondsWithoutOwnerConnectionOrMember: {wait: 3_600, member: false},
    twentyFourHoursSinceCreated: {wait: 86_400, ownerClosesAfter: 1_000}
  }),
  closed: forState('closed')
})

test('10-4 a created room has term 1, and its owner connection and page are those of the request', () => {
  const h = serverHarness()
  const room = h.create('owner')
  assert.equal(room.term, 1)
  h.join('joiner', room)
  assert.equal(h.last('owner')?.t, 'ask')
  h.close('owner')
  assert.equal(h.reconnect('owner 2', room, {page: 'page of owner'})?.t, 'roster')
})

test('10-3 a room closes when the waiting time passes without an owner connection, and not a millisecond before', () => {
  const h = serverHarness()
  const room = h.create('owner', 60)
  h.member('owner', 'p2', room)
  h.close('owner')
  h.clock.advance(59_999)
  assert.equal(h.probe(room), 'away')
  h.clock.advance(1)
  assert.equal(h.probe(room), 'closed')
})

test('10-3 a room without owner connection or member closes 600 seconds later, also with a longer waiting time', () => {
  const h = serverHarness()
  const room = h.create('owner', 3_600)
  h.close('owner')
  h.clock.advance(599_999)
  assert.equal(h.probe(room), 'away')
  h.clock.advance(1)
  assert.equal(h.probe(room), 'closed')
})

test('10-3 its code may go to a new room once it closes', () => {
  const h = serverHarness()
  const room = h.create('owner')
  h.leave('owner', room, room.token)
  assert.equal(h.join('joiner', room)?.a, 'no room')
})

test('10-5 the server handles every message of the owner connection before it learns that the connection closed', () => {
  const h = serverHarness()
  const room = h.create('owner')
  h.join('joiner', room)
  h.admit('owner', room, 2)
  h.close('owner')
  assert.equal(h.last('joiner')?.t, 'let in')
  assert.equal(h.reconnect('owner 2', room, {page: 'page of owner'})?.roster?.toString(), '2')
})

test('10-8 a leave gets no answer, and the server handles the requests of a connection in order', () => {
  const h = serverHarness()
  const room = h.create('owner')
  const p = h.member('owner', 'p2', room)
  const from = h.mark()
  h.leave('p2', room, p.token)
  assert.deepEqual(h.since(from, 'p2'), [])
  assert.equal(h.returnAs('p2', room, p.token)?.a, 'removed')
})

test('10-9 the server drops a request with a number or term outside 1 to 2,147,483,647, or in another form', () => {
  const h = serverHarness()
  const room = h.create('owner')
  const from = h.mark()
  h.say('owner 2', {t: 'return', r: h.next(), app: room.app, code: room.code, token: room.token, term: 0, page: 'p', leaves: []})
  h.say('owner 2', {
    t: 'return',
    r: h.next(),
    app: room.app,
    code: room.code,
    token: room.token,
    term: 2_147_483_648,
    page: 'p',
    leaves: []
  })
  h.say('owner 2', {t: 'reconnect', r: h.next(), app: room.app, code: room.code, token: room.token, page: 'page of owner', leaves: [0]})
  h.say('owner 2', {t: 'join', r: h.next(), app: room.app, code: room.code})
  h.say('owner 2', 'join')
  assert.deepEqual(h.since(from, 'owner 2'), [])
  assert.equal(h.ownerReturn('owner 2', room, {term: 2_147_483_647, page: 'p'})?.t, 'term')
})

test('10-2 a room goes from owned to away and back, and closes', () => {
  const h = serverHarness()
  const room = h.create('owner')
  h.member('owner', 'p2', room)
  assert.equal(h.probe(room), 'owned')
  h.close('owner')
  assert.equal(h.probe(room), 'away')
  h.reconnect('owner 2', room, {page: 'page of owner'})
  assert.equal(h.probe(room), 'owned')
  h.leave('owner 2', room, room.token)
  assert.equal(h.probe(room), 'closed')
})
