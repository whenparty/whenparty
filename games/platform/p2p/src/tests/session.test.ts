import assert from 'node:assert/strict'
import {describe, it, type TestContext} from 'node:test'
import type {GameRules} from '../room-state.ts'
import {startSession, type Session, type SessionOptions, type SessionView} from '../session.ts'
import {createNetwork} from './fake-network.ts'
import {createClock} from './clock.ts'

interface Turns {
  moves: string[]
  turn: number
}
const seats = ['A', 'B', 'C']
const rules: GameRules<Turns, 'go'> = {
  seats,
  createState: () => ({moves: [], turn: 0}),
  applyMove: (state, seat) => (seat === seats[state.turn] ? {moves: [...state.moves, seat], turn: (state.turn + 1) % seats.length} : null),
  isOver: () => false,
  isMove: (value): value is 'go' => value === 'go',
  isState: (value): value is Turns => typeof value === 'object' && value !== null && Array.isArray((value as Turns).moves)
}
const holdMs = 30
const graceMs = 5
const go = {type: 'move', move: 'go'} as const
const startRoom = async (t: TestContext) => {
  const network = createNetwork()
  const {advance} = createClock(t, network.deliverAll)
  const opened: Session<'go'>[] = []
  const views = new Map<string, SessionView<Turns>>()
  const start = (id: string, isHost: boolean, more: Partial<SessionOptions<Turns, 'go'>> = {}) => {
    const session = startSession(
      {
        appId: 'test',
        code: 'ROOM',
        playerId: id,
        isHost,
        rules,
        seatHoldMs: holdMs,
        restoreGraceMs: graceMs,
        onChange: view => views.set(id, view),
        ...more
      },
      network.transport(id)
    )
    opened.push(session)
    return session
  }
  t.after(async () => {
    await Promise.all(opened.map(session => session.leave()))
    await network.deliverAll()
  })
  const sessions = {a: start('a', true), b: start('b', false), c: start('c', false)}
  for (const [a, b] of [
    ['a', 'b'],
    ['a', 'c'],
    ['b', 'c']
  ])
    network.connect(a!, b!)
  await network.deliverAll()
  return {network, advance, sessions, views, start}
}

describe('startSession', () => {
  it('keeps guests waiting for the creator and closes the room when the wait expires', async t => {
    const {network, advance, sessions, views} = await startRoom(t)
    sessions.a.send(go)
    await network.deliverAll()
    for (const id of ['b', 'c']) {
      network.cutLink('a', id)
      network.detectLoss(id, 'a')
    }
    await advance(holdMs - 1)
    for (const id of ['b', 'c']) {
      assert.equal(views.get(id)?.waitingForHost, true)
      assert.equal(views.get(id)?.isHost, false)
      assert.deepEqual(views.get(id)?.room?.game.moves, ['A'])
    }
    await advance(1)
    for (const id of ['b', 'c']) {
      assert.equal(views.get(id)?.hostLeft, true)
      assert.equal(views.get(id)?.isHost, false)
      assert.equal(views.get(id)?.room?.hostId, 'a')
    }
  })

  it('restores a reloaded creator from a guest and continues the same game', async t => {
    const {network, advance, sessions, views, start} = await startRoom(t)
    sessions.a.send(go)
    await network.deliverAll()
    network.page('a', 'gone')
    await network.deliverAll()
    await advance(10)
    const returned = start('a2', false, {playerId: 'a', rejoinAsHost: true})
    network.connect('a2', 'b')
    network.connect('a2', 'c')
    await network.deliverAll()
    assert.equal(views.get('a2')?.isHost, true)
    for (const id of ['a2', 'b', 'c']) {
      assert.equal(views.get(id)?.room?.hostId, 'a')
      assert.equal(views.get(id)?.room?.members[0]?.peerId, 'a2')
      assert.deepEqual(views.get(id)?.room?.game.moves, ['A'])
      assert.deepEqual(views.get(id)?.room?.reservations, {})
    }
    sessions.b.send(go)
    await network.deliverAll()
    sessions.c.send(go)
    await network.deliverAll()
    returned.send(go)
    await network.deliverAll()
    assert.deepEqual(views.get('b')?.room?.game.moves, ['A', 'B', 'C', 'A'])
  })

  it("hands the room to the creator's second tab, and everyone follows", async t => {
    const {network, sessions, views, start} = await startRoom(t)
    sessions.a.send(go)
    await network.deliverAll()
    const second = start('a2', false, {playerId: 'a'})
    for (const id of ['a', 'b', 'c']) network.connect('a2', id)
    await network.deliverAll()
    for (const id of ['a', 'a2', 'b', 'c']) {
      assert.equal(views.get(id)?.room?.members[0]?.peerId, 'a2', id)
      assert.equal(views.get(id)?.isHost, id === 'a2', id)
      assert.deepEqual(views.get(id)?.room?.game.moves, ['A'], id)
    }
    assert.equal(views.get('a')?.inControl, false)
    sessions.b.send(go)
    await network.deliverAll()
    sessions.c.send(go)
    await network.deliverAll()
    second.send(go)
    await network.deliverAll()
    assert.deepEqual(views.get('b')?.room?.game.moves, ['A', 'B', 'C', 'A'])
  })

  it('hosts a fresh room again when a reloaded creator finds nobody', async t => {
    const {network, advance, views, start} = await startRoom(t)
    start('a2', false, {playerId: 'a', rejoinAsHost: true})
    await network.deliverAll()
    assert.equal(views.get('a2')?.waitingForHost, true)
    await advance(graceMs)
    assert.equal(views.get('a2')?.isHost, true)
    assert.equal(views.get('a2')?.room?.hostId, 'a')
    start('d', false)
    network.connect('a2', 'd')
    await network.deliverAll()
    assert.equal(views.get('d')?.room?.members[0]?.peerId, 'a2')
  })

  it('restores a cached creator without giving an already absent player more time', async t => {
    const {network, advance, sessions, views} = await startRoom(t)
    sessions.a.send(go)
    await network.deliverAll()
    network.cutLink('a', 'b')
    network.detectLoss('a', 'b')
    await advance(10)
    network.page('a', 'gone')
    await network.deliverAll()
    await advance(10)
    network.page('a', 'shown')
    await network.deliverAll()
    network.connect('a', 'c')
    await network.deliverAll()
    assert.equal(views.get('a')?.isHost, true)
    assert.equal(views.get('c')?.waitingForHost, false)
    await advance(10)
    assert.equal(
      views.get('a')?.room?.members.some(member => member.playerId === 'b'),
      false
    )
    assert.deepEqual(views.get('c')?.room?.game.moves, ['A'])
  })

  it('delivers the creator goodbye before closing its connection', async t => {
    const {network, sessions, views} = await startRoom(t)
    await sessions.a.leave()
    await network.deliverAll()
    assert.equal(views.get('b')?.hostLeft, true)
    assert.equal(views.get('c')?.hostLeft, true)
  })

  it('reports an unreachable connection until that peer connects', async t => {
    const {network, views, start} = await startRoom(t)
    start('d', false)
    network.failConnection('d', 'a')
    await network.deliverAll()
    assert.equal(views.get('d')?.unreachable, true)
    network.connect('a', 'd')
    await network.deliverAll()
    assert.equal(views.get('d')?.unreachable, false)
    assert.equal(views.get('d')?.room?.hostId, 'a')
  })
})
