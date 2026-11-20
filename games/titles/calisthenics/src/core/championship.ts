import type {Context, Json, PresenceEvent, Rules, Title} from '@whenparty/netcode'
import {
  actionsPerPlan,
  applyPlan,
  characteristics,
  maxEnergy,
  maxLevel,
  planProblem,
  startingCondition,
  trimPlan,
  type Characteristic,
  type Counts,
  type Levels,
  type Plan
} from './athlete.ts'
import {challenges, maxScore, scoreOf, shortOf, type Challenge} from './challenges.ts'
import {isAppearanceChoice, type Appearance} from './appearance.ts'

export const seats: readonly string[] = Array.from({length: 12}, (_, index) => `${index + 1}`)
export const minAthletes = 2
export const maxNameLength = 20
export const performanceMs = 12000

export interface Profile {
  name: string
  appearance?: Partial<Appearance>
}

export interface Result {
  trained: Counts
  score: number
  short: Characteristic[]
}

export interface Athlete {
  seat: string
  profile: Profile
  levels: Levels
  energy: number
  points: number
  plan: Plan | null
  result: Result | null
  left: boolean
}

export type Stage = 'lobby' | 'announcement' | 'preparation' | 'results'

export interface Performance {
  index: number
  endsAt: number | null
  remainingMs: number
}

export interface Championship {
  stage: Stage
  challenge: number
  profiles: Record<string, Profile>
  athletes: Athlete[]
  away: string[]
  performance?: Performance | null
}

export type Move =
  | {type: 'profile'; profile: Profile}
  | {type: 'appearance'; appearance: Partial<Appearance>}
  | {type: 'confirm'; plan: Plan}
  | {type: 'train'}
  | {type: 'perform'}
  | {type: 'next'}
  | {type: 'next-athlete'; challenge: number; index: number}

export const createChampionship = (): Championship => ({stage: 'lobby', challenge: 0, profiles: {}, athletes: [], away: []})

export const isHostSeat = (seat: string) => seat === seats[0]

export const normalizeProfile = (profile: Profile): Profile | null => {
  const name = profile.name.trim()
  const length = [...name].length
  return length >= 1 && length <= maxNameLength && (profile.appearance === undefined || isAppearanceChoice(profile.appearance))
    ? {name, ...(profile.appearance ? {appearance: {...profile.appearance}} : {})}
    : null
}

export const currentChallenge = (state: Championship): Challenge => challenges[state.challenge] ?? challenges[0]!

export const nextChallenge = (state: Championship): Challenge | null => challenges[state.challenge + 1] ?? null

export const isFinished = (state: Championship) => state.stage === 'results' && !state.performance && nextChallenge(state) === null

export const athleteAt = (state: Championship, seat: string | null) => state.athletes.find(athlete => athlete.seat === seat) ?? null

export const winnersOf = (state: Championship): Athlete[] => {
  const top = Math.max(...state.athletes.map(athlete => athlete.points))
  return state.athletes.filter(athlete => athlete.points === top)
}

export const canStart = (state: Championship, occupiedSeats: readonly string[], matchNumber = 0) =>
  matchNumber === 0 &&
  state.stage === 'lobby' &&
  occupiedSeats.length >= minAthletes &&
  occupiedSeats.every(seat => {
    const profile = state.profiles[seat]
    return profile !== undefined && normalizeProfile(profile) !== null
  })

export const isPaused = (state: Championship) => state.athletes.some(athlete => athlete.left || state.away.includes(athlete.seat))

export const canPerform = (state: Championship) =>
  state.stage === 'preparation' && !isPaused(state) && state.athletes.every(athlete => athlete.plan !== null)

export const canTrain = (state: Championship) => state.stage === 'announcement' && !isPaused(state)

export const canAnnounceNext = (state: Championship) =>
  state.stage === 'results' && !state.performance && !isFinished(state) && !isPaused(state)

const withAthlete = (state: Championship, seat: string, change: (athlete: Athlete) => Athlete): Championship => ({
  ...state,
  athletes: state.athletes.map(athlete => (athlete.seat === seat ? change(athlete) : athlete))
})

const start = (state: Championship, occupiedSeats: readonly string[]): Championship => ({
  ...state,
  stage: 'announcement',
  away: [],
  athletes: seats
    .filter(seat => occupiedSeats.includes(seat))
    .map(seat => ({
      seat,
      profile: state.profiles[seat] ?? {name: ''},
      ...startingCondition(),
      points: 0,
      plan: null,
      result: null,
      left: false
    }))
})

