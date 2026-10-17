import assert from 'node:assert/strict'
import {setTimeout as sleep} from 'node:timers/promises'
import {describe, it} from 'node:test'
import type {GameRules} from '../room-state.ts'
import {startSession, type SessionView} from '../session.ts'
import {createNetwork} from './fake-network.ts'

// Three seats that move in turn, so every move shows up in the state
interface Turns {
  moves: string[]
  turn: number
}

const seats = ['A', 'B', 'C']

const turns: GameRules<Turns, 'go'> = {
  seats,
  createState: () => ({moves: [], turn: 0}),
  applyMove: (state, seat) =>
    seat === seats[state.turn] ? {moves: [...state.moves, seat], turn: (state.turn + 1) % seats.length} : null,
  isOver: () => false,
  isMove: (value): value is 'go' => value === 'go',
  isState: (value): value is Turns =>
    typeof value === 'object' && value !== null && Array.isArray((value as Turns).moves)
}

const takeoverDelayMs = 5

// Host a, then guests b and c, seated A, B and C
const startRoom = async () => {
  const network = createNetwork()
  const views = new Map<string, SessionView<Turns>>()
  const start = (selfId: string, isHost: boolean) =>
    startSession(
      {appId: 'test', code: 'ROOM', isHost, rules: turns, takeoverDelayMs, onChange: view => views.set(selfId, view)},
      network.transport(selfId)
    )
  const sessions = {a: start('a', true), b: start('b', false), c: start('c', false)}

  network.connect('a', 'b')
  network.connect('a', 'c')
  network.connect('b', 'c')
  await network.settle()

  const hostOf = (selfId: string) => views.get(selfId)?.room?.members[0]
  const movesOf = (selfId: string) => views.get(selfId)?.room?.game.moves
  const handledOf = (selfId: string, sender: string) => views.get(selfId)?.room?.handled[sender]

  return {network, sessions, views, hostOf, movesOf, handledOf}
}

const go = {type: 'move', move: 'go'} as const

describe('startSession', () => {
  it('hands the room to the next member after the pause, and the others follow', async () => {
    const {network, sessions, hostOf, movesOf} = await startRoom()

    sessions.a.send(go)
    await network.settle()
    network.cut('a', 'b')
    network.cut('a', 'c')
    network.notice('b', 'a')
    network.notice('c', 'a')
    await sleep(takeoverDelayMs * 4)
    await network.settle()

    assert.equal(hostOf('b'), 'b')
    assert.equal(hostOf('c'), 'b')
    assert.deepEqual(movesOf('c'), ['A'])
  })

  it('keeps the old host when it comes back within the pause', async () => {
    const {network, hostOf} = await startRoom()

    network.cut('a', 'b')
    network.notice('b', 'a')
    network.connect('a', 'b')
    await sleep(takeoverDelayMs * 4)
    await network.settle()

    assert.equal(hostOf('b'), 'a')
    assert.equal(hostOf('c'), 'a')
  })

  it('follows a new host before noticing the old one gone, and resends', async () => {
    const {network, sessions, hostOf, movesOf, handledOf} = await startRoom()

    sessions.a.send(go)
    await network.settle()
    sessions.b.send(go)
    await network.settle()

    // It's c's turn. The host's links drop, but only b notices for now.
    network.cut('a', 'b')
    network.cut('a', 'c')
    network.notice('b', 'a')
    sessions.c.send(go)
    await sleep(takeoverDelayMs * 4)
    await network.settle()

    // c's move went to a and was lost. c follows b right away and sends it again, and b handles it
    // (as a rejected move: a's seat is free now, so the room is not full).
    assert.equal(hostOf('b'), 'b')
    assert.equal(hostOf('c'), 'b')
    assert.equal(handledOf('b', 'c'), 1)
    assert.equal(handledOf('c', 'c'), 1)
    assert.deepEqual(movesOf('c'), ['A', 'B'])
  })

  it('moves everyone to the new host after a short blip at the old one', async () => {
    const {network, sessions, views, hostOf, movesOf} = await startRoom()

    sessions.a.send(go)
    await network.settle()

    // Only the a-b link drops, and only b notices. c never loses a.
    network.cut('a', 'b')
    network.notice('b', 'a')
    await sleep(takeoverDelayMs * 4)
    await network.settle()
    network.connect('a', 'b')
    await network.settle()

    for (const selfId of ['a', 'b', 'c']) {
      assert.equal(hostOf(selfId), 'b', selfId)
      assert.equal(views.get(selfId)?.room?.term, 1, selfId)
      assert.equal(views.get(selfId)?.isHost, selfId === 'b', selfId)
    }

    // a is back in its old seat, so the room is full and c's move counts
    sessions.b.send(go)
    await network.settle()
    sessions.c.send(go)
    await network.settle()

    assert.deepEqual(movesOf('b'), ['A', 'B', 'C'])
    assert.deepEqual(movesOf('c'), ['A', 'B', 'C'])
  })
  // Known gap: when a also notices b gone before b takes over, a drops b from the members, so to c
  // b is no longer next in line. a later steps down to b, and c is left following a.
  it(
    'moves everyone to the new host when the old one noticed the blip first',
    {todo: 'c needs another way to learn about the new host'},
    async () => {
      const {network, sessions, hostOf} = await startRoom()

      sessions.a.send(go)
      await network.settle()
      network.cut('a', 'b')
      network.notice('a', 'b')
      network.notice('b', 'a')
      await sleep(takeoverDelayMs * 4)
      await network.settle()
      network.connect('a', 'b')
      await network.settle()

      assert.equal(hostOf('c'), 'b')
    }
  )
})
