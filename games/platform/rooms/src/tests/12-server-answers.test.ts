import assert from 'node:assert/strict'
import {test} from 'node:test'
import {testCells, type Check} from './cells.ts'
import {app, serverHarness, type RoomRef, type ServerHarness} from './server-harness.ts'
import {create, join, returning} from './12-server-answers.states.ts'

const createRequest = (h: ServerHarness, peer: string, fields: {readonly app?: string; readonly wait?: unknown}) => {
  h.say(peer, {t: 'create', r: h.next(), app, wait: null, page: 'page', ...fields})
  return h.last(peer)
}

const createEvents = {
  validRequest: {},
  appIdNotValid: {app: 'Tic Tac Toe'},
  waitingTimeNotValid: {wait: 59},
  bothNotValid: {app: '', wait: 86_401}
} as const

type CreateOutcome = {readonly answer: string}

const createScenario =
  (busy: boolean, event: keyof typeof createEvents): Check<CreateOutcome> =>
  outcome => {
    const h = serverHarness()
    if (busy) {
      h.create('creator')
    }
    const answer = createRequest(h, 'creator', createEvents[event])
    if (outcome.answer === 'created, with code and term 1') {
      assert.deepEqual([answer?.t, answer?.term, typeof answer?.code], ['created', 1, 'string'])
    } else {
      assert.equal(answer?.a, outcome.answer)
    }
  }

const createScenarios = (busy: boolean) =>
  Object.fromEntries(Object.keys(createEvents).map(event => [event, createScenario(busy, event as keyof typeof createEvents)])) as {
    readonly [E in keyof typeof createEvents]: Check<CreateOutcome>
  }

testCells<typeof create, CreateOutcome>('create', create, {
  roomCanOpen: createScenarios(false),
  tenOpenOrConnectionHasOpenRoom: createScenarios(true)
})

type JoinOutcome = {readonly answer: string; readonly reservesNumberAndAsksOwner: boolean}

const joinWorld: {readonly [S in keyof typeof join]: (h: ServerHarness) => RoomRef} = {
  noRoom: h => {
    const room = h.create('owner')
    h.leave('owner', room, room.token)
    return room
  },
  noOwnerConnection: h => {
    const room = h.create('owner')
    h.member('owner', 'member', room)
    h.close('owner')
    return room
  },
  full: h => {
    const room = h.create('owner')
    for (let peer = 0; peer < 11; peer += 1) {
      h.join(`joiner ${peer}`, room)
    }
    return room
  },
  connectionHasWaitingJoin: h => {
    const room = h.create('owner')
    h.join('joiner', room)
    return room
  },
  open: h => h.create('owner')
}

const joinScenario =
  (state: keyof typeof join, event: keyof (typeof join)['open']): Check<JoinOutcome> =>
  outcome => {
    const h = serverHarness()
    const room = joinWorld[state](h)
    const from = h.mark()
    h.say('joiner', {t: 'join', r: h.next(), app: event === 'appIdNotValid' ? 'App' : app, code: room.code, data: {version: 3}})
    const answer = h.last('joiner')
    assert.equal(answer?.t === 'asked' ? 'asked' : answer?.a, outcome.answer)
    const ask = h.since(from, 'owner').find(sent => sent.t === 'ask')
    assert.equal(ask !== undefined, outcome.reservesNumberAndAsksOwner)
    if (ask) {
      assert.deepEqual([ask.n, ask.data], [2, {version: 3}])
    }
  }

const joinScenarios = (state: keyof typeof join) => ({
  validRequest: joinScenario(state, 'validRequest'),
  appIdNotValid: joinScenario(state, 'appIdNotValid')
})

testCells<typeof join, JoinOutcome>('join', join, {
  noRoom: joinScenarios('noRoom'),
  noOwnerConnection: joinScenarios('noOwnerConnection'),
  full: joinScenarios('full'),
  connectionHasWaitingJoin: joinScenarios('connectionHasWaitingJoin'),
  open: joinScenarios('open')
})

type ReturnOutcome = {readonly answer: string}

