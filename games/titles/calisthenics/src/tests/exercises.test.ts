import assert from 'node:assert/strict'
import {test} from 'node:test'
import {startingCondition} from '../core/index.ts'
import {performanceMotion} from '../frontends/3d/presentation.ts'
import {attemptLength, bodyTypes, completions, extremeLevels, positionOf, withAthleteModel} from './athlete-fixtures.ts'

test('raised legs bend at the knee towards the front of the thigh in the L-sit and pistol squat', () =>
  withAthleteModel(athlete => {
    for (const bodyType of bodyTypes)
      for (const level of extremeLevels) {
        athlete.update({name: 'Athlete', appearance: {bodyType}}, {...startingCondition().levels, arms: level, legs: level})
        for (const challenge of [3, 4])
          for (const completion of completions)
            for (let frame = 0; frame <= 24; frame++) {
              athlete.play(performanceMotion(completion, challenge), false, (attemptLength(completion, challenge) * frame) / 24, true)
              for (const suffix of ['l', 'r']) {
                const hip = positionOf(athlete, `thigh_${suffix}`),
                  knee = positionOf(athlete, `calf_${suffix}`),
                  foot = positionOf(athlete, `foot_${suffix}`),
                  flexion = knee.clone().sub(hip).cross(foot.clone().sub(knee)).x
                assert.ok(
                  flexion >= -0.00001,
                  `${bodyType} level ${level}, challenge ${challenge}, ${completion}, frame ${frame}: knee ${suffix} bends backwards`
                )
              }
            }
      }
  }))
