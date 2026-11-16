import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {SkinnedMesh, Vector3} from 'three'
import {challenges, effortOf, movementOf, startingCondition, type Apparatus, type Completion} from '../core/index.ts'
import type {AthleteModel} from '../frontends/3d/athlete-model.ts'
import {barDepth, barHeight, handleHeight, handleSpread, ladderGrips, ladderX} from '../frontends/3d/exercises.ts'
import {demonstrationMotion, effortProgress, motionAt, performanceMotion} from '../frontends/3d/presentation.ts'
import {attemptLength, bodyTypes, completions, extremeLevels, positionOf, withAthleteModel} from './athlete-fixtures.ts'

const reactions = {full: 'Victory Fist Pump', partial: 'Kneeling Tired', none: 'Confused'} as const

const challengeNamed = (name: string) => challenges.findIndex(challenge => challenge.name === name)

const forEachBody = (athlete: AthleteModel, check: (body: string) => void) => {
  for (const bodyType of bodyTypes)
    for (const level of extremeLevels) {
      athlete.update({name: 'Athlete', appearance: {bodyType}}, {...startingCondition().levels, arms: level, legs: level})
      check(`${bodyType} level ${level}`)
    }
}

interface Contact {
  challenge: number
  bone: string
  slip: (position: Vector3) => number
  completions: readonly Completion[]
  times: (completion: Completion, challenge: number) => number[]
}

const acrossAttempt = (completion: Completion, challenge: number) =>
  [0.05, 0.3, 0.5, 0.75].map(fraction => fraction * attemptLength(completion, challenge))

const inBurpeePlank = (completion: Completion) =>
  completion === 'full' ? [0, 1, 2, 3, 4].flatMap(repetition => [0.6, 0.72, 0.84].map(time => repetition * 1.8 + time)) : [0.75, 0.9, 1]

const at = (
  challenge: number,
  bone: string,
  support: Vector3,
  times = acrossAttempt,
  only: readonly Completion[] = completions
): Contact => ({
  challenge,
  bone,
  slip: position => position.distanceTo(support),
  completions: only,
  times
})

const planted = (
  challenge: number,
  limb: 'hand' | 'foot',
  [x, y, z]: [number, number, number],
  times = acrossAttempt,
  only: readonly Completion[] = completions
) => [at(challenge, `${limb}_l`, new Vector3(x, y, z), times, only), at(challenge, `${limb}_r`, new Vector3(-x, y, z), times, only)]

const onBar = (side: 'l' | 'r', x: number): Contact => ({
  challenge: challengeNamed('Muscle-up'),
  bone: `hand_${side}`,
  slip: position => Math.hypot(position.x - x, Math.max(0, Math.hypot(position.y - barHeight, position.z - barDepth) - 0.11)),
  completions,
  times: acrossAttempt
})

const onFloor = (side: 'l' | 'r', height: number): Contact => ({
  challenge: challengeNamed('Burpees'),
  bone: `foot_${side}`,
  slip: position => Math.abs(position.y - height),
  completions: ['full', 'partial'],
  times: inBurpeePlank
})

