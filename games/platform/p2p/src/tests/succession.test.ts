import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {applyIntent, createRoomState, joinPlayer, type RoomState} from '../room-state.ts'
import {acceptsSnapshot, hostAlone, promote, successorOf, winsTie} from '../succession.ts'
import {playersOf, tab} from './members.ts'
import {race, type Race} from './race.ts'

const forfeit = {...race, onSeatLeft: (state: Race, seat: string): Race => ({...state, winner: seat === 'A' ? 'B' : 'A'})}

// host (A), guest (B) and a spectator, in that order, after the host's first move
const room: RoomState<Race> = applyIntent(
  race,
  joinPlayer(joinPlayer(createRoomState(race, tab('host')), tab('guest')), tab('spectator')),
  'host',
  {type: 'move', move: 2, id: 1}
)

describe('successorOf', () => {
  it('is the first member after the host', () => {
    assert.equal(successorOf(room, ['host'])?.playerId, 'guest')
  })

  it('skips members whose link dropped too', () => {
    assert.equal(successorOf(room, ['host', 'guest'])?.playerId, 'spectator')
  })

  it('is null when nobody is left to take over', () => {
    assert.equal(successorOf(room, ['host', 'guest', 'spectator']), null)
    assert.equal(successorOf(createRoomState(race, tab('host')), []), null)
  })
})

describe('promote', () => {
  it('puts the new host first, keeps the old one last in its seat, and starts a new term', () => {
    const promoted = promote(room, 'guest')

    assert.deepEqual(playersOf(promoted.members), ['guest', 'spectator', 'host'])
    assert.equal(promoted.seats, room.seats)
    assert.equal(promoted.game, room.game)
    assert.equal(promoted.term, 1)
  })

  it('moves the new host to the front even when it had no seat', () => {
    assert.deepEqual(playersOf(promote(room, 'spectator').members), ['spectator', 'guest', 'host'])
  })

  it('does nothing for a connection that is not a member, or for the host itself', () => {
    assert.equal(promote(room, 'stranger'), room)
    assert.equal(promote(room, 'host'), room)
  })
})

describe('hostAlone', () => {
  it('keeps the game, frees the seats of everyone else and marks the room provisional', () => {
    const alone = hostAlone(forfeit, room, tab('guest'))

    assert.deepEqual(alone.members, [tab('guest')])
    assert.deepEqual(alone.seats, {A: null, B: 'guest'})
    assert.equal(alone.game.winner, 'B')
    assert.equal(alone.term, room.term)
    assert.equal(alone.origin, 'resumed')
    assert.deepEqual(alone.absent, {})
  })

  it('hosts on a new connection, and even from a snapshot that did not list this player yet', () => {
    assert.deepEqual(hostAlone(race, room, tab('guest-2', 'guest')).members, [tab('guest-2', 'guest')])
    assert.deepEqual(hostAlone(race, room, tab('late')).members, [tab('late')])
    assert.equal(Object.values(hostAlone(race, room, tab('late')).seats).includes('late'), true)
  })
})

describe('acceptsSnapshot', () => {
  const asGuest = (departed: string[], sender: string) => ({selfId: 'spectator', departed, sender})
  const promoted = promote(room, 'guest')

  it('takes the first snapshot only from the connection it names as host', () => {
    assert.equal(acceptsSnapshot(null, room, asGuest([], 'host')), true)
    assert.equal(acceptsSnapshot(null, room, asGuest([], 'guest')), false)
  })

  it("takes a first snapshot that names this tab as host, from its player's old tab", () => {
    const handed = joinPlayer(room, tab('host-2', 'host'))

    assert.equal(acceptsSnapshot(null, handed, {selfId: 'host-2', departed: [], sender: 'host'}), true)
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
    const withLate = joinPlayer(room, tab('late'))
    const bySpectator = promote(withLate, 'spectator')

    for (const departed of [[], ['host']]) {
      assert.equal(acceptsSnapshot(withLate, bySpectator, {selfId: 'late', departed, sender: 'spectator'}), false)
    }
  })

  it('ignores the member next in line without a newer term', () => {
    const sameTerm = {...promoted, term: room.term}

    assert.equal(acceptsSnapshot(room, sameTerm, asGuest([], 'guest')), false)
    assert.equal(acceptsSnapshot(room, sameTerm, asGuest(['host'], 'guest')), false)
  })

  it('takes a newer term that its host passes on as it steps down', () => {
    assert.equal(acceptsSnapshot(room, promoted, asGuest([], 'host')), true)
  })

  it('ignores a passed-on snapshot from anyone but its host, or without a newer term', () => {
    const byGuest = {...promoted, members: [tab('spectator2'), ...promoted.members], term: 1}

    assert.equal(acceptsSnapshot(room, byGuest, asGuest([], 'guest')), false)
    assert.equal(acceptsSnapshot(room, {...promoted, term: room.term}, asGuest([], 'host')), false)
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
    assert.equal(acceptsSnapshot(room, {...room, members: [tab('guest'), tab('host'), tab('spectator')]}, asHost), false)
  })
})

describe('winsTie', () => {
  // Two hosts of term 1: each took over from host on its own
  const byGuest = promote(room, 'guest')
  const bySpectator = promote(room, 'spectator')

  it('keeps the room for the lower peer ID between halves of one room, whatever their sizes', () => {
    // Each host reads its own members as they are now and the other's as they were sent, so sizes
    // could make both lose. Only values that don't change decide.
    const bigger = joinPlayer(bySpectator, tab('late'))

    assert.equal(winsTie(byGuest, bySpectator, {selfId: 'guest', departed: [], sender: 'spectator'}), true)
    assert.equal(winsTie(bySpectator, byGuest, {selfId: 'spectator', departed: [], sender: 'guest'}), false)
    assert.equal(winsTie(byGuest, bigger, {selfId: 'guest', departed: [], sender: 'spectator'}), true)
    assert.equal(winsTie(bigger, byGuest, {selfId: 'spectator', departed: [], sender: 'guest'}), false)
  })

  it('keeps the room for the earlier origin, whatever its size and peer ID', () => {
    // A player started a room under the code, then met the room with a game in progress. Once
    // connected, each host counts the other's players too, so only the origin tells them apart.
    const game = joinPlayer(joinPlayer(createRoomState(race, tab('z-host')), tab('z-guest')), tab('a-newcomer'))
    const started = joinPlayer(joinPlayer(createRoomState(race, tab('a-newcomer'), 'fresh'), tab('z-host')), tab('z-guest'))
    const resumed = {...game, origin: 'resumed' as const}
    const asNewcomer = {selfId: 'a-newcomer', departed: [], sender: 'z-host'}
    const asHost = {selfId: 'z-host', departed: [], sender: 'a-newcomer'}

    assert.equal(winsTie(started, game, asNewcomer), false)
    assert.equal(winsTie(game, started, asHost), true)
    assert.equal(winsTie(started, resumed, asNewcomer), false)
    assert.equal(winsTie(resumed, started, asHost), true)
    assert.equal(winsTie({...started, origin: 'resumed'}, game, asNewcomer), false)
    assert.equal(winsTie(game, {...started, origin: 'resumed'}, asHost), true)
  })

  it('applies only between two hosts of the same term', () => {
    const asGuestHost = {selfId: 'guest', departed: [], sender: 'spectator'}

    assert.equal(winsTie(byGuest, {...bySpectator, term: 2}, asGuestHost), false)
    assert.equal(winsTie(room, bySpectator, asGuestHost), false)
    assert.equal(winsTie(byGuest, {...bySpectator, members: [tab('guest'), tab('spectator')]}, asGuestHost), false)
  })
})
