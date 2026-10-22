import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {test} from 'node:test'
import {SkinnedMesh, Vector3} from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {AthleteModel} from '../3d/athlete.ts'
import {barHeight} from '../3d/exercises.ts'
import {demonstrationMotion, performanceMotion} from '../3d/presentation.ts'
import {startingCondition, type Completion} from '../engine/index.ts'

const bytes = new Uint8Array(await readFile(new URL('../../public/assets/athlete.glb', import.meta.url)))
const source = await new GLTFLoader().parseAsync(bytes.buffer, '')
const point = (athlete: AthleteModel, name: string) => {
  athlete.group.updateMatrixWorld(true)
  return athlete.model.getObjectByName(name)!.getWorldPosition(new Vector3())
}
const attemptLength = (completion: Completion, challenge: number) =>
  performanceMotion(completion, challenge)
    .slice(0, -1)
    .reduce((sum, motion) => sum + motion.seconds, 0)

test('raised legs bend at the knee towards the front of the thigh in the L-sit and pistol squat', () => {
  const athlete = new AthleteModel(source.scene, source.animations)
  try {
    for (const bodyType of ['male', 'female'] as const)
      for (const level of [0, 10]) {
        athlete.update({name: 'Athlete', appearance: {bodyType}}, {...startingCondition().levels, arms: level, legs: level})
        for (const challenge of [3, 4])
          for (const completion of ['full', 'partial', 'none'] as const)
            for (let frame = 0; frame <= 24; frame++) {
              athlete.play(performanceMotion(completion, challenge), false, (attemptLength(completion, challenge) * frame) / 24, true)
              for (const suffix of ['l', 'r']) {
                const hip = point(athlete, `thigh_${suffix}`),
                  knee = point(athlete, `calf_${suffix}`),
                  foot = point(athlete, `foot_${suffix}`),
                  flexion = knee.clone().sub(hip).cross(foot.clone().sub(knee)).x
                assert.ok(
                  flexion >= -0.00001,
                  `${bodyType} level ${level}, challenge ${challenge}, ${completion}, frame ${frame}: knee ${suffix} bends backwards`
                )
              }
            }
      }
  } finally {
    athlete.dispose()
  }
})

test('every new attempt stays above the floor with both body types and extreme muscle levels', () => {
  const athlete = new AthleteModel(source.scene, source.animations)
  try {
    for (const bodyType of ['male', 'female'] as const)
      for (const level of [0, 10]) {
        athlete.update({name: 'Athlete', appearance: {bodyType}}, {...startingCondition().levels, arms: level, legs: level})
        for (let challenge = 1; challenge < 10; challenge++)
          for (const completion of ['full', 'partial', 'none'] as const) {
            const duration = attemptLength(completion, challenge)
            for (let frame = 0; frame <= 48; frame++) {
              athlete.play(performanceMotion(completion, challenge), false, (duration * frame) / 48, true)
              athlete.model.traverse(object => {
                if (!(object instanceof SkinnedMesh)) return
                const p = new Vector3()
                for (let vertex = 0; vertex < object.geometry.getAttribute('position').count; vertex++) {
                  object.getVertexPosition(vertex, p)
                  assert.ok(p.toArray().every(Number.isFinite))
                  assert.ok(
                    p.y >= -0.005,
                    `${bodyType} level ${level}, challenge ${challenge}, ${completion}, frame ${frame}: vertex below floor at ${p.y}`
                  )
                }
              })
            }
          }
      }
  } finally {
    athlete.dispose()
  }
})