describe('5-movements', () => {
  it('5-1 plays distinct push-up outcomes, the same each time', () => {
    for (const completion of completions) {
      const sequence = performanceMotion(completion, 0)
      assert.deepEqual(performanceMotion(completion, 0), sequence)
      assert.equal(motionAt(sequence, 0).motion.clip, completion === 'full' ? 'Pushup' : 'Pushup Failed')
      assert.equal(motionAt(sequence, 10.1).motion.clip, reactions[completion])
    }
  })

  it('5-1 5-2 demonstrates every challenge and gives each of the other nine its own attempt before reacting', () => {
    const clips = new Set<string>()
    for (let challenge = 0; challenge < 10; challenge++) {
      const demo = demonstrationMotion(challenge)[0]!
      assert.ok(demo.loop)
      clips.add(demo.clip)
      for (const completion of completions) {
        const sequence = performanceMotion(completion, challenge)
        assert.ok(attemptLength(completion, challenge) <= 10)
        assert.equal(motionAt(sequence, 10.1).motion.clip, reactions[completion])
        if (challenge > 0) {
          assert.equal(sequence[0]!.exercise!.challenge, challenge)
          assert.equal(sequence[0]!.exercise!.completion, completion)
        }
      }
    }
    assert.equal(clips.size, 10)
    assert.equal(performanceMotion('full', null).length, 1)
  })

  it('5-2 performs each challenge on its apparatus and reaches the key position of its movement', () => {
    const rows: [string, Apparatus][] = [
      ['Push-ups', 'mat'],
      ['Squats', 'mat'],
      ['Pull-ups', 'bar'],
      ['L-sit', 'handles'],
      ['Pistol squat', 'mat'],
      ['Handstand', 'mat'],
      ['Muscle-up', 'bar'],
      ['Burpees', 'mat'],
      ['Front lever', 'bar'],
      ['Human flag', 'ladder']
    ]
    for (const [name, apparatus] of rows) assert.equal(movementOf(challengeNamed(name)).apparatus, apparatus, name)
    withAthleteModel(athlete => {
      athlete.update({name: 'Athlete'}, startingCondition().levels)
      const heightAt = (name: string, time: number, bone: string) => {
        athlete.play(performanceMotion('full', challengeNamed(name)), false, time, true)
        return positionOf(athlete, bone).y
      }
      assert.ok(heightAt('Squats', 0.9, 'pelvis') < 0.6)
      assert.ok(heightAt('Pull-ups', 0.9, 'head') > barHeight + 0.15)
      assert.ok(heightAt('L-sit', 2, 'foot_l') > 0.5)
      assert.ok(heightAt('Pistol squat', 0.9, 'foot_r') > 0.4)
      assert.ok(heightAt('Handstand', 2, 'foot_l') > heightAt('Handstand', 2, 'head') + 1)
      assert.ok(heightAt('Muscle-up', 0.9, 'upperarm_l') > barHeight + 0.5)
      assert.ok(heightAt('Burpees', 0.72, 'head') < 0.5)
      assert.ok(Math.abs(heightAt('Front lever', 2, 'head') - heightAt('Front lever', 2, 'pelvis')) < 0.12)
      assert.ok(Math.abs(heightAt('Human flag', 2, 'foot_l') - heightAt('Human flag', 2, 'head')) < 0.12)
    })
  })

  it('5-3 keeps grips and planted hands and feet on their supports with either body type at levels 0 and 10, including after seeking', () => {
    const contacts: Contact[] = [
      ...planted(0, 'hand', [0.335, 0.045, 0.471]),
      ...planted(0, 'foot', [0.089, 0.22, -0.856]),
      ...planted(1, 'foot', [0.19, 0.098, -0.0482]),
      at(4, 'foot_l', new Vector3(0.089, 0.098, -0.0482)),
      ...planted(2, 'hand', [0.25, barHeight - 0.11, barDepth]),
      ...planted(8, 'hand', [0.25, barHeight - 0.11, barDepth]),
      onBar('l', 0.25),
      onBar('r', -0.25),
      ...planted(3, 'hand', [handleSpread, handleHeight + 0.075, 0.08]),
      ...planted(5, 'hand', [0.2, 0.05, 0.6]),
      ...planted(7, 'hand', [0.24, 0.055, 0.3], inBurpeePlank, ['full', 'partial']),
      onFloor('l', 0.193),
      onFloor('r', 0.193),
      ...planted(7, 'foot', [0.089, 0.098, -0.0482], acrossAttempt, ['none']),
      at(9, 'hand_l', new Vector3(ladderX - 0.11, ladderGrips[0], 0)),
      at(9, 'hand_r', new Vector3(ladderX - 0.11, ladderGrips[1], 0))
    ]
    withAthleteModel(athlete =>
      forEachBody(athlete, body => {
        for (const {challenge, bone, slip, completions, times} of contacts)
          for (const completion of completions)
            for (const time of times(completion, challenge)) {
              athlete.play(performanceMotion(completion, challenge), false, time, true)
              assert.ok(
                slip(positionOf(athlete, bone)) < 0.006,
                `${body}, challenge ${challenge} ${completion}: ${bone} slipped at ${time}s`
              )
            }
      })
    )
  })

  it('5-3 keeps every attempt above the floor with either body type at levels 0 and 10', () => {
    withAthleteModel(athlete =>
      forEachBody(athlete, body => {
        for (let challenge = 0; challenge < 10; challenge++)
          for (const completion of completions) {
            const duration = attemptLength(completion, challenge)
            for (let frame = 0; frame <= 48; frame++) {
              athlete.play(performanceMotion(completion, challenge), false, (duration * frame) / 48, true)
              athlete.model.traverse(object => {
                if (!(object instanceof SkinnedMesh)) return
                const p = new Vector3()
                for (let vertex = 0; vertex < object.geometry.getAttribute('position').count; vertex++) {
                  object.getVertexPosition(vertex, p)
                  assert.ok(p.toArray().every(Number.isFinite))
                  assert.ok(p.y >= -0.005, `${body}, challenge ${challenge}, ${completion}, frame ${frame}: vertex below floor at ${p.y}`)
                }
              })
            }
          }
      })
    )
  })

  it('5-3 keeps the head and torso clear of the horizontal bar in the pull-up, muscle-up and front lever', () => {
    withAthleteModel(athlete => {
      athlete.update({name: 'Athlete', appearance: {bodyType: 'female'}}, {...startingCondition().levels, arms: 10, legs: 10})
      for (const challenge of ['Pull-ups', 'Muscle-up', 'Front lever'].map(challengeNamed))
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
              const name: string = object.skeleton.bones[skin.getComponent(vertex, dominant)]!.name
              if (!/^(head|neck|spine|pelvis)/.test(name)) continue
              object.getVertexPosition(vertex, p)
              assert.ok(
                Math.hypot(p.y - barHeight, p.z - 0.12) > 0.025,
                `challenge ${challenge}: the bar intersects ${name} at ${frame / 10}s`
              )
            }
          })
        }
    })
  })

  it('5-3 5-4 lowers a failed push-up of either body type without a repetition or a somersault', () => {
    withAthleteModel(athlete => {
      for (const bodyType of bodyTypes) {
        athlete.update({name: 'Athlete', appearance: {bodyType}}, {...startingCondition().levels, arms: 10, legs: 10})
        athlete.play(performanceMotion('none', 0), false)
        const firstHead = positionOf(athlete, 'head'),
          firstFoot = positionOf(athlete, 'foot_l')
        assert.ok(firstHead.y < 0.7, `${bodyType}: the attempt starts in a push-up position`)
        let previousHeight = firstHead.y
        for (let frame = 0; frame < 40; frame++) {
          athlete.tick(0.05)
          const head = positionOf(athlete, 'head')
          assert.ok(head.y <= previousHeight + 0.002, `${bodyType}: the failed attempt never pushes back up`)
          assert.ok(head.y > 0.08, `${bodyType}: the head stays above the floor`)
          assert.ok(positionOf(athlete, 'foot_l').distanceTo(firstFoot) < 0.01, `${bodyType}: the feet stay planted`)
          previousHeight = head.y
        }
        assert.ok(previousHeight < firstHead.y - 0.2, `${bodyType}: the athlete lowers and stays down before reacting`)
      }
    })
  })

  it('5-4 completes five repetitions or an eight-second hold and stops early according to the scoring shortfall', () => {
    const holds = ['L-sit', 'Handstand', 'Front lever', 'Human flag']
    for (const [challenge, required] of challenges.entries()) {
      const levels = {...startingCondition().levels, ...required.requires},
        full = effortOf('full', challenge, levels),
        sequence = performanceMotion('full', challenge, levels)
      assert.equal(full.kind, holds.includes(required.name) ? 'hold' : 'repetitions', required.name)
      assert.equal(full.completed, 5)
      assert.equal(
        sequence.slice(0, -1).reduce((sum, motion) => sum + motion.seconds, 0),
        10
      )
      assert.equal(motionAt(sequence, 10).motion.clip, reactions.full)
      if (full.kind === 'hold') {
        assert.deepEqual(effortProgress(full, 0), {done: 0, total: 8})
        assert.deepEqual(effortProgress(full, 5), {done: 4, total: 8})
        assert.deepEqual(effortProgress(full, 9), {done: 8, total: 8})
      } else {
        assert.deepEqual(effortProgress(full, 1.79), {done: 0, total: 5})
        assert.deepEqual(effortProgress(full, 1.8), {done: 1, total: 5})
        assert.deepEqual(effortProgress(full, 9), {done: 5, total: 5})
      }
      for (const stamina of [0, ...(required.requires.stamina === 2 ? [1] : [])]) {
        const tired = {...levels, stamina},
          effort = effortOf('partial', challenge, tired)
        assert.equal(effort.completed, stamina === 0 ? 1 : 3)
        assert.equal(effort.hold, stamina === 0 ? 1.6 : 4.8)
        assert.equal(motionAt(performanceMotion('partial', challenge, tired), 10).motion.clip, reactions.partial)
        assert.deepEqual(effortProgress(effort, 0, true), effortProgress(effort, 30, true))
        assert.equal(effortProgress(effort, 0, true).done, effort.kind === 'hold' ? effort.hold : effort.completed)
      }
      const other = Object.keys(required.requires).find(each => each !== 'stamina')!
      const weak = {...levels, [other]: 0}
      assert.equal(effortOf('partial', challenge, weak).completed, 0)
      assert.equal(effortOf('partial', challenge, {...weak, stamina: 0}).completed, 0)
      assert.equal(effortOf('none', challenge, startingCondition().levels).completed, 0)
    }
  })

  it('5-4 returns each of the five repetitions visibly to its start and holds each pose steadily', () => {
    withAthleteModel(athlete => {
      athlete.update({name: 'Athlete'}, startingCondition().levels)
      for (const [name, bone, direction] of [
        ['Push-ups', 'head', -1],
        ['Squats', 'pelvis', -1],
        ['Pull-ups', 'head', 1],
        ['Pistol squat', 'pelvis', -1],
        ['Muscle-up', 'head', 1],
        ['Burpees', 'head', -1]
      ] as const) {
        const height = (time: number) => {
          athlete.play(performanceMotion('full', challengeNamed(name)), false, time, true)
          return positionOf(athlete, bone).y
        }
        for (let repetition = 0; repetition < 5; repetition++) {
          const start = height(repetition * 1.8 + 0.01),
            peak = height(repetition * 1.8 + 0.9),
            end = height(repetition * 1.8 + 1.79)
          assert.ok(direction * (peak - start) > 0.1, `${name}, repetition ${repetition + 1}: the repetition must reach its peak`)
          assert.ok(Math.abs(end - start) < 0.04, `${name}, repetition ${repetition + 1}: the repetition must return to its start`)
        }
      }
      for (const name of ['L-sit', 'Handstand', 'Front lever', 'Human flag']) {
        athlete.play(performanceMotion('full', challengeNamed(name)), false, 1.1, true)
        const held = positionOf(athlete, 'pelvis')
        for (const time of [3, 5, 8.9]) {
          athlete.play(performanceMotion('full', challengeNamed(name)), false, time, true)
          assert.ok(positionOf(athlete, 'pelvis').distanceTo(held) < 1e-6, `${name}: the hold must stay steady at ${time}s`)
        }
      }
    })
  })

  it('5-4 stops an incomplete or not performed attempt short of the full position', () => {
    withAthleteModel(athlete => {
      athlete.update({name: 'Athlete'}, startingCondition().levels)
      for (const [name, bone, peak] of [
        ['Pull-ups', 'pelvis', 0.9],
        ['Handstand', 'foot_l', 2],
        ['Muscle-up', 'pelvis', 0.9],
        ['Human flag', 'foot_l', 2]
      ] as const) {
        const heightOf = (completion: Completion) => {
          athlete.play(performanceMotion(completion, challengeNamed(name)), false, completion === 'full' ? peak : 0.9, true)
          return positionOf(athlete, bone).y
        }
        const full = heightOf('full')
        for (const completion of ['partial', 'none'] as const)
          assert.ok(full > heightOf(completion) + 0.1, `${name}, ${completion}: the attempt reaches the full position`)
      }
    })
  })
})
