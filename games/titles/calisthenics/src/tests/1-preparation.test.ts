import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {applyIntent, createRoomState, joinPlayer, type RoomState} from '@whenparty/p2p'
import {athletesOf, calisthenics, emptyPlan, previewOf, type Championship, type Move, type Plan} from '../engine/index.ts'
import {must, move, perform, plan, prepare, rests, started, withAthlete} from './championship.ts'

const athlete = (state: Championship, seat = '1') => state.athletes.find(each => each.seat === seat)!

const confirm = (state: Championship, next: Plan, seat = '1') => move(state, seat, {type: 'confirm', plan: next})

const afterPlan = (energy: number, next: Plan) => athlete(perform(withAthlete(started(), '1', {energy}), {'1': next}))

describe('1-preparation', () => {
  it('1-1 starts every characteristic at level 0, energy at 100 and points at 0', () => {
    for (const each of started().athletes) {
      assert.deepEqual(each.levels, {arms: 0, chest: 0, back: 0, legs: 0, abs: 0, balance: 0, stamina: 0})
      assert.equal(each.energy, 100)
      assert.equal(each.points, 0)
    }
  })

  it('1-2 1-3 trains the same characteristic up to three times in one plan', () => {
    assert.equal(afterPlan(100, plan({arms: 3})).levels.arms, 3)
  })

  it('1-3 pays trainings from the energy before the plan and adds rests after them, up to 100', () => {
    assert.equal(afterPlan(50, plan({arms: 1, legs: 1}, 1)).energy, 50)
    assert.equal(afterPlan(100, plan({arms: 1, legs: 1}, 1)).energy, 100)
    assert.equal(afterPlan(25, plan({arms: 1}, 2)).energy, 100)
    assert.equal(afterPlan(75, plan({arms: 3})).energy, 0)
    assert.equal(afterPlan(0, rests).energy, 100)
  })

  it('1-4 confirms only three actions', () => {
    const state = started()

    assert.equal(confirm(state, plan({arms: 1}, 1)), null)
    assert.equal(confirm(state, plan({arms: 2}, 2)), null)
    assert.ok(confirm(state, plan({arms: 2}, 1)))
  })

  it('1-4 confirms only trainings the energy before the plan pays for', () => {
    const at = (energy: number) => withAthlete(started(), '1', {energy})

    assert.equal(confirm(at(25), plan({arms: 2}, 1)), null)
    assert.ok(confirm(at(25), plan({arms: 1}, 2)))
    assert.ok(confirm(at(50), plan({arms: 2}, 1)))
    assert.equal(confirm(at(50), plan({arms: 3})), null)
    assert.ok(confirm(at(0), rests))
  })

  it('1-4 confirms no level above 10', () => {
    const state = started()
    const at = (arms: number) => withAthlete(state, '1', {levels: {...athlete(state).levels, arms}})

    assert.ok(confirm(at(9), plan({arms: 1}, 2)))
    assert.equal(confirm(at(9), plan({arms: 2}, 1)), null)
    assert.equal(confirm(at(10), plan({arms: 1}, 2)), null)
  })

  it('1-5 previews the challenge name, levels, energy and energy after the plan, without requirements', () => {
    const state = withAthlete(started(), '1', {energy: 50})
    const preview = previewOf(state, athlete(state), plan({arms: 1, legs: 1}, 1))

    assert.deepEqual(preview, {
      challenge: 'Push-ups',
      levels: athlete(state).levels,
      energy: 50,
      energyAfter: 50,
      actions: 3,
      problem: null
    })
  })

  it('1-6 keeps a confirmed plan and applies it once', () => {
    const confirmed = must(confirm(started(), plan({arms: 1}, 2)))

    assert.equal(confirm(confirmed, plan({chest: 1}, 2)), null)

    const performed = perform(confirmed)

    assert.equal(athlete(performed).levels.arms, 1)
    assert.equal(move(performed, '1', {type: 'perform'}), null)
    assert.equal(athlete(prepare(performed)).levels.arms, 1)
  })

  it('1-6 applies a confirmed plan once after its player reloads the page', () => {
    const member = (id: string, peer = id) => ({playerId: id, peerId: peer})
    const act = (room: RoomState<Championship>, player: string, next: Move, id: number) =>
      applyIntent(calisthenics, room, player, {type: 'move', move: next, id})
    const lobby = ['a', 'b'].reduce(
      (room, id, index) => act(room, id, {type: 'profile', profile: {name: id}}, index + 1),
      joinPlayer(createRoomState(calisthenics, member('a')), member('b'))
    )
    const training = act(act(lobby, 'a', {type: 'start'}, 3), 'a', {type: 'train'}, 4)
    const confirmedRoom = act(act(training, 'a', {type: 'confirm', plan: plan({arms: 1}, 2)}, 5), 'b', {type: 'confirm', plan: rests}, 6)
    const reloaded = joinPlayer(confirmedRoom, member('a', 'a2'))
    const performed = act(act(reloaded, 'a', {type: 'confirm', plan: plan({arms: 1}, 2)}, 7), 'a', {type: 'perform'}, 8)

    assert.equal(athlete(performed.game).levels.arms, 1)
    assert.equal(performed.game.stage, 'results')
  })

  it('1-7 keeps no plan in the room until it is confirmed', () => {
    assert.equal(athlete(started()).plan, null)
    assert.deepEqual(emptyPlan(), {training: {}, rest: 0})
  })

  it('1-8 carries levels and energy over to the next challenge unchanged', () => {
    const performed = perform(started(), {'1': plan({arms: 3})})
    const next = prepare(performed)

    assert.deepEqual(athlete(next).levels, athlete(performed).levels)
    assert.equal(athlete(next).energy, 25)
    assert.deepEqual(athlete(perform(next)).levels, athlete(performed).levels)
  })

  it('1-9 shows every athlete levels, energy and confirmation, but no plans', () => {
    const rows = athletesOf(must(confirm(started(), plan({arms: 1}, 2))))

    assert.deepEqual(
      rows.map(row => [row.seat, row.energy, row.levels.arms, row.confirmed]),
      [
        ['1', 100, 0, true],
        ['2', 100, 0, false]
      ]
    )
    assert.ok(rows.every(row => !('plan' in row)))
  })
})
