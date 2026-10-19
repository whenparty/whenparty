import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {applyIntent, createRoomState, dropPlayer, joinPlayer, seatOf, type RoomState} from '../room-state.ts'
import {playersOf, tab} from './members.ts'
import {race, type Race} from './race.ts'

// The player who stays wins when the other one leaves
const forfeit = {...race, onSeatLeft: (state: Race, seat: string): Race => ({...state, winner: seat === 'A' ? 'B' : 'A'})}

const fullRoom = (): RoomState<Race> => joinPlayer(createRoomState(race, tab('host')), tab('guest'))

let intentId = 0

const playMoves = (room: RoomState<Race>, moves: [string, number][]) =>
  moves.reduce(
    (current, [playerId, step]) => applyIntent(race, current, playerId, {type: 'move', move: step, id: ++intentId}),
    room
  )

describe('createRoomState', () => {
  it('makes the host the only member, in the first seat, with a new game', () => {
    assert.equal(createRoomState(race, tab('host'), 'fresh').origin, 'fresh')
    assert.deepEqual(createRoomState(race, tab('host')), {
      members: [{playerId: 'host', peerId: 'host'}],
      term: 0,
      origin: 'original',
      seats: {A: 'host', B: null},
      game: race.createState(),
      handled: {},
      absent: {}
    })
  })
})

describe('joinPlayer', () => {
  it('adds players in join order and gives them the next free seat', () => {
    const room = fullRoom()

    assert.deepEqual(playersOf(room.members), ['host', 'guest'])
    assert.deepEqual(room.seats, {A: 'host', B: 'guest'})
  })

  it('adds spectators as members without a seat once every seat is taken', () => {
    const room = joinPlayer(fullRoom(), tab('spectator'))

    assert.deepEqual(playersOf(room.members), ['host', 'guest', 'spectator'])
    assert.deepEqual(room.seats, {A: 'host', B: 'guest'})
  })

  it('never adds a connection twice', () => {
    const room = fullRoom()

    assert.equal(joinPlayer(room, tab('guest')), room)
  })

  it('moves a player that comes back on another connection to it, in its place and seat', () => {
    const room = playMoves(joinPlayer(fullRoom(), tab('spectator')), [['host', 2], ['guest', 1]])
    const back = joinPlayer(room, tab('guest-2', 'guest'))

    assert.deepEqual(back.members, [tab('host'), tab('guest-2', 'guest'), tab('spectator')])
    assert.equal(back.seats, room.seats)
    assert.equal(back.game, room.game)
    assert.equal(back.term, room.term)
  })

  it('forgets what it handled from the old connection, which numbers its intents from one again', () => {
    const room = playMoves(fullRoom(), [['host', 2], ['guest', 1]])
    const back = joinPlayer(room, tab('guest-2', 'guest'))

    assert.deepEqual(Object.keys(back.handled), ['host'])
    assert.equal(playMoves(back, [['guest', 1]]).handled.guest, intentId)
  })

  it('starts a new term when the host comes back on another connection', () => {
    const room = fullRoom()
    const back = joinPlayer(room, tab('host-2', 'host'))

    assert.deepEqual(back.members[0], tab('host-2', 'host'))
    assert.equal(back.term, room.term + 1)
  })
})

