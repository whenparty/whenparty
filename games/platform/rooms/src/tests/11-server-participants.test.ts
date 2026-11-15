import assert from 'node:assert/strict'
import {test} from 'node:test'
import {testCells, type Check} from './cells.ts'
import {serverHarness, type RoomRef, type ServerHarness} from './server-harness.ts'
import {table} from './11-server-participants.states.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = {readonly next: State; readonly answer?: string; readonly effects: readonly string[]}

interface World {
  readonly h: ServerHarness
  readonly room: RoomRef
  readonly token: string | null
  readonly from: number
  answerTo: string
}

const refusalData = {reason: 'full'}

const world = (state: State): World => {
  const h = serverHarness()
  const room = h.create('owner')
  h.join('joiner', room)
  let token: string | null = null
  if (state !== 'asked') {
    h.admit('owner', room, 2)
    token = String(h.last('joiner')?.token)
  }
  if (state === 'gone') {
    h.leave('leaver', room, token ?? '')
  }
  return {h, room, token, from: h.mark(), answerTo: 'joiner'}
}

const returning = (w: World, refuse: boolean): void => {
  w.answerTo = 'joiner 2'
  w.h.port.refuseAllow = refuse
  w.h.returnAs('joiner 2', w.room, w.token ?? 'unknown')
  w.h.port.refuseAllow = false
}

const fire: {readonly [E in Event]: (w: World) => void} = {
  ownerLetsIn: w => w.h.admit('owner', w.room, 2),
  ownerLetsInButPeerCannotBeAdded: w => {
    w.h.port.refuseAllow = true
    w.h.admit('owner', w.room, 2)
    w.h.port.refuseAllow = false
  },
  ownerRefuses: w => w.h.refuse('owner', w.room, 2, refusalData),
  sixtySecondsPass: w => w.h.clock.advance(60_000),
  joiningPageWithdraws: w => w.h.say('joiner', {t: 'withdraw'}),
  joiningSignalingCloses: w => w.h.close('joiner'),
  ownerConnectionClosesOrChanges: w => w.h.close('owner'),
  roomCloses: w => w.h.leave('owner', w.room, w.room.token),
  participantLeaveArrives: w => w.h.leave('leaver', w.room, w.token ?? 'unknown'),
  ownerReportsLeave: w => w.h.say('owner', {t: 'left', app: w.room.app, code: w.room.code, n: 2}),
  returnAccepted: w => returning(w, false),
  returnButPeerCannotBeAdded: w => returning(w, true)
}

const sentSince = (w: World, peer: string) => w.h.since(w.from, peer)

const checkAnswer = (w: World, answer: string): void => {
  const sent = sentSince(w, w.answerTo).at(-1)
  switch (answer) {
    case 'token, number, waiting time and owner page peer ID':
      assert.deepEqual([sent?.t, typeof sent?.token, sent?.n, sent?.wait, sent?.owner], ['let in', 'string', 2, 600, 'owner'])
      return
    case 'refused':
      return assert.equal(sent?.t, 'refused')
    case 'owner page peer ID':
      return assert.deepEqual([sent?.t, sent?.peer], ['owner', 'owner'])
    default:
      return assert.equal(sent?.a, answer)
  }
}

const index = (w: World, peer: string, t: string): number => w.h.port.sent.findLastIndex(sent => sent.to === peer && sent.message.t === t)

const effect: {readonly [name: string]: (w: World) => void} = {
  addsPeerToOwnerList: w => assert.ok(w.h.port.listed('owner', w.answerTo)),
  namesNumberAndPeerToOwnerPage: w => {
    const named = sentSince(w, 'owner').find(sent => sent.t === 'named')
    assert.deepEqual([named?.n, named?.peer], [2, w.answerTo])
    assert.ok(index(w, 'owner', 'named') < Math.max(index(w, w.answerTo, 'let in'), index(w, w.answerTo, 'owner')))
  },
  ownerPageToldRequestEnded: w => assert.deepEqual(sentSince(w, 'owner').find(sent => sent.t === 'ended')?.n, 2),
  passesRefusalJoinData: w => assert.deepEqual(sentSince(w, 'joiner').at(-1)?.data, refusalData),
  cancelsToken: w => assert.match(String(w.h.returnAs('checker', w.room, w.token ?? '')?.a), /removed|no room/),
  removesPeerFromOwnerList: w => assert.equal(w.h.port.listed('owner', 'joiner'), false),
  removesOlderPeerFromOwnerList: w => {
    assert.equal(w.h.port.listed('owner', 'joiner'), false)
    assert.ok(w.h.port.listed('owner', 'joiner 2'))
  },
  tellsOwnerConnectionParticipantLeft: w => assert.equal(sentSince(w, 'owner').find(sent => sent.t === 'left')?.n, 2),
  dropsIt: w => assert.deepEqual([...sentSince(w, 'joiner'), ...sentSince(w, 'owner')], [])
}

