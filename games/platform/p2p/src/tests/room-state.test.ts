import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {addPeer, applyIntent, createRoomState, removePeer, seatOf, type RoomState} from '../room-state.ts'
import {race, type Race} from './race.ts'

// The player who stays wins when the other one leaves
const forfeit = {...race, onSeatLeft: (state: Race, seat: string): Race => ({...state, winner: seat === 'A' ? 'B' : 'A'})}

const fullRoom = (): RoomState<Race> => addPeer(createRoomState(race, 'host'), 'guest')

let intentId = 0

const playMoves = (room: RoomState<Race>, moves: [string, number][]) =>
  moves.reduce(
    (current, [peerId, step]) => applyIntent(race, current, peerId, {type: 'move', move: step, id: ++intentId}),
    room
  )

describe('createRoomState', () => {
  it('makes the host the only member, in the first seat, with a new game', () => {
    assert.deepEqual(createRoomState(race, 'host'), {
      members: ['host'],
      term: 0,
      seats: {A: 'host', B: null},
      game: race.createState(),
      handled: {}
    })
  })
})

describe('addPeer', () => {
  it('adds members in join order and gives them the next free seat', () => {
    const room = fullRoom()

    assert.deepEqual(room.members, ['host', 'guest'])
    assert.deepEqual(room.seats, {A: 'host', B: 'guest'})
  })

  it('adds spectators as members without a seat once every seat is taken', () => {
    const room = addPeer(fullRoom(), 'spectator')

    assert.deepEqual(room.members, ['host', 'guest', 'spectator'])
    assert.deepEqual(room.seats, {A: 'host', B: 'guest'})
  })

  it('never adds a member twice', () => {
    const room = fullRoom()

    assert.equal(addPeer(room, 'guest'), room)
  })
})

describe('removePeer', () => {
  it('drops a member and keeps the order of the others', () => {
    const room = removePeer(race, addPeer(fullRoom(), 'spectator'), 'guest')

    assert.deepEqual(room.members, ['host', 'spectator'])
  })

  it('frees the seat of a leaving player and keeps the game', () => {
    const room = playMoves(fullRoom(), [['host', 2]])
    const left = removePeer(race, room, 'guest')

    assert.deepEqual(left.seats, {A: 'host', B: null})
    assert.equal(left.game, room.game)
  })

  it('lets the game react to a player leaving', () => {
    const left = removePeer(forfeit, fullRoom(), 'guest')

    assert.equal(left.game.winner, 'A')
  })

  it('leaves seats and game alone when a spectator leaves', () => {
    const room = addPeer(fullRoom(), 'spectator')
    const left = removePeer(forfeit, room, 'spectator')

    assert.deepEqual(left.members, ['host', 'guest'])
    assert.equal(left.seats, room.seats)
    assert.equal(left.game, room.game)
  })

  it('ignores peers that are not members', () => {
    const room = fullRoom()

    assert.equal(removePeer(race, room, 'stranger'), room)
  })

  it('gives the freed seat to the first member without one, in join order', () => {
    const room = addPeer(addPeer(playMoves(fullRoom(), [['host', 2]]), 'first'), 'second')
    const left = removePeer(race, room, 'guest')

    assert.deepEqual(left.seats, {A: 'host', B: 'first'})
    assert.equal(left.game.total, 2)
  })

  it('lets the game react before the seat goes to someone else', () => {
    const left = removePeer(forfeit, addPeer(fullRoom(), 'spectator'), 'guest')

    // The forfeit counts against the seat that was left, not against the spectator who took it
    assert.equal(left.game.winner, 'A')
    assert.equal(left.seats.B, 'spectator')
  })

  it('hands the freed seat and the game to the next peer who joins', () => {
    const room = playMoves(fullRoom(), [['host', 2]])
    const rejoined = addPeer(removePeer(race, room, 'guest'), 'new-guest')

    assert.equal(seatOf(rejoined, 'new-guest'), 'B')
    assert.equal(rejoined.game.total, 2)
  })
})

describe('seatOf', () => {
  it('finds the seat of a peer, or null for spectators', () => {
    const room = addPeer(fullRoom(), 'spectator')

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
    const room = playMoves(createRoomState(race, 'host'), [['host', 1]])

    assert.equal(room.game.total, 0)
  })

  it('rejects moves out of turn, from spectators and illegal moves', () => {
    const room = addPeer(fullRoom(), 'spectator')

    for (const move of [['guest', 1], ['spectator', 1], ['host', 3]] as [string, number][]) {
      assert.equal(playMoves(room, [move]).game, room.game, move.join(' '))
    }
  })

  it('applies each intent at most once, so a guest can safely send it again', () => {
    const intent = {type: 'move', move: 2, id: 7} as const
    const once = applyIntent(race, fullRoom(), 'host', intent)

    assert.equal(applyIntent(race, once, 'host', intent), once)
    assert.equal(applyIntent(race, once, 'host', {...intent, id: 6}), once)
    assert.equal(once.game.total, 2)
  })

  it('remembers the last intent it handled from each member, applied or not', () => {
    const before = fullRoom()
    const room = applyIntent(race, before, 'guest', {type: 'move', move: 1, id: 3})

    assert.deepEqual(room.handled, {guest: 3})
    assert.equal(room.game, before.game)
  })

  it('ignores intents from peers that are not members', () => {
    const room = fullRoom()

    assert.equal(applyIntent(race, room, 'stranger', {type: 'move', move: 1, id: 1}), room)
  })

  it('restarts a finished game for a seated peer', () => {
    const over = playMoves(fullRoom(), [['host', 2], ['guest', 2], ['host', 1]])
    const restarted = applyIntent(race, over, 'guest', {type: 'restart', id: ++intentId})

    assert.equal(over.game.winner, 'A')
    assert.deepEqual(restarted.game, race.createState())
    assert.equal(restarted.seats, over.seats)
  })

  it('does not restart a game in progress, or for spectators', () => {
    const playing = playMoves(addPeer(fullRoom(), 'spectator'), [['host', 2]])
    const over = playMoves(playing, [['guest', 2], ['host', 1]])

    assert.equal(applyIntent(race, playing, 'host', {type: 'restart', id: ++intentId}).game, playing.game)
    assert.equal(applyIntent(race, over, 'spectator', {type: 'restart', id: ++intentId}).game, over.game)
  })
})
