import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {addPeer, applyIntent, createRoomState, removePeer, seatOf, type RoomState} from '../room-state.ts'
import {race, type Race} from './race.ts'

const fullRoom = (): RoomState<Race> => addPeer(createRoomState(race, 'host'), 'guest')

const playMoves = (room: RoomState<Race>, moves: [string, number][]) =>
  moves.reduce((current, [peerId, step]) => applyIntent(race, current, peerId, {type: 'move', move: step}), room)

describe('createRoomState', () => {
  it('seats the host in the first seat and starts a game', () => {
    assert.deepEqual(createRoomState(race, 'host'), {
      seats: {A: 'host', B: null},
      game: race.createState()
    })
  })
})

describe('addPeer', () => {
  it('gives a joining peer the next free seat', () => {
    assert.deepEqual(fullRoom().seats, {A: 'host', B: 'guest'})
  })

  it('lets peers join as spectators once every seat is taken', () => {
    const room = fullRoom()

    assert.equal(addPeer(room, 'spectator'), room)
  })

  it('never seats a peer twice', () => {
    const room = createRoomState(race, 'host')

    assert.equal(addPeer(room, 'host'), room)
  })
})

describe('removePeer', () => {
  it('frees the seat of a leaving peer and keeps the game', () => {
    const room = playMoves(fullRoom(), [['host', 2]])
    const left = removePeer(room, 'guest')

    assert.deepEqual(left.seats, {A: 'host', B: null})
    assert.equal(left.game, room.game)
  })

  it('hands the freed seat and the game to the next peer who joins', () => {
    const room = playMoves(fullRoom(), [['host', 2]])
    const rejoined = addPeer(removePeer(room, 'guest'), 'new-guest')

    assert.equal(seatOf(rejoined, 'new-guest'), 'B')
    assert.equal(rejoined.game.total, 2)
  })

  it('ignores spectators leaving', () => {
    const room = fullRoom()

    assert.equal(removePeer(room, 'spectator'), room)
  })
})

describe('seatOf', () => {
  it('finds the seat of a peer, or null for spectators', () => {
    const room = fullRoom()

    assert.equal(seatOf(room, 'host'), 'A')
    assert.equal(seatOf(room, 'guest'), 'B')
    assert.equal(seatOf(room, 'spectator'), null)
  })
})

describe('applyIntent', () => {
  it('applies a move from the peer whose turn it is', () => {
    const room = playMoves(fullRoom(), [['host', 2], ['guest', 1]])

    assert.equal(room.game.total, 3)
    assert.equal(room.game.turn, 'A')
  })

  it('waits until every seat is taken', () => {
    const room = createRoomState(race, 'host')

    assert.equal(applyIntent(race, room, 'host', {type: 'move', move: 1}), room)
  })

  it('rejects moves out of turn, from spectators and illegal moves', () => {
    const room = fullRoom()

    assert.equal(applyIntent(race, room, 'guest', {type: 'move', move: 1}), room)
    assert.equal(applyIntent(race, room, 'spectator', {type: 'move', move: 1}), room)
    assert.equal(applyIntent(race, room, 'host', {type: 'move', move: 3}), room)
  })

  it('restarts a finished game for a seated peer', () => {
    const over = playMoves(fullRoom(), [['host', 2], ['guest', 2], ['host', 1]])
    const restarted = applyIntent(race, over, 'guest', {type: 'restart'})

    assert.equal(over.game.winner, 'A')
    assert.deepEqual(restarted, {seats: over.seats, game: race.createState()})
  })

  it('does not restart a game in progress, or for spectators', () => {
    const playing = playMoves(fullRoom(), [['host', 2]])
    const over = playMoves(playing, [['guest', 2], ['host', 1]])

    assert.equal(applyIntent(race, playing, 'host', {type: 'restart'}), playing)
    assert.equal(applyIntent(race, over, 'spectator', {type: 'restart'}), over)
  })
})
