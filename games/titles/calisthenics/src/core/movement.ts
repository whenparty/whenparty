// How each challenge is performed and how far an athlete gets in it
import type {Levels} from './athlete.ts'
import {challenges, shortOf, type Completion} from './challenges.ts'

export type Apparatus = 'mat' | 'bar' | 'handles' | 'ladder'
export type EffortKind = 'repetitions' | 'hold'

export interface Movement {
  apparatus: Apparatus
  kind: EffortKind
}

const movements: Record<string, Movement> = {
  'Push-ups': {apparatus: 'mat', kind: 'repetitions'},
  Squats: {apparatus: 'mat', kind: 'repetitions'},
  'Pull-ups': {apparatus: 'bar', kind: 'repetitions'},
  'L-sit': {apparatus: 'handles', kind: 'hold'},
  'Pistol squat': {apparatus: 'mat', kind: 'repetitions'},
  Handstand: {apparatus: 'mat', kind: 'hold'},
  'Muscle-up': {apparatus: 'bar', kind: 'repetitions'},
  Burpees: {apparatus: 'mat', kind: 'repetitions'},
  'Front lever': {apparatus: 'bar', kind: 'hold'},
  'Human flag': {apparatus: 'ladder', kind: 'hold'}
}

export const movementOf = (challenge: number): Movement => movements[challenges[challenge]?.name ?? ''] ?? movements['Push-ups']!

export const repetitions = 5
export const holdSeconds = 8

export interface Effort {
  kind: EffortKind
  completed: number
  hold: number
}

export const effortOf = (completion: Completion, challenge: number, levels?: Levels): Effort => {
  const required = challenges[challenge]!,
    ready =
      completion === 'full' ||
      (completion === 'partial' && levels !== undefined && shortOf(levels, required).every(each => each === 'stamina')),
    completed = !ready ? 0 : completion === 'full' ? repetitions : 1 + Math.floor((4 * levels!.stamina) / required.requires.stamina!)
  return {kind: movementOf(challenge).kind, completed, hold: (holdSeconds * completed) / repetitions}
}