const confirm = (state: Championship, seat: string, plan: Plan): Championship | null => {
  const athlete = athleteAt(state, seat)

  if (state.stage !== 'preparation' || !athlete || athlete.left || athlete.plan || planProblem(athlete, plan)) {
    return null
  }

  return withAthlete(state, seat, each => ({...each, plan: trimPlan(plan)}))
}

const perform = (state: Championship, now: number): Championship => {
  const challenge = currentChallenge(state)

  return {
    ...state,
    stage: 'results',
    performance: {index: 0, endsAt: now + performanceMs, remainingMs: performanceMs},
    athletes: state.athletes.map(athlete => {
      const plan = athlete.plan ?? {training: {}, rest: actionsPerPlan}
      const condition = applyPlan(athlete, plan)
      const score = scoreOf(condition.levels, challenge)

      return {
        ...athlete,
        ...condition,
        points: athlete.points + score,
        plan: null,
        result: {trained: plan.training, score, short: shortOf(condition.levels, challenge)}
      }
    })
  }
}

const announceNext = (state: Championship): Championship => ({
  ...state,
  stage: 'announcement',
  challenge: state.challenge + 1,
  performance: null,
  athletes: state.athletes.map(athlete => ({...athlete, result: null}))
})

const advancePerformance = (state: Championship, now: number): Championship => {
  const index = state.performance!.index + 1
  return {...state, performance: index < state.athletes.length ? {index, endsAt: now + performanceMs, remainingMs: performanceMs} : null}
}

const runningEnd = (state: Championship): number | null =>
  state.stage === 'results' && !isPaused(state) && typeof state.performance?.endsAt === 'number' ? state.performance.endsAt : null

export const performanceDeadlines = (state: Championship): number[] => {
  const end = runningEnd(state)
  return end === null ? [] : [end]
}

// The next turn starts at the room time of the call, so a late call still gives the next athlete twelve seconds (3-5).
export const onPerformanceDeadline = (state: Championship, time: number, now: number): Championship =>
  runningEnd(state) === time ? advancePerformance(state, Math.max(now, time)) : state

export const applyMove = (state: Championship, seat: string, move: Move, now: number): Championship | null => {
  switch (move.type) {
    case 'profile': {
      const profile = normalizeProfile(move.profile)
      const existing = state.profiles[seat]
      return state.stage === 'lobby' && profile
        ? {
            ...state,
            profiles: {
              ...state.profiles,
              [seat]: {...profile, appearance: {...existing?.appearance, ...profile.appearance}}
            }
          }
        : null
    }
    case 'appearance': {
      if (state.stage !== 'lobby' || !isAppearanceChoice(move.appearance)) return null
      const profile = state.profiles[seat] ?? {name: ''}
      return {...state, profiles: {...state.profiles, [seat]: {...profile, appearance: {...profile.appearance, ...move.appearance}}}}
    }
    case 'confirm':
      return confirm(state, seat, move.plan)
    case 'train':
      return isHostSeat(seat) && canTrain(state) ? {...state, stage: 'preparation'} : null
    case 'perform':
      return isHostSeat(seat) && canPerform(state) ? perform(state, now) : null
    case 'next-athlete':
      return isHostSeat(seat) &&
        state.stage === 'results' &&
        state.performance &&
        !isPaused(state) &&
        move.challenge === state.challenge &&
        move.index === state.performance.index
        ? advancePerformance(state, now)
        : null
    case 'next':
      return isHostSeat(seat) && canAnnounceNext(state) ? announceNext(state) : null
  }
}

const takenSeats = (context: Context) => seats.filter(seat => context.seats[seat]?.taken === true)

const absentSeats = (context: Context, leaving: string | null = null) =>
  seats.filter(seat => {
    const each = context.seats[seat]
    return seat !== leaving && each?.taken === true && (each.lost || each.hidden)
  })

// The turn's timer stops when the championship becomes paused and runs again only when it stops being paused (3-4).
const timed = (before: Championship, after: Championship, now: number): Championship => {
  const turn = after.performance
  if (!turn) return after
  if (!isPaused(before) && isPaused(after) && turn.endsAt !== null) {
    return {...after, performance: {...turn, remainingMs: Math.max(0, turn.endsAt - now), endsAt: null}}
  }
  if (isPaused(before) && !isPaused(after) && turn.endsAt === null) {
    return {...after, performance: {...turn, endsAt: now + turn.remainingMs}}
  }
  return after
}

export const notePresence = (state: Championship, seat: string, event: PresenceEvent, context: Context): Championship => {
  const away = absentSeats(context, event === 'left' ? seat : null)
  if (event === 'left' && state.stage === 'lobby') {
    const {[seat]: _, ...profiles} = state.profiles
    return {...state, away, profiles}
  }
  const next = event === 'left' ? withAthlete({...state, away}, seat, athlete => ({...athlete, left: true})) : {...state, away}
  return timed(state, next, context.roomTime)
}

