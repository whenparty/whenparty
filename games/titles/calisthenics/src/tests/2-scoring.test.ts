import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {challenges, resultsOf, winnersOf, type Levels} from '../engine/index.ts'
import {perfectPlans, perform, playAll, rests, started, withAthlete} from './championship.ts'

const levels = (some: Partial<Levels>): Levels => ({arms: 0, chest: 0, back: 0, legs: 0, abs: 0, balance: 0, stamina: 0, ...some})

const resultAt = (some: Partial<Levels>, challenge = 0) => {
  const state = withAthlete({...started(), challenge}, '1', {levels: levels(some)})
  return resultsOf(perform(state)).find(row => row.seat === '1')!
}

describe('2-scoring', () => {
  it('2-1 runs ten challenges in order with their required levels', () => {
    assert.deepEqual(challenges, [
      {name: 'Push-ups', requires: {arms: 1, chest: 1, stamina: 1}},
      {name: 'Squats', requires: {legs: 1, stamina: 1}},
      {name: 'Pull-ups', requires: {arms: 1, back: 1, stamina: 1}},
      {name: 'L-sit', requires: {arms: 1, abs: 1, stamina: 1}},
      {name: 'Pistol squat', requires: {legs: 2, balance: 1, stamina: 1}},
      {name: 'Handstand', requires: {arms: 2, abs: 1, balance: 2, stamina: 1}},
      {name: 'Muscle-up', requires: {arms: 2, back: 2, abs: 2, balance: 2, stamina: 1}},
      {name: 'Burpees', requires: {arms: 2, chest: 2, legs: 2, stamina: 2}},
      {name: 'Front lever', requires: {back: 3, abs: 3, balance: 2, stamina: 2}},
      {name: 'Human flag', requires: {arms: 3, back: 3, abs: 3, balance: 2, stamina: 2}}
    ])
  })

  it('2-2 scores the share of required levels reached, rounded down', () => {
    assert.equal(resultAt({arms: 2, chest: 1}).score, 66)
    assert.equal(resultAt({arms: 1, chest: 1, stamina: 1}).score, 100)
    assert.equal(resultAt({arms: 10, chest: 10, stamina: 10}).score, 100)
    assert.equal(resultAt({}).score, 0)
    assert.equal(resultAt({arms: 3, back: 3, abs: 3, balance: 2, stamina: 1}, 9).score, 92)
  })

  it('2-2 names full completion at 100, partial at 1 to 99 and not performed at 0', () => {
    assert.equal(resultAt({arms: 1, chest: 1, stamina: 1}).completion, 'full')
    assert.equal(resultAt({arms: 3, back: 3, abs: 3, balance: 2, stamina: 1}, 9).completion, 'partial')
    assert.equal(resultAt({balance: 1}, 9).completion, 'partial')
    assert.equal(resultAt({balance: 1}, 9).score, 7)
    assert.equal(resultAt({}).completion, 'none')
  })

  it('2-3 gives the characteristics below their required level as the reason', () => {
    assert.deepEqual(resultAt({arms: 2, chest: 1}).short, ['stamina'])
    assert.deepEqual(resultAt({}).short, ['arms', 'chest', 'stamina'])
    assert.deepEqual(resultAt({arms: 1, chest: 1, stamina: 1}).short, [])
  })

  it('2-4 sums the ten scores and lets the athletes with the most points win together', () => {
    const perfect = (index: number) => perfectPlans[index] ?? rests
    const alone = playAll(started(), index => ({'1': perfect(index)}))

    assert.deepEqual(
      alone.athletes.map(athlete => athlete.points),
      [1000, 0]
    )
    assert.deepEqual(
      winnersOf(alone).map(athlete => athlete.seat),
      ['1']
    )

    const together = playAll(started(), index => ({'1': perfect(index), '2': perfect(index)}))

    assert.deepEqual(
      winnersOf(together).map(athlete => athlete.seat),
      ['1', '2']
    )
  })
})
