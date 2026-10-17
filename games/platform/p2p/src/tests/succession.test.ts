import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {addPeer, applyIntent, createRoomState, type RoomState} from '../room-state.ts'
import {acceptsSnapshot, earlyAfterJoin, keepEarly, promote, successorOf} from '../succession.ts'
import {race, type Race} from './race.ts'

const forfeit = {...race, onSeatLeft: (state: Race, seat: string): Race => ({...state, winner: seat === 'A' ? 'B' : 'A'})}

// host (A), guest (B) and a spectator, in that order, after the host's first move
const room: RoomState<Race> = applyIntent(
  race,
  addPeer(addPeer(createRoomState(race, 'host'), 'guest'), 'spectator'),
  'host',
  {type: 'move', move: 2, id: 1}
)

describe('successorOf', () => {
  it('is the first member after the host', () => {
    assert.equal(successorOf(room, ['host']), 'guest')
  })

  it('skips members whose link dropped too', () => {
    assert.equal(successorOf(room, ['host', 'guest']), 'spectator')
  })

  it('is null when nobody is left to take over', () => {
    assert.equal(successorOf(room, ['host', 'guest', 'spectator']), null)
    assert.equal(successorOf(createRoomState(race, 'host'), []), null)
  })
})

describe('promote', () => {
  it('puts the new host first, drops the old one and starts a new term', () => {
    const promoted = promote(race, room, 'host', 'guest')

    assert.deepEqual(promoted.members, ['guest', 'spectator'])
    assert.equal(promoted.term, 1)
  })

  it("frees the old host's seat and keeps the game", () => {
    const promoted = promote(race, room, 'host', 'spectator')

    assert.deepEqual(promoted.members, ['spectator', 'guest'])
    assert.deepEqual(promoted.seats, {A: null, B: 'guest'})
    assert.equal(promoted.game, room.game)
  })

  it('lets the game react to the old host leaving its seat', () => {
    assert.equal(promote(forfeit, room, 'host', 'guest').game.winner, 'B')
  })

  it('does nothing for a new host that is not a member', () => {
    assert.equal(promote(race, room, 'host', 'stranger'), room)
  })
})

describe('acceptsSnapshot', () => {
  const asGuest = (departed: string[], sender: string) => ({selfId: 'spectator', departed, sender})
  const promoted = promote(race, room, 'host', 'guest')

  it('takes the first snapshot only from the peer it names as host', () => {
    assert.equal(acceptsSnapshot(null, room, asGuest([], 'host')), true)
    assert.equal(acceptsSnapshot(null, room, asGuest([], 'guest')), false)
  })

  it('follows its host within a term', () => {
    assert.equal(acceptsSnapshot(room, room, asGuest([], 'host')), true)
  })

  it('takes a new term from the successor once the host is gone', () => {
    assert.equal(acceptsSnapshot(room, promoted, asGuest(['host'], 'guest')), true)
  })

  it('ignores the successor while the host is still there', () => {
    assert.equal(acceptsSnapshot(room, promoted, asGuest([], 'guest')), false)
  })

  it('ignores members that are not next in line', () => {
    const byStranger = promote(race, room, 'host', 'spectator')

    assert.equal(acceptsSnapshot(room, byStranger, {selfId: 'guest', departed: ['host'], sender: 'spectator'}), false)
  })

  it('takes the old host back when it returns within the pause', () => {
    assert.equal(acceptsSnapshot(room, room, asGuest(['host'], 'host')), true)
  })

  it('never goes back to an older term', () => {
    assert.equal(acceptsSnapshot(promoted, room, asGuest([], 'host')), false)
  })

  it('makes a host step down only for a newer term', () => {
    const asHost = {selfId: 'host', departed: [], sender: 'guest'}

    assert.equal(acceptsSnapshot(room, promoted, asHost), true)
    assert.equal(acceptsSnapshot(room, {...room, members: ['guest', 'host', 'spectator']}, asHost), false)
  })
})

describe('keepEarly', () => {
  // The spectator still sees the host, but the guest already took over
  const promoted = promote(race, room, 'host', 'guest')
  const fromGuest = {selfId: 'spectator', departed: [], sender: 'guest'}

  it('keeps a newer term from the successor while the host still looks present', () => {
    const early = keepEarly(null, room, promoted, fromGuest)

    assert.deepEqual(early, {snapshot: promoted, sender: 'guest'})
  })

  it('takes the kept snapshot once the host is gone', () => {
    const early = keepEarly(null, room, promoted, fromGuest)

    assert.ok(early)
    assert.equal(acceptsSnapshot(room, early.snapshot, {...fromGuest, departed: ['host'], sender: early.sender}), true)
  })

  it('does not keep snapshots from members that are not next in line', () => {
    const withLate = addPeer(room, 'late')
    const bySpectator = promote(race, withLate, 'host', 'spectator')

    assert.equal(keepEarly(null, withLate, bySpectator, {selfId: 'late', departed: [], sender: 'spectator'}), null)
  })

  it('does not keep snapshots with an older or the same term', () => {
    assert.equal(keepEarly(null, room, {...promoted, term: 0}, fromGuest), null)
    assert.equal(keepEarly(null, {...room, term: 1}, promoted, fromGuest), null)
  })

  it('keeps nothing for a host, or once the host is gone', () => {
    assert.equal(keepEarly(null, room, promoted, {selfId: 'host', departed: [], sender: 'guest'}), null)
    assert.equal(keepEarly(null, room, promoted, {...fromGuest, departed: ['host']}), null)
  })

  it('keeps the newest early snapshot', () => {
    const newer = {...promoted, term: 2}
    const kept = keepEarly(null, room, newer, fromGuest)

    assert.equal(keepEarly(kept, room, promoted, fromGuest), kept)
    assert.deepEqual(keepEarly(keepEarly(null, room, promoted, fromGuest), room, newer, fromGuest), kept)
  })
})

describe('earlyAfterJoin', () => {
  const early = {snapshot: promote(race, room, 'host', 'guest'), sender: 'guest'}

  it('drops the early snapshot when the old host comes back', () => {
    assert.equal(earlyAfterJoin(early, room, 'host'), null)
  })

  it('keeps it when anyone else joins', () => {
    assert.equal(earlyAfterJoin(early, room, 'late'), early)
  })
})
