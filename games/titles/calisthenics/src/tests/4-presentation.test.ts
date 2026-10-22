import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {readFile} from 'node:fs/promises'
import {Vector3} from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {AthleteModel} from '../3d/athlete.ts'
import {barDepth, barHeight, handleHeight, handleSpread, ladderGrips, ladderX} from '../3d/exercises.ts'
import {applyIntent, createRoomState, joinPlayer} from '@whenparty/p2p'
import {
  appearanceOf,
  calisthenics,
  challenges,
  createChampionship,
  defaultAppearance,
  isMove,
  podiumOf,
  startingCondition,
  type Championship
} from '../engine/index.ts'
import {bodyVolume, demonstrationMotion, effortOf, effortProgress, motionAt, performanceMotion} from '../3d/presentation.ts'
import {lobbyOf, move, must, plan, started} from './championship.ts'

describe('4-presentation', () => {
  it('4-1 defaults each unchosen part, accepts both color cases, and preserves name and previous choices', () => {
    let state = must(move(lobbyOf(2), '1', {type: 'appearance', appearance: {bodyType: 'female', hairstyle: 'curly', shirt: '#Ab12cD'}}))
    const profile = state.profiles['1']!
    assert.equal(profile.name, 'Athlete 1')
    assert.deepEqual(appearanceOf(profile), {...defaultAppearance(), bodyType: 'female', hairstyle: 'curly', shirt: '#Ab12cD'})
    state = must(move(state, '1', {type: 'profile', profile: {name: '  Alex  '}}))
    assert.equal(state.profiles['1']!.name, 'Alex')
    assert.deepEqual(state.profiles['1']!.appearance, profile.appearance)
    state = must(move(state, '1', {type: 'appearance', appearance: {shoes: '#000000'}}))
    assert.deepEqual(appearanceOf(state.profiles['1']!), {...appearanceOf(profile), shoes: '#000000'})
    state = must(move(state, '1', {type: 'appearance', appearance: {bodyType: 'male'}}))
    assert.deepEqual(appearanceOf(state.profiles['1']!), {...appearanceOf(profile), bodyType: 'male', shoes: '#000000'})
    assert.ok(calisthenics.isState(state))
  })

  it('4-1 permits appearance before a name and accepts no invalid hairstyle or color', () => {
    assert.equal(appearanceOf({}).bodyType, 'male')
    const chosen = must(move(createChampionship(), '1', {type: 'appearance', appearance: {hairstyle: 'bald'}}))
    assert.equal(move(chosen, '1', {type: 'start'}), null)
    for (const appearance of [
      {bodyType: 'other'},
      {bodyType: 1},
      {hairstyle: 'spiky'},
      {shirt: 'red'},
      {hair: '#fff'},
      {skin: '#1234567'},
      {shoes: 12},
      {hat: '#123456'}
    ]) {
      assert.equal(isMove({type: 'appearance', appearance}), false)
      assert.equal(isMove({type: 'profile', profile: {name: 'A', appearance}}), false)
    }
    for (const hairstyle of ['short', 'curly', 'bun', 'bald']) assert.ok(isMove({type: 'appearance', appearance: {hairstyle}}))
    assert.equal(move(started(), '1', {type: 'appearance', appearance: {hair: '#123456'}}), null)
  })

  it('4-1 keeps appearance in the championship without changing condition or scoring', () => {
    const lobby = must(move(lobbyOf(2), '1', {type: 'appearance', appearance: {bodyType: 'female', skin: '#123456'}}))
    const active = must(move(lobby, '1', {type: 'start'}))
    const ordinary = started().athletes[0]!
    const customized = active.athletes[0]!
    assert.deepEqual(customized.levels, ordinary.levels)
    assert.equal(customized.energy, ordinary.energy)
    assert.equal(customized.points, ordinary.points)
    assert.equal(appearanceOf(customized.profile).skin, '#123456')
  })

  it('4-2 keeps one athlete, appearance and confirmed plan when the same player reconnects from either interface', () => {
    const member = (id: string, peerId = id) => ({playerId: id, peerId})
    let room = joinPlayer(createRoomState(calisthenics, member('host')), member('guest'))
    room = applyIntent(calisthenics, room, 'host', {type: 'move', id: 1, move: {type: 'profile', profile: {name: 'Host'}}})
    room = applyIntent(calisthenics, room, 'guest', {
      type: 'move',
      id: 1,
      move: {type: 'profile', profile: {name: 'Guest', appearance: {shirt: '#123456'}}}
    })
    room = applyIntent(calisthenics, room, 'host', {type: 'move', id: 2, move: {type: 'start'}})
    room = applyIntent(calisthenics, room, 'host', {type: 'move', id: 3, move: {type: 'train'}})
    room = applyIntent(calisthenics, room, 'guest', {type: 'move', id: 2, move: {type: 'confirm', plan: plan({arms: 1}, 2)}})
    const switched = joinPlayer(room, member('guest', 'text-connection'))
    assert.deepEqual(switched.game, room.game)
    assert.equal(switched.game.athletes.length, 2)
    assert.equal(appearanceOf(switched.game.athletes[1]!.profile).shirt, '#123456')
    assert.deepEqual(switched.game.athletes[1]!.plan, plan({arms: 1}, 2))
  })

  it('4-3 maps every successive arms and legs level to strictly larger independent volumes', () => {
    for (let level = 0; level < 10; level++) {
      assert.ok(bodyVolume(level + 1, 0).arms > bodyVolume(level, 0).arms)
      assert.ok(bodyVolume(0, level + 1).legs > bodyVolume(0, level).legs)
      assert.equal(bodyVolume(level, 5).legs, 0.5)
      assert.equal(bodyVolume(5, level).arms, 0.5)
    }
  })

  it('4-4 plays distinct push-up outcomes and replays without changing championship data', () => {
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

  it('4-4 4-5 demonstrates every challenge and gives each of the other nine its own attempt before reacting', () => {
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

  it('4-9 completes five repetitions or an eight-second hold and stops early according to the scoring shortfall', () => {
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

  it('4-8 keeps grips and planted feet on their supports while the body moves, including after seeking', async () => {
    const bytes = new Uint8Array(await readFile(new URL('../../public/assets/athlete.glb', import.meta.url)))
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

  it('4-6 groups the three highest distinct totals and leaves missing steps empty', () => {
    const withTotals = (totals: number[]): Championship => {
      const state = started(totals.length)
      return {...state, athletes: state.athletes.map((athlete, i) => ({...athlete, points: totals[i]!}))}
    }
    assert.deepEqual(
      podiumOf(withTotals([1000, 1000, 800, 600, 400])).map(row => row.place),
      [1, 1, 2, 3, null]
    )
    assert.deepEqual(
      podiumOf(withTotals([1000, 1000])).map(row => row.place),
      [1, 1]
    )
    const twelve = podiumOf(withTotals(Array(12).fill(0)))
    assert.equal(twelve.length, 12)
    assert.ok(twelve.every(row => row.place === 1))
  })
})
