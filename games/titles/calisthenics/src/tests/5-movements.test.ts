import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {readFile} from 'node:fs/promises'
import {Vector3} from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {AthleteModel} from '../frontends/3d/athlete-model.ts'
import {barDepth, barHeight, handleHeight, handleSpread, ladderGrips, ladderX} from '../frontends/3d/exercises.ts'
import {challenges, effortOf, startingCondition} from '../core/index.ts'
import {demonstrationMotion, effortProgress, motionAt, performanceMotion} from '../frontends/3d/presentation.ts'
import {started} from './fixtures.ts'

describe('5-movements', () => {
  it('5-1 plays distinct push-up outcomes and replays without changing championship data', () => {
    const before = started(),
      saved = JSON.stringify(before)
    for (const completion of ['full', 'partial', 'none'] as const) {
      const sequence = performanceMotion(completion, 0)
      const replay = performanceMotion(completion, 0)
      assert.deepEqual(sequence, replay)
      assert.equal(motionAt(sequence, 0).motion.clip, completion === 'full' ? 'Pushup' : 'Pushup Failed')
      assert.equal(
        motionAt(sequence, 10.1).motion.clip,
        completion === 'full' ? 'Victory Fist Pump' : completion === 'partial' ? 'Kneeling Tired' : 'Confused'
      )
    }
    assert.equal(JSON.stringify(before), saved)
  })

  it('5-1 5-2 demonstrates every challenge and gives each of the other nine its own attempt before reacting', () => {
    const clips = new Set<string>()
    for (let challenge = 0; challenge < 10; challenge++) {
      const demo = demonstrationMotion(challenge)[0]!
      assert.ok(demo.loop)
      clips.add(demo.clip)
      for (const completion of ['full', 'partial', 'none'] as const) {
        const sequence = performanceMotion(completion, challenge)
        assert.ok(sequence.slice(0, -1).reduce((sum, motion) => sum + motion.seconds, 0) <= 10)
        assert.equal(
          motionAt(sequence, 10.1).motion.clip,
          completion === 'full' ? 'Victory Fist Pump' : completion === 'partial' ? 'Kneeling Tired' : 'Confused'
        )
        if (challenge > 0) {
          assert.equal(sequence[0]!.exercise!.challenge, challenge)
          assert.equal(sequence[0]!.exercise!.completion, completion)
        }
      }
    }
    assert.equal(clips.size, 10)
    assert.equal(performanceMotion('full', null).length, 1)
  })

  it('5-3 keeps grips and planted feet on their supports while the body moves, including after seeking', async () => {
    const bytes = new Uint8Array(await readFile(new URL('../frontends/3d/assets/athlete.glb', import.meta.url)))
    const source = await new GLTFLoader().parseAsync(bytes.buffer, '')
    const athlete = new AthleteModel(source.scene, source.animations)
    const point = (athlete: AthleteModel, name: string) => {
      athlete.group.updateMatrixWorld(true)
      return athlete.model.getObjectByName(name)!.getWorldPosition(new Vector3())
    }
    try {
      athlete.update({name: 'Athlete'}, startingCondition().levels)
      const contacts: [number, string, Vector3][] = [
        [1, 'foot_l', new Vector3(0.19, 0.098, -0.0482)],
        [1, 'foot_r', new Vector3(-0.19, 0.098, -0.0482)],
        [4, 'foot_l', new Vector3(0.089, 0.098, -0.0482)],
        [2, 'hand_l', new Vector3(0.25, barHeight - 0.11, barDepth)],
        [2, 'hand_r', new Vector3(-0.25, barHeight - 0.11, barDepth)],
        [8, 'hand_l', new Vector3(0.25, barHeight - 0.11, barDepth)],
        [8, 'hand_r', new Vector3(-0.25, barHeight - 0.11, barDepth)],
        [3, 'hand_l', new Vector3(handleSpread, handleHeight + 0.075, 0.08)],
        [3, 'hand_r', new Vector3(-handleSpread, handleHeight + 0.075, 0.08)],
        [5, 'hand_l', new Vector3(0.2, 0.05, 0.6)],
        [5, 'hand_r', new Vector3(-0.2, 0.05, 0.6)],
        [9, 'hand_l', new Vector3(ladderX - 0.11, ladderGrips[0], 0)],
        [9, 'hand_r', new Vector3(ladderX - 0.11, ladderGrips[1], 0)]
      ]
      for (const [challenge, name, target] of contacts)
        for (const completion of ['full', 'partial', 'none'] as const) {
          const sequence = performanceMotion(completion, challenge),
            duration = sequence.slice(0, -1).reduce((sum, motion) => sum + motion.seconds, 0)
          for (const fraction of [0.05, 0.3, 0.5, 0.75]) {
            athlete.play(sequence, false, duration * fraction, true)
            assert.ok(
              point(athlete, name).distanceTo(target) < 0.006,
              `challenge ${challenge} ${completion}: ${name} slipped at ${fraction}`
            )
          }
        }
    } finally {
      athlete.dispose()
    }
  })

  it('5-4 completes five repetitions or an eight-second hold and stops early according to the scoring shortfall', () => {
    for (const [challenge, required] of challenges.entries()) {
      const levels = {...startingCondition().levels, ...required.requires},
        full = effortOf('full', challenge, levels),
        sequence = performanceMotion('full', challenge, levels)
      assert.equal(full.completed, 5)
      assert.equal(
        sequence.slice(0, -1).reduce((sum, motion) => sum + motion.seconds, 0),
        10
      )
      assert.equal(motionAt(sequence, 10).motion.clip, 'Victory Fist Pump')
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
        assert.equal(motionAt(performanceMotion('partial', challenge, tired), 10).motion.clip, 'Kneeling Tired')
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
})
