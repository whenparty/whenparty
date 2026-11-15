import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {applyIntent, createRoomState, joinPlayer} from '@whenparty/p2p'
import {bodyVolume, calisthenics, createChampionship, isMove, podiumOf, type Championship} from '../core/index.ts'
import {appearanceOf, defaultAppearance} from '../frontends/3d/appearance.ts'
import {lobbyOf, move, must, plan, started} from './fixtures.ts'

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

  it('4-4 groups the three highest distinct totals and leaves missing steps empty', () => {
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
