import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {
  applyDeadlines,
  applyIntent,
  createRoomState,
  dropPlayer,
  joinPlayer,
  seatOf,
  syncPresence,
  type GameRules,
  type RoomState,
  type SeatPresence
} from '../room-state.ts'
import {playersOf, tab} from './members.ts'
import {race, type Race} from './race.ts'

const forfeit = {
  ...race,
  onPresence: (state: Race, seat: string, presence: SeatPresence): Race =>
    presence === 'left' ? {...state, winner: seat === 'A' ? 'B' : 'A'} : state
}

const fullRoom = (): RoomState<Race> => joinPlayer(createRoomState(race, tab('host')), tab('guest'))
const reserving = (room: RoomState<Race>, reservations: Record<string, number>): RoomState<Race> => ({...room, reservations})

const playMoves = (room: RoomState<Race>, moves: [string, number][]) =>
  moves.reduce(
    (current, [playerId, step]) =>
      applyIntent(race, current, playerId, {type: 'move', move: step, id: (current.handled[playerId] ?? 0) + 1}),
    room
  )

describe('createRoomState', () => {
  it('makes the host the only member, in the first seat, with a new game', () => {
    assert.deepEqual(createRoomState(race, tab('host')), {
      members: [{playerId: 'host', peerId: 'host'}],
      term: 0,
      hostId: 'host',
      seats: {A: 'host', B: null},
      game: race.createState(),
      handled: {},
      clock: 0,
      reservations: {}
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

    assert.deepEqual(joinPlayer(room, tab('guest')), room)
  })

  it('moves a player that comes back on another connection to it, in its place and seat', () => {
    const room = playMoves(joinPlayer(fullRoom(), tab('spectator')), [
      ['host', 2],
      ['guest', 1]
    ])
    const back = joinPlayer(room, tab('guest-2', 'guest'))

    assert.deepEqual(back.members, [tab('host'), tab('guest-2', 'guest'), tab('spectator')])
    assert.deepEqual(back.seats, room.seats)
    assert.deepEqual(back.game, room.game)
    assert.equal(back.term, room.term)
  })

  it('forgets what it handled from the old connection, which numbers its intents from one again', () => {
    const room = playMoves(fullRoom(), [
      ['host', 2],
      ['guest', 1]
    ])
    const back = joinPlayer(room, tab('guest-2', 'guest'))

    assert.deepEqual(Object.keys(back.handled), ['host'])
    const played = playMoves(back, [
      ['host', 1],
      ['guest', 1]
    ])
    assert.equal(played.handled.guest, 1)
    assert.equal(played.game.total, room.game.total + 2)
  })

  it('starts a new term when the host comes back on another connection', () => {
    const room = fullRoom()
    const back = joinPlayer(room, tab('host-2', 'host'))

    assert.deepEqual(back.members[0], tab('host-2', 'host'))
    assert.equal(back.term, room.term + 1)
  })
})

describe('dropPlayer', () => {
  it('releases an absent player and admits the replacement without resetting the game', () => {
    const room = reserving(playMoves(fullRoom(), [['host', 2]]), {guest: 50})
    const left = dropPlayer(race, room, 'guest')

    assert.deepEqual(left.seats, {A: 'host', B: null})
    assert.deepEqual(left.game, room.game)
    assert.deepEqual(left.reservations, {})
    const joined = joinPlayer(left, tab('new-guest'))
    assert.equal(seatOf(joined, 'new-guest'), 'B')
    assert.deepEqual(joined.game, room.game)
  })

  it('leaves seats and game alone when a spectator leaves', () => {
    const room = joinPlayer(fullRoom(), tab('spectator'))
    const left = dropPlayer(forfeit, room, 'spectator')

    assert.deepEqual(playersOf(left.members), ['host', 'guest'])
    assert.deepEqual(left.seats, room.seats)
    assert.deepEqual(left.game, room.game)
  })

  it('ignores players that are not members', () => {
    const room = fullRoom()

    assert.deepEqual(dropPlayer(race, room, 'stranger'), room)
  })

  it('gives the freed seat to the first member without one, in join order', () => {
    const room = joinPlayer(joinPlayer(playMoves(fullRoom(), [['host', 2]]), tab('first')), tab('second'))
    const left = dropPlayer(race, room, 'guest')

    assert.deepEqual(playersOf(left.members), ['host', 'first', 'second'])
    assert.deepEqual(left.seats, {A: 'host', B: 'first'})
    assert.equal(left.game.total, 2)
  })

  it('lets the game react before the seat goes to someone else', () => {
    const left = dropPlayer(forfeit, joinPlayer(fullRoom(), tab('spectator')), 'guest')

    assert.equal(left.game.winner, 'A')
    assert.equal(left.seats.B, 'spectator')
  })
})

// Writes down what the game hears, with the context it hears it in
const listening = () => {
  const heard: string[] = []
  const rules: GameRules<Race, number> = {
    ...race,
    onPresence: (state, seat, presence, {occupiedSeats, absentSeats, now}) => {
      heard.push(`${seat} ${presence} occupied=${occupiedSeats.join('')} absent=${absentSeats.join('')} at ${now}`)
      return {...state}
    }
  }

  return {heard, rules}
}

describe('syncPresence', () => {
  it('tells the game when a seated player goes and when it comes back, with the room as it is then', () => {
    const {heard, rules} = listening()
    const room = fullRoom()
    const lost = syncPresence(rules, room, reserving(room, {guest: 50}), 7)
    const still = syncPresence(rules, lost, reserving(lost, {guest: 50}), 8)
    const back = syncPresence(rules, still, reserving(still, {}), 9)

    assert.deepEqual(heard, ['B lost occupied=AB absent=B at 7', 'B back occupied=AB absent= at 9'])
    assert.deepEqual(still, reserving(lost, {guest: 50}))
    assert.deepEqual(back.reservations, {})
  })

  it('tells the game nothing about spectators', () => {
    const {heard, rules} = listening()
    const room = joinPlayer(fullRoom(), tab('spectator'))

    assert.deepEqual(syncPresence(rules, room, reserving(room, {spectator: 50})).game, room.game)
    assert.deepEqual(heard, [])
  })

  it('tells a departing seat left while it still counts as occupied', () => {
    const {heard, rules} = listening()

    dropPlayer(rules, reserving(fullRoom(), {guest: 50}), 'guest', 12)

    assert.deepEqual(heard, ['B left occupied=AB absent=B at 12'])
  })

  it('starts a rematch knowing who is not here', () => {
    const {heard, rules} = listening()
    const over = {...reserving(fullRoom(), {guest: 50}), game: {total: 5, turn: 'B' as const, winner: 'A' as const}}

    applyIntent(rules, over, 'host', {type: 'restart', id: (over.handled.host ?? 0) + 1}, 20)

    assert.deepEqual(heard, ['B lost occupied=AB absent=B at 20'])
  })
})

describe('applyDeadlines', () => {
  const fired: string[] = []
  const timed: GameRules<Race, number> = {
    ...race,
    deadlinesOf: (state): Record<string, number> => (state.winner === null ? {turn: 500, match: 900} : {}),
    onDeadline: (state, key, {now}) => {
      fired.push(`${key} at ${now}`)
      return key === 'match' ? {...state, winner: 'B'} : state
    }
  }

  it('fires only the deadlines that are due, in room time', () => {
    const room = fullRoom()

    assert.equal(applyDeadlines(timed, room, 499), room)
    assert.deepEqual(fired, [])
    assert.equal(applyDeadlines(timed, room, 500).game.winner, null)
    assert.equal(applyDeadlines(timed, room, 900).game.winner, 'B')
    assert.deepEqual(fired, ['turn at 500', 'turn at 900', 'match at 900'])
  })

  it('leaves a game without deadlines alone', () => {
    const room = fullRoom()

    assert.equal(applyDeadlines(race, room, 1000), room)
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
    const room = playMoves(fullRoom(), [
      ['host', 2],
      ['guest', 1]
    ])

    assert.equal(room.game.total, 3)
    assert.equal(room.game.turn, 'A')
  })

  it('gives the game the room as it is: occupied and absent seats, and room time', () => {
    let seen: unknown = null
    const watching: GameRules<Race, number> = {...race, applyMove: (state, _seat, _move, context) => ((seen = context), state)}
    const room = reserving(joinPlayer(fullRoom(), tab('spectator')), {guest: 50})

    applyIntent(watching, room, 'host', {type: 'move', move: 1, id: 1}, 33)

    assert.deepEqual(seen, {occupiedSeats: ['A', 'B'], absentSeats: ['B'], now: 33})
  })

  it('lets the game reject moves while a required seat is free', () => {
    const room = playMoves(createRoomState(race, tab('host')), [['host', 1]])

    assert.equal(room.game.total, 0)
  })

  it('lets a game accept moves with a free seat', () => {
    const flexible: GameRules<Race, number> = {
      ...race,
      applyMove: state => ({...state, total: state.total + 1})
    }
    const room = createRoomState(flexible, tab('host'))

    assert.equal(applyIntent(flexible, room, 'host', {type: 'move', move: 1, id: 1}).game.total, 1)
  })

  it('rejects moves out of turn, from spectators and illegal moves', () => {
    const room = joinPlayer(fullRoom(), tab('spectator'))

    for (const move of [
      ['guest', 1],
      ['spectator', 1],
      ['host', 3]
    ] as [string, number][]) {
      assert.equal(playMoves(room, [move]).game, room.game, move.join(' '))
    }
  })

  it('applies each intent at most once even after its player gets another turn', () => {
    const intent = {type: 'move', move: 2, id: 7} as const
    const once = applyIntent(race, fullRoom(), 'host', intent)
    const nextTurn = applyIntent(race, once, 'guest', {type: 'move', move: 1, id: 1})

    assert.deepEqual(applyIntent(race, nextTurn, 'host', intent), nextTurn)
    assert.deepEqual(applyIntent(race, nextTurn, 'host', {...intent, id: 6}), nextTurn)
    assert.equal(nextTurn.game.total, 3)
    assert.equal(applyIntent(race, nextTurn, 'host', {...intent, id: 8}).game.total, 5)
  })

  it('remembers the last intent it handled from each player, applied or not', () => {
    const before = fullRoom()
    const room = applyIntent(race, before, 'guest', {type: 'move', move: 1, id: 3})

    assert.deepEqual(room.handled, {guest: 3})
    assert.deepEqual(room.game, before.game)
  })

  it('ignores intents from players that are not members', () => {
    const room = fullRoom()

    assert.deepEqual(applyIntent(race, room, 'stranger', {type: 'move', move: 1, id: 1}), room)
  })

  it('restarts a finished game for a seated player', () => {
    const over = playMoves(fullRoom(), [
      ['host', 2],
      ['guest', 2],
      ['host', 1]
    ])
    const restarted = applyIntent(race, over, 'guest', {type: 'restart', id: (over.handled.guest ?? 0) + 1})

    assert.equal(over.game.winner, 'A')
    assert.deepEqual(restarted.game, race.createState())
    assert.deepEqual(restarted.seats, over.seats)
  })

  it('does not restart a game in progress, or for spectators', () => {
    const playing = playMoves(joinPlayer(fullRoom(), tab('spectator')), [['host', 2]])
    const over = playMoves(playing, [
      ['guest', 2],
      ['host', 1]
    ])

    assert.deepEqual(applyIntent(race, playing, 'host', {type: 'restart', id: (playing.handled.host ?? 0) + 1}).game, playing.game)
    assert.deepEqual(applyIntent(race, over, 'spectator', {type: 'restart', id: 1}).game, over.game)
  })
})
