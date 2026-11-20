import assert from 'node:assert/strict'
import {describe, it, test} from 'node:test'
import type {Context, Json, PresenceEvent} from '@whenparty/netcode'
import {
  announcementOf,
  createChampionship,
  isFinished,
  isPaused,
  performanceMs,
  resultsOf,
  rules,
  seats,
  standingsOf,
  title,
  type Championship,
  type Move
} from '../core/index.ts'
import {table, type Event, type Outcome, type State} from './3-match.states.ts'
import {confirmAll, finishPerformances, lobbyOf, must, move, perfectPlans, performing, plan, rests, seated, started} from './fixtures.ts'

const asJson = (state: Championship): Json => state as unknown as Json
const asState = (state: Json): Championship => state as unknown as Championship

interface Presence {
  readonly lost?: readonly string[]
  readonly hidden?: readonly string[]
}

const contextOf = (taken: readonly string[], {lost = [], hidden = []}: Presence = {}, roomTime = 0, matchRuns = true): Context => ({
  roomTime,
  matchRuns,
  seats: Object.fromEntries(seats.map(seat => [seat, {taken: taken.includes(seat), lost: lost.includes(seat), hidden: hidden.includes(seat)}]))
})

const three = seated(3)

const presence = (state: Championship, seat: string, event: PresenceEvent, after: Presence, roomTime = 0): Championship =>
  asState(rules.presence!(asJson(state), seat, event, contextOf(three, after, roomTime)))

const step = (state: Championship, seat: string, action: Move, roomTime = 0): Championship | null => {
  if (!rules.isAction(action as unknown as Json)) {
    return null
  }
  const next = rules.step(asJson(state), seat, action as unknown as Json, 0, contextOf(three, {}, roomTime))
  return next === null ? null : asState(next)
}

const classify = (state: Championship, matchNumber: number): State => {
  if (state.stage === 'lobby') {
    return matchNumber > 0 ? 'lostLobby' : 'lobby'
  }
  if (isFinished(state)) {
    return 'finished'
  }
  const screen = state.stage === 'results' ? (state.performance ? 'performing' : 'resultsDone') : state.stage
  return isPaused(state) ? `${screen}Paused` : screen
}

interface Setup {
  readonly state: Championship
  readonly matchNumber: number
  // Who is absent before the event.
  readonly absent: Presence
}

const turnTime = 1000

const lobbySetup = (event: Event, matchNumber: number): Setup => {
  const named = lobbyOf(3)
  if (event === 'startNotReady') {
    const {['3']: _, ...profiles} = named.profiles
    return {state: {...named, profiles}, matchNumber, absent: {}}
  }
  return {state: named, matchNumber, absent: event === 'startWithAbsent' ? {lost: ['2']} : {}}
}

const unpausedOf = (screen: string, event: Event): Championship => {
  switch (screen) {
    case 'announcement':
      return announced3()
    case 'preparation': {
      const prepared = started(3)
      if (event === 'perform') return confirmAll(prepared)
      if (event === 'performUnconfirmed') return must(move(prepared, '1', {type: 'confirm', plan: rests}))
      return prepared
    }
    case 'performing': {
      const first = performing(started(3))
      const at = (index: number, challenge = first.challenge): Championship => ({
        ...first,
        challenge,
        performance: {index, endsAt: turnTime + performanceMs, remainingMs: performanceMs}
      })
      if (event === 'lastTurnEnds') return at(2)
      if (event === 'finalTurnEnds') return at(2, 9)
      return at(0)
    }
    case 'resultsDone':
      return finishPerformances(performing(started(3)))
    default: {
      const last = performing({...started(3), challenge: 9})
      return finishPerformances(last)
    }
  }
}

const announced3 = (): Championship => asState(rules.initialState(0, contextOf(three, {}, 0, false), asJson(lobbyOf(3))))

