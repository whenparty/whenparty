import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {decodeIntent, decodePresence, decodeSnapshot, encode} from '../protocol.ts'
import {applyIntent, createRoomState, joinPlayer} from '../room-state.ts'
import {tab} from './members.ts'
import {race} from './race.ts'

const room = applyIntent(race, joinPlayer(createRoomState(race, tab('host')), tab('guest')), 'host', {type: 'move', move: 2, id: 1})

describe('snapshots', () => {
  it('survive the round trip', () => {
    const marked = {...room, absent: {guest: 'away' as const}}

    assert.deepEqual(decodeSnapshot(race, encode(room)), room)
    assert.deepEqual(decodeSnapshot(race, encode(marked)), marked)
  })

  it('reject anything that is not a room of this game', () => {
    const malformed = [
      42,
      '{not json',
      encode(null),
      encode({...room, seats: {A: 'host'}}),
      encode({...room, seats: {A: 'host', B: null, Z: null}}),
      encode({...room, seats: {A: 7, B: null}}),
      encode({...room, game: {...room.game, turn: 'Z'}})
    ]

    for (const data of malformed) {
      assert.equal(decodeSnapshot(race, data), null, String(data))
    }
  })

  it('reject bad members, terms, marks and handled intents', () => {
    const {provisional: _, ...unmarked} = room
    const malformed = [
      {...room, members: undefined},
      {...room, members: []},
      {...room, members: ['host', 'guest']},
      {...room, members: [tab('host'), {playerId: 'guest'}]},
      {...room, members: [tab('host'), tab('guest'), tab('host-2', 'host')]},
      {...room, members: [tab('host'), tab('guest'), tab('guest', 'other')]},
      {...room, seats: {A: 'host', B: 'stranger'}},
      {...room, term: -1},
      {...room, term: 1.5},
      {...room, term: '1'},
      unmarked,
      {...room, provisional: 1},
      {...room, handled: []},
      {...room, handled: {host: 0}},
      {...room, handled: {host: 'one'}},
      {...room, absent: undefined},
      {...room, absent: ['guest']},
      {...room, absent: {stranger: 'away'}},
      {...room, absent: {guest: 'gone'}}
    ]

    for (const value of malformed) {
      assert.equal(decodeSnapshot(race, encode(value)), null, encode(value))
    }
  })
})

describe('intents', () => {
  it('survive the round trip', () => {
    assert.deepEqual(decodeIntent(race, encode({type: 'move', move: 2, id: 4})), {type: 'move', move: 2, id: 4})
    assert.deepEqual(decodeIntent(race, encode({type: 'restart', id: 5})), {type: 'restart', id: 5})
  })

  it('reject unknown types, moves the game does not accept, and bad ids', () => {
    const malformed = [
      null,
      '[]',
      encode({type: 'resign', id: 1}),
      encode({type: 'move', id: 1}),
      encode({type: 'move', move: 'two', id: 1}),
      encode({type: 'move', move: 3, id: 1}),
      encode({type: 'move', move: 2}),
      encode({type: 'restart', id: 0}),
      encode({type: 'restart', id: 1.5})
    ]

    for (const data of malformed) {
      assert.equal(decodeIntent(race, data), null, String(data))
    }
  })
})

describe('presence', () => {
  it('survives the round trip', () => {
    assert.deepEqual(decodePresence(encode({playerId: 'p', away: true})), {playerId: 'p', away: true})
  })

  it('rejects anything else', () => {
    for (const data of [null, 'away', encode({playerId: 7, away: false}), encode({playerId: 'p'}), encode({playerId: 'p', away: 'yes'})]) {
      assert.equal(decodePresence(data), null, String(data))
    }
  })
})
