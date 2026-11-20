import assert from 'node:assert/strict'
import type {Context} from '@whenparty/netcode'
import {
  applyMove,
  createChampionship,
  notePresence,
  onPerformanceDeadline,
  seats,
  startChampionship,
  type Athlete,
  type Championship,
  type Move,
  type Plan
} from '../core/index.ts'

export const seated = (count: number) => seats.slice(0, count)

export const contextOf = (count: number, roomTime = 0, absent: readonly string[] = []): Context => ({
  roomTime,
  matchRuns: true,
  seats: Object.fromEntries(
    seats.map(seat => [seat, {taken: seated(count).includes(seat), lost: absent.includes(seat), hidden: false}])
  )
})

export const must = (state: Championship | null): Championship => {
  assert.ok(state, 'the move was rejected')
  return state
}

export const move = (state: Championship, seat: string, next: Move, now = 0) => applyMove(state, seat, next, now)

// A page that reloads or switches interfaces is lost to the host, then back with its page visible.
export const reconnect = (state: Championship, seat: string): Championship => {
  const count = Math.max(state.athletes.length, 2)
  const lost = notePresence(state, seat, 'lost', contextOf(count, 5000, [seat]))
  return notePresence(lost, seat, 'back', contextOf(count, 9000))
}

export const lobbyOf = (count: number) =>
  seated(count).reduce(
    (state, seat) => must(move(state, seat, {type: 'profile', profile: {name: `Athlete ${seat}`}})),
    createChampionship()
  )

export const announced = (count = 2) => startChampionship(lobbyOf(count), contextOf(count))

export const train = (state: Championship) => must(move(state, '1', {type: 'train'}))

export const started = (count = 2) => train(announced(count))

export const plan = (training: Plan['training'], rest = 0): Plan => ({training, rest})

export const rests = plan({}, 3)

export const confirmAll = (state: Championship, plans: Record<string, Plan> = {}) =>
  state.athletes
    .filter(athlete => !athlete.plan)
    .reduce((each, athlete) => must(move(each, athlete.seat, {type: 'confirm', plan: plans[athlete.seat] ?? rests})), state)

export const performing = (state: Championship, plans: Record<string, Plan> = {}) =>
  must(move(confirmAll(state, plans), '1', {type: 'perform'}))

export const finishPerformances = (state: Championship) => {
  let next = state
  while (next.performance?.endsAt !== null && next.performance?.endsAt !== undefined) {
    next = onPerformanceDeadline(next, next.performance.endsAt, next.performance.endsAt)
  }
  return next
}

export const perform = (state: Championship, plans: Record<string, Plan> = {}) => finishPerformances(performing(state, plans))

export const prepare = (state: Championship) => train(must(move(state, '1', {type: 'next'})))

export const withAthlete = (state: Championship, seat: string, change: Partial<Athlete>): Championship => ({
  ...state,
  athletes: state.athletes.map(athlete => (athlete.seat === seat ? {...athlete, ...change} : athlete))
})

export const perfectPlans: readonly Plan[] = [
  plan({arms: 1, chest: 1, stamina: 1}),
  plan({legs: 1}, 2),
  plan({back: 1}, 2),
  plan({abs: 1}, 2),
  plan({legs: 1, balance: 1}, 1),
  plan({arms: 1, balance: 1}, 1),
  plan({back: 1, abs: 1}, 1),
  plan({chest: 1, stamina: 1}, 1),
  plan({back: 1, abs: 1}, 1),
  plan({arms: 1}, 2)
]

export const playAll = (state: Championship, plansOf: (challenge: number) => Record<string, Plan>) =>
  Array.from({length: 10}, (_, index) => index).reduce(
    (each, index) => (index === 0 ? perform(each, plansOf(index)) : perform(prepare(each), plansOf(index))),
    state
  )