const pausedSetup = (screen: string, event: Event): Setup => {
  let state = unpausedOf(screen, event)
  if (event === 'backWithLeft') {
    state = presence(state, '3', 'left', {lost: ['3']}, turnTime)
    state = presence(state, '2', 'lost', {lost: ['2']}, turnTime)
    return {state, matchNumber: 1, absent: {lost: ['2']}}
  }
  if (event === 'backOthersAway') {
    state = presence(state, '2', 'lost', {lost: ['2']}, turnTime)
    state = presence(state, '3', 'lost', {lost: ['2', '3']}, turnTime)
    return {state, matchNumber: 1, absent: {lost: ['2', '3']}}
  }
  state = presence(state, '2', 'lost', {lost: ['2']}, turnTime)
  return {state, matchNumber: 1, absent: {lost: ['2']}}
}

const setups: {readonly [S in State]: (event: Event) => Setup} = {
  lobby: event => lobbySetup(event, 0),
  lostLobby: event => lobbySetup(event, 1),
  announcement: event => ({state: unpausedOf('announcement', event), matchNumber: 1, absent: {}}),
  announcementPaused: event => pausedSetup('announcement', event),
  preparation: event => ({state: unpausedOf('preparation', event), matchNumber: 1, absent: {}}),
  preparationPaused: event => pausedSetup('preparation', event),
  performing: event => ({state: unpausedOf('performing', event), matchNumber: 1, absent: {}}),
  performingPaused: event => pausedSetup('performing', event),
  resultsDone: event => ({state: unpausedOf('resultsDone', event), matchNumber: 1, absent: {}}),
  resultsDonePaused: event => pausedSetup('resultsDone', event),
  finished: event => ({state: unpausedOf('finished', event), matchNumber: 1, absent: {}})
}

const advanceOf = (state: Championship): Move => {
  switch (state.stage) {
    case 'announcement':
      return {type: 'train'}
    case 'preparation':
      return {type: 'perform'}
    case 'results':
      return state.performance ? {type: 'next-athlete', challenge: state.challenge, index: state.performance.index} : {type: 'next'}
    default:
      return {type: 'train'}
  }
}

interface Happened {
  readonly next: Championship
  readonly result?: Outcome['result']
  readonly now: number
}

const without = (list: readonly string[] | undefined, seat: string) => (list ?? []).filter(each => each !== seat)

const happen = ({state, matchNumber, absent}: Setup, event: Event): Happened => {
  const now = turnTime + 500
  const act = (seat: string, action: Move): Happened => {
    const next = step(state, seat, action, now)
    return next === null ? {next: state, result: 'refused', now} : {next, result: 'accepted', now}
  }
  const index = state.performance?.index ?? 0
  switch (event) {
    case 'start':
    case 'startWithAbsent':
    case 'startNotReady': {
      if (!rules.canStart!(asJson(state), three, matchNumber)) {
        return {next: state, result: 'cannot start', now}
      }
      return {next: asState(rules.initialState(0, contextOf(three, absent, now, false), asJson(state))), result: 'starts', now}
    }
    case 'name':
      return act('2', {type: 'profile', profile: {name: '  Bo  '}})
    case 'badName':
      return act('2', {type: 'profile', profile: {name: '   '}})
    case 'appearance':
      return act('2', {type: 'appearance', appearance: {shirt: '#123456'}})
    case 'train':
      return act('1', {type: 'train'})
    case 'perform':
    case 'performUnconfirmed':
      return act('1', {type: 'perform'})
    case 'next':
      return act('1', {type: 'next'})
    case 'nextAthlete':
      return act('1', {type: 'next-athlete', challenge: state.challenge, index})
    case 'nextAthleteStale':
      return act('1', {type: 'next-athlete', challenge: state.challenge, index: index + 1})
    case 'guestAdvances':
      return act('2', advanceOf(state))
    case 'confirm':
      return act('2', {type: 'confirm', plan: rests})
    case 'turnEnds':
    case 'lastTurnEnds':
    case 'finalTurnEnds': {
      const [time] = rules.deadlines!(asJson(state))
      assert.ok(time !== undefined, 'the state lists a deadline')
      const late = time + 700
      return {next: asState(rules.deadline!(asJson(state), time, 0, contextOf(three, absent, late))), now: late}
    }
    case 'away':
      return {next: presence(state, absent.lost?.length ? '3' : '2', 'lost', {lost: [...(absent.lost ?? []), absent.lost?.length ? '3' : '2']}, now), now}
    case 'back':
      return {next: presence(state, '2', absent.lost?.includes('2') ? 'back' : 'visible', {lost: without(absent.lost, '2')}, now), now}
    case 'backOthersAway':
    case 'backWithLeft':
      return {next: presence(state, '2', 'back', {lost: without(absent.lost, '2')}, now), now}
    case 'backHidden':
      return {next: presence(state, '2', 'back', {lost: without(absent.lost, '2'), hidden: ['2']}, now), now}
    case 'left':
      return {next: presence(state, '2', 'left', {lost: [...(absent.lost ?? []), '2']}, now), now}
    case 'leaveFails':
      return {next: asState(rules.lobby!()), now}
  }
}