const returnWorld: {readonly [S in keyof typeof returning]: (h: ServerHarness) => {readonly room: RoomRef; readonly token: string}} = {
  noRoom: h => {
    const room = h.create('owner')
    const p = h.member('owner', 'member', room)
    h.leave('owner', room, room.token)
    return {room, token: p.token}
  },
  ownerToken: h => {
    const room = h.create('owner')
    return {room, token: room.token}
  },
  unknownToken: h => ({room: h.create('owner'), token: 'unknown token'}),
  noOwnerConnection: h => {
    const room = h.create('owner')
    const p = h.member('owner', 'member', room)
    h.close('owner')
    return {room, token: p.token}
  },
  memberToken: h => {
    const room = h.create('owner')
    const p = h.member('owner', 'member', room)
    return {room, token: p.token}
  }
}

const returnScenario =
  (state: keyof typeof returning, event: keyof (typeof returning)['noRoom']): Check<ReturnOutcome> =>
  outcome => {
    const h = serverHarness()
    const {room, token} = returnWorld[state](h)
    const appId = event === 'appIdNotValid' ? 'App' : app
    h.say('returner', {t: 'return', r: h.next(), app: appId, code: room.code, token, term: 1, page: 'page of owner', leaves: []})
    const answer = h.last('returner')
    const seen = {roster: 'as a return of the owner', owner: 'as the acceptance of a return'}[String(answer?.t)] ?? answer?.a
    assert.equal(seen, outcome.answer)
  }

const returnScenarios = (state: keyof typeof returning) => ({
  validRequest: returnScenario(state, 'validRequest'),
  appIdNotValid: returnScenario(state, 'appIdNotValid')
})

testCells<typeof returning, ReturnOutcome>('return', returning, {
  noRoom: returnScenarios('noRoom'),
  ownerToken: returnScenarios('ownerToken'),
  unknownToken: returnScenarios('unknownToken'),
  noOwnerConnection: returnScenarios('noOwnerConnection'),
  memberToken: returnScenarios('memberToken')
})

test('12-1 a waiting time of 60 or 86,400 seconds or none is valid, and 59, 86,401 or 60.5 is not', () => {
  const h = serverHarness()
  const answers = [60, 86_400, null, 59, 86_401, 60.5].map((wait, peer) => createRequest(h, `creator ${peer}`, {wait}))
  assert.deepEqual(
    answers.map(answer => answer?.t === 'created' || answer?.a),
    [true, true, true, 'bad wait', 'bad wait', 'bad wait']
  )
})

test('12-1 an app ID of 1 to 64 lowercase letters, digits, dots, hyphens and slashes is valid', () => {
  const h = serverHarness()
  const answers = ['a', 'a'.repeat(64), 'games/tic-tac.toe2', 'a'.repeat(65), 'A', 'tic_tac'].map((appId, peer) =>
    createRequest(h, `creator ${peer}`, {app: appId})
  )
  assert.deepEqual(
    answers.map(answer => answer?.t === 'created' || answer?.a),
    [true, true, true, 'bad app', 'bad app', 'bad app']
  )
})

test('12-1 the server is busy when 10 rooms are open across all app IDs', () => {
  const h = serverHarness()
  for (let peer = 0; peer < 9; peer += 1) {
    assert.equal(createRequest(h, `creator ${peer}`, {app: `app${peer}`})?.t, 'created')
  }
  assert.equal(createRequest(h, 'creator 9', {})?.t, 'created')
  assert.equal(createRequest(h, 'creator 10', {app: 'other'})?.a, 'busy')
})

test('12-1 a connection whose room closed may create another', () => {
  const h = serverHarness()
  const room = h.create('creator')
  h.leave('creator', room, room.token)
  assert.equal(createRequest(h, 'creator', {})?.t, 'created')
})

test('12-2 a code finds only a room of the same app ID', () => {
  const h = serverHarness()
  const room = h.create('owner')
  h.say('joiner', {t: 'join', r: h.next(), app: 'other', code: room.code, data: null})
  assert.equal(h.last('joiner')?.a, 'no room')
})