describe('dropPlayer', () => {
  it('drops a member and keeps the order of the others', () => {
    const room = dropPlayer(race, joinPlayer(fullRoom(), tab('spectator')), 'guest')

    assert.deepEqual(playersOf(room.members), ['host', 'spectator'])
  })

  it('frees the seat of a leaving player and keeps the game', () => {
    const room = playMoves(fullRoom(), [['host', 2]])
    const left = dropPlayer(race, room, 'guest')

    assert.deepEqual(left.seats, {A: 'host', B: null})
    assert.equal(left.game, room.game)
  })

  it('lets the game react to a player leaving', () => {
    const left = dropPlayer(forfeit, fullRoom(), 'guest')

    assert.equal(left.game.winner, 'A')
  })

  it('leaves seats and game alone when a spectator leaves', () => {
    const room = joinPlayer(fullRoom(), tab('spectator'))
    const left = dropPlayer(forfeit, room, 'spectator')

    assert.deepEqual(playersOf(left.members), ['host', 'guest'])
    assert.equal(left.seats, room.seats)
    assert.equal(left.game, room.game)
  })

  it('ignores players that are not members', () => {
    const room = fullRoom()

    assert.equal(dropPlayer(race, room, 'stranger'), room)
  })

  it('forgets that a dropped player was absent', () => {
    const room = {...fullRoom(), absent: {guest: 'offline' as const}}

    assert.deepEqual(dropPlayer(race, room, 'guest').absent, {})
  })

  it('gives the freed seat to the first member without one, in join order', () => {
    const room = joinPlayer(joinPlayer(playMoves(fullRoom(), [['host', 2]]), tab('first')), tab('second'))
    const left = dropPlayer(race, room, 'guest')

    assert.deepEqual(left.seats, {A: 'host', B: 'first'})
    assert.equal(left.game.total, 2)
  })

  it('lets the game react before the seat goes to someone else', () => {
    const left = dropPlayer(forfeit, joinPlayer(fullRoom(), tab('spectator')), 'guest')

    // The forfeit counts against the seat that was left, not against the spectator who took it
    assert.equal(left.game.winner, 'A')
    assert.equal(left.seats.B, 'spectator')
  })

  it('hands the freed seat and the game to the next player who joins', () => {
    const room = playMoves(fullRoom(), [['host', 2]])
    const rejoined = joinPlayer(dropPlayer(race, room, 'guest'), tab('new-guest'))

    assert.equal(seatOf(rejoined, 'new-guest'), 'B')
    assert.equal(rejoined.game.total, 2)
  })
})

describe('seatOf', () => {
  it('finds the seat of a player, or null for spectators', () => {
    const room = joinPlayer(fullRoom(), tab('spectator'))

    assert.equal(seatOf(room, 'host'), 'A')
    assert.equal(seatOf(room, 'guest'), 'B')
    assert.equal(seatOf(room, 'spectator'), null)
  })
})

describe('applyIntent', () => {
  it('applies a move from the player whose turn it is', () => {
    const room = playMoves(fullRoom(), [['host', 2], ['guest', 1]])

    assert.equal(room.game.total, 3)
    assert.equal(room.game.turn, 'A')
  })

  it('waits until every seat is taken', () => {
    const room = playMoves(createRoomState(race, tab('host')), [['host', 1]])

    assert.equal(room.game.total, 0)
  })

  it('rejects moves out of turn, from spectators and illegal moves', () => {
    const room = joinPlayer(fullRoom(), tab('spectator'))

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

  it('remembers the last intent it handled from each player, applied or not', () => {
    const before = fullRoom()
    const room = applyIntent(race, before, 'guest', {type: 'move', move: 1, id: 3})

    assert.deepEqual(room.handled, {guest: 3})
    assert.equal(room.game, before.game)
  })

  it('ignores intents from players that are not members', () => {
    const room = fullRoom()

    assert.equal(applyIntent(race, room, 'stranger', {type: 'move', move: 1, id: 1}), room)
  })

  it('restarts a finished game for a seated player', () => {
    const over = playMoves(fullRoom(), [['host', 2], ['guest', 2], ['host', 1]])
    const restarted = applyIntent(race, over, 'guest', {type: 'restart', id: ++intentId})

    assert.equal(over.game.winner, 'A')
    assert.deepEqual(restarted.game, race.createState())
    assert.equal(restarted.seats, over.seats)
  })

  it('does not restart a game in progress, or for spectators', () => {
    const playing = playMoves(joinPlayer(fullRoom(), tab('spectator')), [['host', 2]])
    const over = playMoves(playing, [['guest', 2], ['host', 1]])

    assert.equal(applyIntent(race, playing, 'host', {type: 'restart', id: ++intentId}).game, playing.game)
    assert.equal(applyIntent(race, over, 'spectator', {type: 'restart', id: ++intentId}).game, over.game)
  })
})