const check = (state: State, event: Event, outcome: Outcome): void => {
  const setup = setups[state](event)
  assert.equal(classify(setup.state, setup.matchNumber), state, 'the setup is in the state of the row')
  const {next, result, now} = happen(setup, event)
  if (outcome.result !== undefined) {
    assert.equal(result, outcome.result)
  }
  if (outcome.result === 'refused' || outcome.result === 'cannot start') {
    assert.deepEqual(next, setup.state)
  }
  assert.equal(classify(next, outcome.result === 'starts' ? setup.matchNumber + 1 : setup.matchNumber), outcome.next)
  const before = setup.state.performance
  switch (outcome.detail) {
    case "seat 2's name is trimmed":
      assert.equal(next.profiles['2']?.name, 'Bo')
      break
    case "seat 2's name and appearance are gone":
      assert.equal(next.profiles['2'], undefined)
      assert.ok(next.profiles['1'])
      break
    case "seat 2's appearance changes":
      assert.equal(next.profiles['2']?.appearance?.shirt, '#123456')
      break
    case 'no seated player has a name or an appearance':
      assert.deepEqual(next.profiles, {})
      assert.equal(rules.canStart!(asJson(next), three, setup.matchNumber), false)
      break
    case 'the next athlete has twelve seconds':
      assert.equal(next.performance?.index, (before?.index ?? -1) + 1)
      assert.equal(next.performance?.endsAt, now + performanceMs)
      break
    case 'the turn keeps its remaining time':
      assert.equal(next.performance?.endsAt, null)
      assert.equal(next.performance?.remainingMs, before?.endsAt === null ? before.remainingMs : (before?.endsAt ?? 0) - now)
      break
    case 'the turn runs again with its remaining time':
      assert.equal(next.performance?.endsAt, now + (before?.remainingMs ?? 0))
      break
    case 'nothing changes, and a running turn keeps its end time':
      assert.deepEqual(next.performance, before)
      break
    case 'every athlete has had a turn':
      assert.equal(next.performance, null)
      break
    case undefined:
      break
  }
}

for (const [state, cells] of Object.entries(table)) {
  for (const [event, cell] of Object.entries(cells)) {
    if ('ids' in cell) {
      test(`${cell.ids.join(' ')} ${state}, ${event}`, () => check(state as State, event as Event, cell.outcome))
    }
  }
}

