import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {decodeIntent, decodeSnapshot, encode} from '../protocol.ts'
import {addPeer, createRoomState} from '../room-state.ts'
import {race} from './race.ts'

const room = addPeer(createRoomState(race, 'host'), 'guest')

describe('snapshots', () => {
  it('survive the round trip', () => {
    assert.deepEqual(decodeSnapshot(race, encode(room)), room)
  })

  it('reject anything that is not a room of this game', () => {
    const malformed = [
      42,
      '{not json',
      encode(null),
      encode({game: room.game}),
      encode({seats: {A: 'host'}, game: room.game}),
      encode({seats: {A: 'host', B: null, Z: null}, game: room.game}),
      encode({seats: {A: 7, B: null}, game: room.game}),
      encode({seats: room.seats, game: {...room.game, turn: 'Z'}})
    ]

    for (const data of malformed) {
      assert.equal(decodeSnapshot(race, data), null, String(data))
    }
  })
})

describe('intents', () => {
  it('survive the round trip', () => {
    assert.deepEqual(decodeIntent(race, encode({type: 'move', move: 2})), {type: 'move', move: 2})
    assert.deepEqual(decodeIntent(race, encode({type: 'restart'})), {type: 'restart'})
  })

  it('reject unknown types and moves the game does not accept', () => {
    const malformed = [
      null,
      '[]',
      encode({type: 'resign'}),
      encode({type: 'move'}),
      encode({type: 'move', move: 'two'}),
      encode({type: 'move', move: 3})
    ]

    for (const data of malformed) {
      assert.equal(decodeIntent(race, data), null, String(data))
    }
  })
})
