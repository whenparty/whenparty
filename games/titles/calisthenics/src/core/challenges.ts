// The championship's challenges and how a performance scores
import {characteristics, type Characteristic, type Counts, type Levels} from './athlete.ts'

export interface Challenge {
  name: string
  requires: Counts
}

export type Completion = 'full' | 'partial' | 'none'

export const challenges: readonly Challenge[] = [
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
]

export const maxScore = 100

const requiredOf = (challenge: Challenge) => characteristics.filter(each => challenge.requires[each])

export const scoreOf = (levels: Levels, challenge: Challenge) => {
  const required = requiredOf(challenge)
  const need = required.reduce((total, each) => total + (challenge.requires[each] ?? 0), 0)
  const got = required.reduce((total, each) => total + Math.min(levels[each], challenge.requires[each] ?? 0), 0)
  return Math.floor((maxScore * got) / need)
}

export const shortOf = (levels: Levels, challenge: Challenge): Characteristic[] =>
  requiredOf(challenge).filter(each => levels[each] < (challenge.requires[each] ?? 0))

export const completionOf = (score: number): Completion => (score === maxScore ? 'full' : score > 0 ? 'partial' : 'none')
