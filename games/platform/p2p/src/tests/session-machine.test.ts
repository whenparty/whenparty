import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {encode} from '../protocol.ts'
import {createRoomState, joinPlayer} from '../room-state.ts'
import {initialModel, invariantViolations, step, timersOf, type Effect, type Event, type Model} from '../session-machine.ts'
import {tab} from './members.ts'
import {race, type Race} from './race.ts'

const takeoverDelayMs = 100
const config = {self: tab('b'), rules: race, takeoverDelayMs, awayHoldMs: 1000}
const guest = (now = 0) => initialModel(config, {isHost: false, rejoinAsHost: false, provisional: false}, now)
const host = (now = 0) => initialModel({...config, self: tab('a')}, {isHost: true, rejoinAsHost: false, provisional: false}, now)

// Runs events one after another at the given times, with the given peers linked
const run = (model: Model<Race, number>, events: [number, Event<number>][], peers: string[] = []) =>
  events.reduce(
    ({model, effects}, [now, event]) => {
      const result = step(model, event, {now, peers: new Set(peers), signalingOpen: true})
      return {model: result.model, effects: [...effects, ...result.effects]}
    },
    {model, effects: [] as Effect[]}
  )

// a hosts, b and c follow, in that order
const room = joinPlayer(joinPlayer(createRoomState(race, tab('a')), tab('b')), tab('c'))
const snapshotFromA: Event<number> = {type: 'snapshot', data: encode(room), sender: 'a'}

describe('step', () => {
  it('follows the host it hears from', () => {
    const {model} = run(guest(), [
      [0, {type: 'peerJoined', peerId: 'a'}],
      [0, snapshotFromA]
    ], ['a'])

    assert.equal(model.phase.name, 'following')
    assert.deepEqual(invariantViolations(model), [])
  })

  it('waits for the next member when the host goes, and drops that wait once it is next itself', () => {
    const {model: waiting} = run(guest(), [
      [0, {type: 'peerJoined', peerId: 'a'}],
      [0, snapshotFromA],
      // b is next in line
      [10, {type: 'peerLeft', peerId: 'a'}]
    ])

    assert.equal(waiting.phase.name, 'hostLost')
    assert.equal(waiting.phase.name === 'hostLost' && waiting.phase.next.name, 'takingOver')
    assert.deepEqual([...timersOf(waiting)], [['phase', 10 + takeoverDelayMs]])

    const {model: hosting} = run(waiting, [[10 + takeoverDelayMs, {type: 'deadline', key: 'phase'}]])

    assert.equal(hosting.phase.name, 'hosting')
    assert.equal(hosting.phase.name === 'hosting' && hosting.phase.room.term, 1)
    // a is held for twice the pause, and is the only deadline left
    assert.deepEqual([...timersOf(hosting)], [['hold:a', 10 + takeoverDelayMs + takeoverDelayMs * 2]])
  })

  it('ignores a deadline it no longer waits for, or that is not due yet', () => {
    const {model} = run(guest(), [
      [0, {type: 'peerJoined', peerId: 'a'}],
      [0, snapshotFromA],
      [10, {type: 'peerLeft', peerId: 'a'}],
      [20, {type: 'peerJoined', peerId: 'a'}],
      // The host answers the presence it got
      [21, snapshotFromA]
    ])

    assert.equal(model.phase.name, 'following')
    assert.deepEqual([...timersOf(model)], [])
    assert.deepEqual(run(model, [[500, {type: 'deadline', key: 'phase'}]]).model, model)

    const lost = run(model, [[30, {type: 'peerLeft', peerId: 'a'}]]).model
    assert.equal(run(lost, [[31, {type: 'deadline', key: 'phase'}]]).model.phase.name, 'hostLost')
  })

  it('joins again when a host whose link came back does not answer', () => {
    const {model: back} = run(guest(), [
      [0, {type: 'peerJoined', peerId: 'a'}],
      [0, snapshotFromA],
      // The link to a comes up again without dropping first: a may be a new tab by now
      [10, {type: 'peerJoined', peerId: 'a'}]
    ])

    assert.deepEqual([...timersOf(back)], [['phase', 10 + takeoverDelayMs * 2]])

    const {model, effects} = run(back, [[10 + takeoverDelayMs * 2, {type: 'deadline', key: 'phase'}]])

    assert.equal(model.phase.name, 'waiting')
    assert.equal(effects.at(-1)?.type, 'rejoin')
  })

  it('keeps the page and the phase timers apart', () => {
    const {model} = run(guest(), [
      [0, {type: 'peerJoined', peerId: 'a'}],
      [0, snapshotFromA],
      [5, {type: 'page', event: 'leaving'}],
      [6, snapshotFromA],
      [7, {type: 'peerLeft', peerId: 'a'}],
      [8, {type: 'peerJoined', peerId: 'a'}],
      [9, snapshotFromA]
    ])

    assert.deepEqual([...timersOf(model)], [['revive', 5 + takeoverDelayMs]])
  })

  it('keeps no timers once the page went, and hosts again when it is back if it hosted', () => {
    const {model: gone, effects} = run(host(), [
      [0, {type: 'peerJoined', peerId: 'b'}],
      [0, {type: 'presence', data: encode({playerId: 'b', away: false}), sender: 'b'}],
      [1, {type: 'peerLeft', peerId: 'b'}],
      [2, {type: 'page', event: 'leaving'}],
      [3, {type: 'page', event: 'gone'}]
    ], ['b'])

    assert.equal(gone.phase.name, 'detached')
    assert.deepEqual([...timersOf(gone)], [])
    assert.equal(effects.at(-1)?.type, 'detach')
    // What the room it left still says goes unheard
    assert.deepEqual(run(gone, [[4, {type: 'peerJoined', peerId: 'b'}]]), {model: gone, effects: []})

    const {model: back} = run(gone, [[50, {type: 'page', event: 'shown'}]])

    assert.equal(back.phase.name, 'waiting')
    assert.deepEqual([...timersOf(back)], [['phase', 50 + takeoverDelayMs * 2]])
  })

  it('stays closed, whatever it hears', () => {
    const {model: closed, effects} = run(guest(), [
      [0, {type: 'peerJoined', peerId: 'a'}],
      [0, snapshotFromA],
      [1, {type: 'leave'}]
    ])

    assert.deepEqual(effects.map(effect => effect.type).slice(-2), ['send', 'close'])
    assert.equal(closed.phase.name, 'closed')

    const events: Event<number>[] = [
      {type: 'peerLeft', peerId: 'a'},
      snapshotFromA,
      {type: 'page', event: 'shown'},
      {type: 'send', intent: {type: 'restart'}},
      {type: 'leave'},
      {type: 'deadline', key: 'phase'}
    ]

    events.forEach(event => assert.deepEqual(step(closed, event, {now: 1000, peers: new Set(), signalingOpen: true}), {model: closed, effects: []}))
  })
})
