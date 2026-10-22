import {challenges, shortOf, type Completion, type Levels} from '../engine/index.ts'

export interface Motion {
  clip: string
  seconds: number
  loop?: boolean
  speed?: number
  exercise?: {challenge: number; completion: Completion; supported?: boolean}
  sample?: {from: number; to: number}
}

export const repetitions = 5
export const holdSeconds = 8
const repSeconds = 1.8
const holds = new Set([3, 5, 8, 9])

export interface Effort {
  kind: 'repetitions' | 'hold'
  completed: number
  hold: number
}

export const effortOf = (completion: Completion, challenge: number, levels?: Levels): Effort => {
  const required = challenges[challenge]!,
    ready =
      completion === 'full' ||
      (completion === 'partial' && levels !== undefined && shortOf(levels, required).every(each => each === 'stamina')),
    completed = !ready ? 0 : completion === 'full' ? repetitions : 1 + Math.floor((4 * levels!.stamina) / required.requires.stamina!)
  return {kind: holds.has(challenge) ? 'hold' : 'repetitions', completed, hold: (holdSeconds * completed) / repetitions}
}

export const effortProgress = (effort: Effort, elapsed: number, reduced = false) => {
  const done = reduced ? effort.completed : Math.min(effort.completed, Math.floor(Math.max(0, elapsed) / repSeconds))
  return effort.kind === 'hold'
    ? {done: reduced ? effort.hold : Math.min(effort.hold, Math.max(0, elapsed - 1)), total: holdSeconds}
    : {done, total: repetitions}
}

export const demonstrationMotion = (challenge: number): Motion[] =>
  challenge === 0
    ? [{clip: 'Pushup', seconds: Infinity, loop: true, speed: 0.8}]
    : [{clip: `Exercise ${challenge} full`, seconds: Infinity, loop: true, exercise: {challenge, completion: 'full'}}]

export const performanceMotion = (completion: Completion, challenge: number | null, levels?: Levels): Motion[] => {
  const reaction = completion === 'full' ? 'Victory Fist Pump' : completion === 'partial' ? 'Kneeling Tired' : 'Confused'
  if (challenge === null) return [{clip: reaction, seconds: Infinity}]
  const effort = effortOf(completion, challenge, levels),
    pose = (seconds: number, from: number, to: number, supported = true, result: Completion = 'full'): Motion => ({
      clip: `Exercise ${challenge} ${result}`,
      seconds,
      exercise: {challenge, completion: result, supported},
      sample: {from, to}
    })
  let attempt: Motion[]
  if (!effort.completed) {
    attempt = challenge === 0 ? [{clip: 'Pushup Failed', seconds: 2.2, sample: {from: 0, to: 1}}] : [pose(2.2, 0, 1, false, completion)]
  } else if (effort.kind === 'hold') {
    attempt = [pose(1, 0, 0.28), pose(effort.hold, 0.4, 0.4), pose(1, 0.62, 1, false)]
  } else if (challenge === 0) {
    attempt = [
      ...Array.from({length: effort.completed}, (): Motion => ({clip: 'Pushup', seconds: repSeconds, sample: {from: 0, to: 1}})),
      {clip: 'Idle_Subtle', seconds: 1}
    ]
  } else {
    const end = challenge === 7 ? 1 : 0.82
    attempt = [...Array.from({length: effort.completed}, () => pose(repSeconds, 0, end)), pose(1, end, 1, false)]
  }
  return [...attempt, {clip: reaction, seconds: Infinity}]
}

export const bodyVolume = (arms: number, legs: number) => ({arms: arms / 10, legs: legs / 10})

export const motionAt = (motions: Motion[], elapsed: number) => {
  let start = 0
  for (const motion of motions) {
    const end = start + motion.seconds
    if (elapsed < end) return {motion, time: elapsed - start}
    start = end
  }
  return {motion: motions[motions.length - 1]!, time: 0}
}
