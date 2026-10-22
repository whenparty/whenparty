import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {applyIntent, createRoomState, dropPlayer, joinPlayer, seatOf, syncPresence, type RoomState} from '@whenparty/p2p'
import {
  announcementOf,
  calisthenics,
  isFinished,
  resultsOf,
  standingsOf,
  performanceKey,
  type Championship,
  type Move,
  type Plan
} from '../engine/index.ts'
import {contextOf, finishPerformances, perfectPlans, performing as performingState, plan, rests, started} from './championship.ts'

type Room = RoomState<Championship>

let intents = 0
const member = (id: string) => ({playerId: id, peerId: id})
const act = (room: Room, player: string, move: Move) => applyIntent(calisthenics, room, player, {type: 'move', move, id: ++intents})
const roomOf = (players: string[]) =>
  players.slice(1).reduce((room, id) => joinPlayer(room, member(id)), createRoomState(calisthenics, member(players[0] ?? 'a')))
const named = (players: string[]) => players.reduce((room, id) => act(room, id, {type: 'profile', profile: {name: id}}), roomOf(players))
const announcedRoom = (players = ['a', 'b']) => act(named(players), 'a', {type: 'start'})
const startedRoom = (players = ['a', 'b']) => act(announcedRoom(players), 'a', {type: 'train'})
const confirmed = (room: Room, plans: Record<string, Plan> = {}) =>
  ['a', 'b'].reduce((each, id) => act(each, id, {type: 'confirm', plan: plans[id] ?? rests}), room)
const away = (room: Room, player: string) =>
  syncPresence(calisthenics, room, {...room, reservations: {...room.reservations, [player]: 120_000}})
const back = (room: Room, player: string) => {
  const {[player]: _, ...reservations} = room.reservations
  return syncPresence(calisthenics, room, {...room, reservations})
}
const performing = (room: Room, plans: Record<string, Plan> = {}) => act(confirmed(room, plans), 'a', {type: 'perform'})
const performed = (room: Room, plans: Record<string, Plan> = {}) => {
  const next = performing(room, plans)
  return {...next, game: finishPerformances(next.game)}
}
const nameOf = (room: Room, player: string) => room.game.profiles[seatOf(room, player) ?? '']?.name