const effectOrder = [
  'dropsIt',
  'namesNumberAndPeerToOwnerPage',
  'addsPeerToOwnerList',
  'ownerPageToldRequestEnded',
  'passesRefusalJoinData',
  'tellsOwnerConnectionParticipantLeft',
  'removesPeerFromOwnerList',
  'removesOlderPeerFromOwnerList',
  'cancelsToken'
]

const checkNext = (w: World, next: State): void => {
  if (next === 'member') {
    const token = w.token ?? String(w.h.to('joiner').find(sent => sent.t === 'let in')?.token)
    assert.match(String(w.h.returnAs('member probe', w.room, token)?.t), /owner|answer/)
    assert.notEqual(w.h.last('member probe')?.a, 'removed')
    return
  }
  w.h.admit('owner', w.room, 2)
  const letIn = w.h.to('joiner').some(sent => sent.t === 'let in')
  if (next === 'asked') {
    assert.ok(letIn)
    return
  }
  assert.equal(letIn, w.token !== null)
  if (w.token !== null) {
    assert.match(String(w.h.returnAs('gone probe', w.room, w.token)?.a), /removed|no room/)
  }
}

const scenario =
  (state: State, event: Event): Check<Outcome> =>
  outcome => {
    const w = world(state)
    fire[event](w)
    if (outcome.answer !== undefined) {
      checkAnswer(w, outcome.answer)
    } else {
      assert.ok(!sentSince(w, w.answerTo).some(sent => ['answer', 'let in', 'refused', 'owner'].includes(sent.t)))
    }
    for (const name of [...outcome.effects].sort((a, b) => effectOrder.indexOf(a) - effectOrder.indexOf(b))) {
      assert.ok(effect[name], `no check of ${name}`)
      effect[name](w)
    }
    checkNext(w, outcome.next)
  }

const forState = (state: State) =>
  Object.fromEntries((Object.keys(table[state]) as Event[]).map(event => [event, scenario(state, event)])) as {
    readonly [E in Event]: Check<Outcome>
  }

testCells<Table, Outcome>('participant on the server', table, {
  asked: forState('asked'),
  member: forState('member'),
  gone: forState('gone')
})

test('11-2 a participant counts in the room while asked, and the server never gives a number again', () => {
  const h = serverHarness()
  const room = h.create('owner')
  h.join('a', room)
  h.refuse('owner', room, 2)
  h.join('b', room)
  assert.equal(h.last('owner')?.n, 3)
  for (const peer of ['c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm']) {
    h.join(peer, room)
  }
  assert.deepEqual([h.last('l')?.t, h.last('m')?.a], ['asked', 'full'])
})

test('11-3 a return is answered at once while a join request of the same connection waits', () => {
  const h = serverHarness()
  const room = h.create('owner')
  const p = h.member('owner', 'p', room)
  const other = h.create('owner 2')
  h.join('p', other)
  assert.equal(h.returnAs('p', room, p.token)?.t, 'owner')
})

test('11-5 a let-in participant stays a member whether or not its peer connection opens', () => {
  const h = serverHarness()
  const room = h.create('owner')
  const p = h.member('owner', 'p', room)
  h.close('p')
  h.close('owner')
  assert.deepEqual(h.reconnect('owner 2', room, {page: 'page of owner'})?.roster, [p.n])
})

test('11-9 the server sends a participant page nothing on its own', () => {
  const h = serverHarness()
  const room = h.create('owner')
  h.member('owner', 'p', room)
  const from = h.mark()
  h.join('q', room)
  h.refuse('owner', room, 3)
  h.close('owner')
  h.clock.advance(60_000)
  assert.deepEqual(h.since(from, 'p'), [])
})

test('11-1 a participant goes from asked to member, and its token is cancelled', () => {
  const h = serverHarness()
  const room = h.create('owner')
  assert.equal(h.join('p', room)?.t, 'asked')
  h.admit('owner', room, 2)
  const token = String(h.last('p')?.token)
  assert.equal(h.returnAs('p', room, token)?.t, 'owner')
  h.leave('p', room, token)
  assert.equal(h.returnAs('p', room, token)?.a, 'removed')
})