test('full poses reach the exercise while partial and failed attempts have less range', () => {
  const athlete = new AthleteModel(source.scene, source.animations)
  try {
    athlete.update({name: 'Athlete'}, startingCondition().levels)
    const at = (challenge: number, completion: Completion = 'full') =>
      athlete.play(
        performanceMotion(completion, challenge),
        false,
        completion === 'full' ? ([3, 5, 8, 9].includes(challenge) ? 2 : challenge === 7 ? 0.72 : 0.9) : 0.9,
        true
      )
    at(1)
    assert.ok(point(athlete, 'pelvis').y < 0.6)
    at(2)
    assert.ok(point(athlete, 'head').y > barHeight + 0.15)
    at(3)
    assert.ok(point(athlete, 'foot_l').y > 0.5)
    at(4)
    assert.ok(point(athlete, 'foot_r').y > 0.4)
    at(5)
    assert.ok(point(athlete, 'foot_l').y > point(athlete, 'head').y + 1)
    at(6)
    assert.ok(point(athlete, 'upperarm_l').y > barHeight + 0.5)
    at(7)
    assert.ok(point(athlete, 'head').y < 0.5)
    at(8)
    assert.ok(Math.abs(point(athlete, 'head').y - point(athlete, 'pelvis').y) < 0.12)
    at(9)
    assert.ok(Math.abs(point(athlete, 'foot_l').y - point(athlete, 'head').y) < 0.12)
    for (const challenge of [2, 5, 6, 9]) {
      const heights = (['full', 'partial', 'none'] as const).map(completion => {
        at(challenge, completion)
        return point(athlete, challenge === 2 || challenge === 6 ? 'pelvis' : 'foot_l').y
      })
      assert.ok(heights[0]! > heights[1]! + 0.1 && heights[1]! > heights[2]! + 0.1)
    }
    athlete.play(demonstrationMotion(9), true)
    const still = point(athlete, 'pelvis')
    athlete.tick(30)
    assert.ok(point(athlete, 'pelvis').distanceTo(still) < 1e-6)
  } finally {
    athlete.dispose()
  }
})

test('each full set visibly performs five repetitions and every static exercise keeps its hold steady', () => {
  const athlete = new AthleteModel(source.scene, source.animations)
  try {
    athlete.update({name: 'Athlete'}, startingCondition().levels)
    for (const [challenge, bone, sign] of [
      [0, 'head', -1],
      [1, 'pelvis', -1],
      [2, 'head', 1],
      [4, 'pelvis', -1],
      [6, 'head', 1],
      [7, 'head', -1]
    ] as const) {
      const height = (time: number) => {
        athlete.play(performanceMotion('full', challenge), false, time, true)
        return point(athlete, bone).y
      }
      for (let rep = 0; rep < 5; rep++) {
        const start = height(rep * 1.8 + 0.01),
          peak = height(rep * 1.8 + 0.9),
          end = height(rep * 1.8 + 1.79)
        assert.ok(sign * (peak - start) > 0.1, `challenge ${challenge}, rep ${rep + 1}: the repetition must reach its peak`)
        assert.ok(Math.abs(end - start) < 0.04, `challenge ${challenge}, rep ${rep + 1}: the repetition must return to its start`)
      }
    }
    for (const challenge of [3, 5, 8, 9]) {
      athlete.play(performanceMotion('full', challenge), false, 1.1, true)
      const held = point(athlete, 'pelvis')
      for (const time of [3, 5, 8.9]) {
        athlete.play(performanceMotion('full', challenge), false, time, true)
        assert.ok(point(athlete, 'pelvis').distanceTo(held) < 1e-6)
      }
    }
  } finally {
    athlete.dispose()
  }
})

test('the head and torso clear the horizontal bar throughout the pull-up and muscle-up', () => {
  const athlete = new AthleteModel(source.scene, source.animations)
  try {
    athlete.update({name: 'Athlete', appearance: {bodyType: 'female'}}, {...startingCondition().levels, arms: 10, legs: 10})
    for (const challenge of [2, 6])
      for (let frame = 0; frame <= 32; frame++) {
        athlete.play(performanceMotion('full', challenge), false, frame / 10, true)
        athlete.model.traverse(object => {
          if (!(object instanceof SkinnedMesh)) return
          const skin = object.geometry.getAttribute('skinIndex'),
            weights = object.geometry.getAttribute('skinWeight'),
            p = new Vector3()
          for (let vertex = 0; vertex < skin.count; vertex++) {
            let dominant = 0
            for (let k = 1; k < 4; k++) if (weights.getComponent(vertex, k) > weights.getComponent(vertex, dominant)) dominant = k
            const name = object.skeleton.bones[skin.getComponent(vertex, dominant)]!.name
            if (!/^(head|neck|spine|pelvis)/.test(name)) continue
            object.getVertexPosition(vertex, p)
            assert.ok(
              Math.hypot(p.y - barHeight, p.z - 0.12) > 0.025,
              `challenge ${challenge}: the bar intersects ${name} at ${frame / 10}s`
            )
          }
        })
      }
  } finally {
    athlete.dispose()
  }
})