describe('3-match', () => {
  it('3-1 takes names of 1 to 20 characters after trimming spaces, and repeated names', () => {
    const lobby = createChampionship()
    const nameOf = (text: string) => step(lobby, '1', {type: 'profile', profile: {name: text}})?.profiles['1']?.name

    assert.equal(nameOf('  Ann  '), 'Ann')
    assert.equal(nameOf(''), undefined)
    assert.equal(nameOf('x'.repeat(20)), 'x'.repeat(20))
    assert.equal(nameOf('x'.repeat(21)), undefined)
    const twins = must(step(must(step(lobby, '1', {type: 'profile', profile: {name: 'Sam'}})), '2', {type: 'profile', profile: {name: 'Sam'}}))
    assert.equal(twins.profiles['2']?.name, 'Sam')
  })

  it('3-2 lets the host start with 2 to 12 seated players who all have names, and gives each an athlete in seat order', () => {
    const twelve = seated(12)
    assert.equal(rules.canStart!(asJson(lobbyOf(1)), seated(1), 0), false)
    assert.equal(rules.canStart!(asJson(lobbyOf(12)), twelve, 0), true)
    assert.equal(rules.canStart!(asJson(lobbyOf(2)), seated(2), 1), false)
    const state = asState(rules.initialState(0, contextOf(twelve, {}, 0, false), asJson(lobbyOf(12))))
    assert.deepEqual(
      state.athletes.map(athlete => athlete.seat),
      twelve
    )
    assert.deepEqual(announcementOf(state), {number: 1, total: 10, name: 'Push-ups'})
  })

  it('3-2 adds no athletes later, and a spectator without one cannot act', () => {
    const state = started(2)
    assert.equal(step(state, '3', {type: 'confirm', plan: rests}), null)
    assert.equal(state.athletes.length, 2)
  })

  it('3-3 shows what each plan trained, the score and its reason, then the standings', () => {
    const results = finishPerformances(performing(started(2), {'1': plan({arms: 1, chest: 1}, 1)}))
    assert.deepEqual(
      resultsOf(results).map(row => [row.seat, row.trained, row.score, row.completion, row.short]),
      [
        ['1', {arms: 1, chest: 1}, 66, 'partial', ['stamina']],
        ['2', {}, 0, 'none', ['arms', 'chest', 'stamina']]
      ]
    )
    assert.equal(standingsOf(results).length, 2)
    const next = must(move(results, '1', {type: 'next'}))
    assert.deepEqual(announcementOf(next), {number: 2, total: 10, name: 'Squats'})
    assert.ok(next.athletes.every(athlete => athlete.plan === null && athlete.result === null))
  })

  it('3-3 ends the championship after the tenth challenge, and the netcode never sees it over', () => {
    let state = started(2)
    for (let index = 0; index < 10; index++) {
      if (index > 0) state = must(move(must(move(state, '1', {type: 'next'})), '1', {type: 'train'}))
      state = finishPerformances(performing(state, {'1': perfectPlans[index] ?? rests}))
    }
    assert.equal(isFinished(state), true)
    assert.equal(move(state, '1', {type: 'next'}), null)
    assert.equal(rules.over(asJson(state)), false)
  })

  it('3-5 gives each athlete twelve seconds from when the host ends the previous turn, even when the call comes late', () => {
    const first = performing(started(3))
    const end = first.performance!.endsAt!
    assert.deepEqual(rules.deadlines!(asJson(first)), [end])
    const late = asState(rules.deadline!(asJson(first), end, 0, contextOf(three, {}, end + 30_000)))
    assert.equal(late.performance?.index, 1)
    assert.equal(late.performance?.endsAt, end + 30_000 + performanceMs)
    assert.deepEqual(rules.deadline!(asJson(first), end - 1, 0, contextOf(three, {}, end)), asJson(first))
  })

  it('3-5 shows all twelve athletes in seat order before the final result, without applying plans again', () => {
    let state = {...performing(started(12)), challenge: 9}
    const athletes = state.athletes
    for (let index = 0; index < 12; index++) {
      assert.equal(state.athletes[state.performance!.index]!.seat, `${index + 1}`)
      const end = state.performance!.endsAt!
      state = asState(rules.deadline!(asJson(state), end, 0, contextOf(seated(12), {}, end)))
    }
    assert.equal(isFinished(state), true)
    assert.deepEqual(state.athletes, athletes)
  })

  it('3-6 gives the netcode the app ID, a waiting time of 600 seconds, format version 1 and no "admit"', () => {
    assert.equal(title.appId, 'when.party/calisthenics')
    assert.equal(title.waitingSeconds, 600)
    assert.equal(title.formatVersion, 1)
    assert.equal(rules.admit, undefined)
    assert.deepEqual(rules.seats(), seated(12))
  })

  it('3-7 takes names and appearances in a lobby after a lost championship, but starts no championship there', () => {
    const lost = asState(rules.lobby!())
    const named = must(step(must(step(lost, '1', {type: 'profile', profile: {name: 'Ann'}})), '2', {type: 'profile', profile: {name: 'Bo'}}))
    assert.ok(step(named, '2', {type: 'appearance', appearance: {hairstyle: 'bald'}}))
    assert.equal(rules.canStart!(asJson(named), seated(2), 1), false)
    assert.equal(rules.canStart!(asJson(named), seated(2), 0), true)
  })
})