export const startChampionship = (lobby: Championship, context: Context): Championship => ({
  ...start(lobby, takenSeats(context)),
  away: absentSeats(context)
})

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const isCount = (value: unknown, max: number): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max

const isSeat = (value: unknown): value is string => typeof value === 'string' && seats.includes(value)

const isCharacteristic = (value: unknown): value is Characteristic => (characteristics as readonly unknown[]).includes(value)

const isCounts = (value: unknown, max: number): value is Counts =>
  isRecord(value) && Object.entries(value).every(([key, count]) => isCharacteristic(key) && isCount(count, max))

const isLevels = (value: unknown): value is Levels => isCounts(value, maxLevel) && characteristics.every(each => each in value)

const isPlan = (value: unknown): value is Plan =>
  isRecord(value) && isCounts(value.training, actionsPerPlan) && isCount(value.rest, actionsPerPlan)

const isProfile = (value: unknown): value is Profile =>
  isRecord(value) && typeof value.name === 'string' && (value.appearance === undefined || isAppearanceChoice(value.appearance))

const isResult = (value: unknown): value is Result =>
  isRecord(value) &&
  isCounts(value.trained, actionsPerPlan) &&
  isCount(value.score, maxScore) &&
  Array.isArray(value.short) &&
  value.short.every(isCharacteristic)

const isAthlete = (value: unknown): value is Athlete =>
  isRecord(value) &&
  isSeat(value.seat) &&
  isProfile(value.profile) &&
  isLevels(value.levels) &&
  isCount(value.energy, maxEnergy) &&
  isCount(value.points, maxScore * challenges.length) &&
  (value.plan === null || isPlan(value.plan)) &&
  (value.result === null || isResult(value.result)) &&
  typeof value.left === 'boolean'

export const isChampionship = (value: unknown): value is Championship =>
  isRecord(value) &&
  (['lobby', 'announcement', 'preparation', 'results'] as unknown[]).includes(value.stage) &&
  isCount(value.challenge, challenges.length - 1) &&
  isRecord(value.profiles) &&
  Object.entries(value.profiles).every(([seat, profile]) => isSeat(seat) && isProfile(profile)) &&
  Array.isArray(value.athletes) &&
  value.athletes.every(isAthlete) &&
  (value.performance === undefined ||
    value.performance === null ||
    (isRecord(value.performance) &&
      isCount(value.performance.index, value.athletes.length - 1) &&
      typeof value.performance.remainingMs === 'number' &&
      Number.isFinite(value.performance.remainingMs) &&
      value.performance.remainingMs >= 0 &&
      value.performance.remainingMs <= performanceMs &&
      (value.performance.endsAt === null ||
        (typeof value.performance.endsAt === 'number' && Number.isFinite(value.performance.endsAt) && value.performance.endsAt >= 0)))) &&
  Array.isArray(value.away) &&
  value.away.every(isSeat)

export const isMove = (value: unknown): value is Move => {
  if (!isRecord(value)) {
    return false
  }

  switch (value.type) {
    case 'next-athlete':
      return isCount(value.challenge, challenges.length - 1) && isCount(value.index, seats.length - 1)
    case 'appearance':
      return isAppearanceChoice(value.appearance)
    case 'profile':
      return isProfile(value.profile)
    case 'confirm':
      return isPlan(value.plan)
    case 'train':
    case 'perform':
    case 'next':
      return true
    default:
      return false
  }
}

const asJson = (state: Championship): Json => state as unknown as Json
const asState = (state: Json): Championship => state as unknown as Championship

export const rules: Rules = {
  seats: () => seats,
  lobby: () => asJson(createChampionship()),
  canStart: (last, seatsWithPlayers, matchNumber) => last !== null && canStart(asState(last), seatsWithPlayers, matchNumber),
  initialState: (_random, context, last) => asJson(startChampionship(last === null ? createChampionship() : asState(last), context)),
  step: (state, seat, action, _random, context) => {
    const next = isMove(action) ? applyMove(asState(state), seat, action, context.roomTime) : null
    return next === null ? null : asJson(next)
  },
  over: () => false,
  isAction: isMove,
  isState: isChampionship,
  presence: (state, seat, event, context) => asJson(notePresence(asState(state), seat, event, context)),
  deadlines: state => performanceDeadlines(asState(state)),
  deadline: (state, time, _random, context) => asJson(onPerformanceDeadline(asState(state), time, context.roomTime))
}

export const title: Title = {appId: 'when.party/calisthenics', waitingSeconds: 600, formatVersion: 1, rules}
