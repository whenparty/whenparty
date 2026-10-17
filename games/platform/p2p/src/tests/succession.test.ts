import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {addPeer, applyIntent, createRoomState, type RoomState} from '../room-state.ts'
import {acceptsSnapshot, promote, successorOf} from '../succession.ts'
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

  it("gives the old host's seat to the first member without one and keeps the game", () => {
    const promoted = promote(race, room, 'host', 'guest')

    assert.deepEqual(promoted.seats, {A: 'spectator', B: 'guest'})
    assert.equal(promoted.game, room.game)
  })

  it("leaves the old host's seat free when everyone else has one", () => {
    const pair = addPeer(createRoomState(race, 'host'), 'guest')

    assert.deepEqual(promote(race, pair, 'host', 'guest').seats, {A: null, B: 'guest'})
  })

  it('moves the new host to the front even when it had no seat', () => {
    const promoted = promote(race, room, 'host', 'spectator')

    assert.deepEqual(promoted.members, ['spectator', 'guest'])
    assert.deepEqual(promoted.seats, {A: 'spectator', B: 'guest'})
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

  it('takes a newer term from the member next in line while the host is still there', () => {
    // The successor's link to the host dropped, but this guest's did not
    assert.equal(acceptsSnapshot(room, promoted, asGuest([], 'guest')), true)
  })

  it('ignores members that are not next in line', () => {
    const withLate = addPeer(room, 'late')
    const bySpectator = promote(race, withLate, 'host', 'spectator')

    for (const departed of [[], ['host']]) {
      assert.equal(acceptsSnapshot(withLate, bySpectator, {selfId: 'late', departed, sender: 'spectator'}), false)
    }
  })

  it('ignores the member next in line without a newer term', () => {
    const sameTerm = {...promoted, term: room.term}

    assert.equal(acceptsSnapshot(room, sameTerm, asGuest([], 'guest')), false)
    assert.equal(acceptsSnapshot(room, sameTerm, asGuest(['host'], 'guest')), false)
  })

  it('ignores a snapshot that names someone else as host', () => {
    assert.equal(acceptsSnapshot(room, promoted, asGuest([], 'host')), false)
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