describe('3-match', () => {
  it('3-1 seats 12 players', () => {
    const players = Array.from({length: 13}, (_, index) => `p${index}`)
    const room = roomOf(players)

    assert.equal(calisthenics.seats.length, 12)
    assert.equal(seatOf(room, 'p11'), '12')
    assert.equal(seatOf(room, 'p12'), null)
  })

  it('3-1 takes names of 1 to 20 characters after trimming spaces, and repeated names', () => {
    const room = roomOf(['a', 'b'])
    const name = (each: Room, player: string, text: string) => act(each, player, {type: 'profile', profile: {name: text}})

    assert.equal(nameOf(name(room, 'a', '  Ann  '), 'a'), 'Ann')
    assert.equal(nameOf(name(room, 'a', '   '), 'a'), undefined)
    assert.equal(nameOf(name(room, 'a', ''), 'a'), undefined)
    assert.equal(nameOf(name(room, 'a', 'x'.repeat(20)), 'a'), 'x'.repeat(20))
    assert.equal(nameOf(name(room, 'a', 'x'.repeat(21)), 'a'), undefined)

    const twins = name(name(room, 'a', 'Sam'), 'b', 'Sam')

    assert.equal(nameOf(twins, 'b'), 'Sam')
  })

  it('3-2 lets the host start when 2 to 12 seated players have names', () => {
    assert.equal(act(named(['a']), 'a', {type: 'start'}).game.stage, 'lobby')
    assert.equal(act(act(roomOf(['a', 'b']), 'a', {type: 'profile', profile: {name: 'a'}}), 'a', {type: 'start'}).game.stage, 'lobby')
    assert.equal(act(named(['a', 'b']), 'b', {type: 'start'}).game.stage, 'lobby')

    const twelve = Array.from({length: 12}, (_, index) => `p${index}`)
    const full = act(named(twelve), 'p0', {type: 'start'}).game

    assert.equal(full.athletes.length, 12)
  })

  it('3-2 gives each seated player an athlete, the host included, and opens the first announcement', () => {
    const {game} = announcedRoom()

    assert.equal(game.stage, 'announcement')
    assert.equal(game.challenge, 0)
    assert.deepEqual(
      game.athletes.map(athlete => [athlete.seat, athlete.profile.name]),
      [
        ['1', 'a'],
        ['2', 'b']
      ]
    )
  })

  it('3-2 adds no athletes later and lets a player without one only watch', () => {
    const room = joinPlayer(startedRoom(), member('c'))
    const attempt = act(room, 'c', {type: 'confirm', plan: rests})

    assert.equal(seatOf(room, 'c'), '3')
    assert.equal(attempt.game.athletes.length, 2)
    assert.deepEqual(attempt.game, room.game)
  })

  it('3-3 announces only the challenge number and name, and lets the host open preparation', () => {
    const room = announcedRoom()

    assert.deepEqual(announcementOf(room.game), {number: 1, total: 10, name: 'Push-ups'})
    assert.deepEqual(act(room, 'a', {type: 'confirm', plan: rests}).game, room.game)
    assert.equal(act(room, 'b', {type: 'train'}).game.stage, 'announcement')
    assert.equal(act(room, 'a', {type: 'train'}).game.stage, 'preparation')
  })

  it('3-3 lets the host start the challenge once every plan is confirmed', () => {
    const room = startedRoom()
    const half = act(room, 'a', {type: 'confirm', plan: rests})

    assert.equal(act(half, 'a', {type: 'perform'}).game.stage, 'preparation')
    assert.equal(act(confirmed(room), 'b', {type: 'perform'}).game.stage, 'preparation')
    assert.equal(act(confirmed(room), 'a', {type: 'perform'}).game.stage, 'results')
  })

  it('3-3 shows what each plan trained, the score and its reason, then lets the host announce the next challenge', () => {
    const results = performed(startedRoom(), {a: plan({arms: 1, chest: 1}, 1)})

    assert.deepEqual(
      resultsOf(results.game).map(row => [row.seat, row.trained, row.score, row.completion, row.short]),
      [
        ['1', {arms: 1, chest: 1}, 66, 'partial', ['stamina']],
        ['2', {}, 0, 'none', ['arms', 'chest', 'stamina']]
      ]
    )
    assert.deepEqual(
      standingsOf(performed(startedRoom(), {b: plan({arms: 1, chest: 1, stamina: 1})}).game).map(row => [row.seat, row.points]),
      [
        ['2', 100],
        ['1', 0]
      ]
    )
    assert.equal(act(results, 'b', {type: 'next'}).game.stage, 'results')

    const next = act(results, 'a', {type: 'next'}).game

    assert.equal(next.stage, 'announcement')
    assert.deepEqual(announcementOf(next), {number: 2, total: 10, name: 'Squats'})
    assert.ok(next.athletes.every(athlete => athlete.plan === null && athlete.result === null))
  })

  it('3-3 ends the championship after the tenth challenge and starts no new one', () => {
    const last = Array.from({length: 10}, (_, index) => index).reduce((room, index) => {
      const announced = index === 0 ? room : act(room, 'a', {type: 'next'})
      return performed(act(announced, 'a', {type: 'train'}), {a: perfectPlans[index] ?? rests})
    }, announcedRoom())

    assert.equal(isFinished(last.game), true)
    assert.deepEqual(act(last, 'a', {type: 'next'}).game, last.game)

    const full = Array.from({length: 10}, (_, index) => `x${index}`).reduce((room, id) => joinPlayer(room, member(id)), last)

    assert.deepEqual(applyIntent(calisthenics, full, 'a', {type: 'restart', id: ++intents}).game, last.game)
  })

  it('3-4 holds every screen while an athlete player is absent, and moves on when they are back', () => {
    const steps: [Room, Move, string][] = [
      [announcedRoom(), {type: 'train'}, 'preparation'],
      [confirmed(startedRoom()), {type: 'perform'}, 'results'],
      [performed(startedRoom()), {type: 'next'}, 'announcement']
    ]

    for (const [room, move, after] of steps) {
      const missing = away(room, 'b')

      assert.equal(act(missing, 'a', move).game.stage, room.game.stage)
      assert.equal(act(back(missing, 'b'), 'a', move).game.stage, after)
    }
  })

  it('3-4 keeps the championship paused for good once an athlete player has left, even if they join again', () => {
    const left = dropPlayer(calisthenics, startedRoom(), 'b')
    const rejoined = joinPlayer(left, member('b'))
    const attempt = act(act(rejoined, 'b', {type: 'confirm', plan: rests}), 'a', {type: 'confirm', plan: rests})

    assert.equal(seatOf(rejoined, 'b'), '2')
    assert.equal(attempt.game.athletes[1]?.left, true)
    assert.equal(attempt.game.athletes[1]?.plan, null)
    assert.equal(act(attempt, 'a', {type: 'perform'}).game.stage, 'preparation')
  })

  it('3-5 gives each athlete twelve seconds, reveals one result at a time and waits for all turns before showing standings', () => {
    const first = performing(startedRoom(), {a: plan({arms: 1, chest: 1, stamina: 1})})
    const key = performanceKey(first.game)
    const tick = (game: Championship, deadline: string, now: number) =>
      calisthenics.onDeadline!(game, deadline, {occupiedSeats: ['1', '2'], absentSeats: [], now})
    assert.equal(first.game.performance?.index, 0)
    assert.deepEqual(resultsOf(first.game), [])
    assert.deepEqual(standingsOf(first.game), [])
    assert.deepEqual(act(first, 'a', {type: 'next'}).game, first.game)
    assert.equal(tick(first.game, key, 11999), first.game)
    const second = tick(first.game, key, 12000)
    assert.equal(second.performance?.index, 1)
    assert.equal(second.performance?.endsAt, 24000)
    assert.deepEqual(
      resultsOf(second).map(r => [r.profile.name, r.score]),
      [['a', 100]]
    )
    assert.deepEqual(standingsOf(second), [])
    assert.equal(tick(second, key, 24000), second, 'an old deadline cannot skip the next athlete')
    const done = tick(second, performanceKey(second), 24000)
    assert.equal(done.performance, null)
    assert.equal(resultsOf(done).length, 2)
    assert.equal(standingsOf(done).length, 2)
    assert.equal(act({...first, game: done}, 'a', {type: 'next'}).game.stage, 'announcement')
    assert.deepEqual(done.athletes, first.game.athletes, 'playback never applies the plans or points a second time')
  })

  it('3-5 lets only the host end a particular turn early and preserves the queue when a player reconnects', () => {
    const first = performing(startedRoom())
    const move: Move = {type: 'next-athlete', challenge: 0, index: 0}
    assert.deepEqual(act(first, 'b', move).game, first.game)
    const next = act(first, 'a', move)
    assert.equal(next.game.performance?.index, 1)
    assert.deepEqual(act(next, 'a', move).game, next.game)
    assert.deepEqual(act(next, 'a', {...move, challenge: 1}).game, next.game)
    const reloaded = joinPlayer(next, {playerId: 'b', peerId: 'b-text'})
    assert.deepEqual(reloaded.game.performance, next.game.performance)
    assert.deepEqual(reloaded.game.athletes, next.game.athletes)
  })

  it('3-5 shows all twelve athletes in seat order before the final championship result', () => {
    let state = {...performingState(started(12)), challenge: 9}
    const athletes = state.athletes
    for (let index = 0; index < 12; index++) {
      assert.equal(isFinished(state), false)
      assert.equal(state.athletes[state.performance!.index]!.seat, `${index + 1}`)
      assert.equal(resultsOf(state).length, index)
      state = calisthenics.onDeadline!(state, performanceKey(state), {...contextOf(12), now: state.performance!.endsAt!})
    }
    assert.equal(isFinished(state), true)
    assert.equal(resultsOf(state).length, 12)
    assert.deepEqual(state.athletes, athletes)
  })

  it('3-4 pauses the current turn with its remaining time and resumes only when every athlete is back', () => {
    const room = performing(startedRoom())
    const missing = syncPresence(calisthenics, room, {...room, reservations: {b: 120000}}, 2300)
    assert.equal(missing.game.performance?.endsAt, null)
    assert.equal(missing.game.performance?.remainingMs, 9700)
    assert.deepEqual(calisthenics.deadlinesOf!(missing.game), {})
    assert.deepEqual(act(missing, 'a', {type: 'next-athlete', challenge: 0, index: 0}).game, missing.game)
    const returned = syncPresence(calisthenics, missing, {...missing, reservations: {}}, 30000)
    assert.equal(returned.game.performance?.endsAt, 39700)
    const left = dropPlayer(calisthenics, room, 'b', 2300)
    assert.equal(left.game.performance?.endsAt, null)
    assert.equal(joinPlayer(left, member('b')).game.performance?.endsAt, null)
  })
})
