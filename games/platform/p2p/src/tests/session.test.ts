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

  return {network, sessions, hostOf, movesOf, handledOf}
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

  it('follows a new host heard from before the old one was noticed gone, and resends', async () => {
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

    assert.equal(hostOf('b'), 'b')
    assert.equal(hostOf('c'), 'a')

    network.notice('c', 'a')
    await network.settle()

    // c's move went to a and was lost. c sent it again to b, which handled it (as a rejected
    // move: a's seat is free now, so the room is not full).
    assert.equal(hostOf('c'), 'b')
    assert.equal(handledOf('b', 'c'), 1)
    assert.equal(handledOf('c', 'c'), 1)
    assert.deepEqual(movesOf('c'), ['A', 'B'])
  })
})
