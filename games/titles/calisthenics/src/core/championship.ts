// The championship as the host runs it: pure functions over plain JSON data, so every peer can
// render the same state in any interface. See ../../docs/specs/.
import type {GameRules, RoomContext, SeatPresence} from '@whenparty/p2p'
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

// What a player chooses about their athlete in the lobby
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
  // The plan confirmed for the current challenge
  plan: Plan | null
  // The result of the last challenge performed
  result: Result | null
  // Its player left the room, so nobody plays this athlete any more
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
  // Index into challenges
  challenge: number
  // Lobby profiles by seat
  profiles: Record<string, Profile>
  athletes: Athlete[]
  // Seats whose player is absent right now
  away: string[]
  performance?: Performance | null
}

export type Move =
  | {type: 'profile'; profile: Profile}
  | {type: 'appearance'; appearance: Partial<Appearance>}
  | {type: 'start'}
  | {type: 'confirm'; plan: Plan}
  | {type: 'train'}
  | {type: 'perform'}
  | {type: 'next'}
  | {type: 'next-athlete'; challenge: number; index: number}

export const createChampionship = (): Championship => ({stage: 'lobby', challenge: 0, profiles: {}, athletes: [], away: []})

// The creator keeps the first seat for the room's lifetime
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

export const canStart = (state: Championship, occupiedSeats: readonly string[]) =>
  state.stage === 'lobby' &&
  occupiedSeats.length >= minAthletes &&
  occupiedSeats.every(seat => {
    const profile = state.profiles[seat]
    return profile !== undefined && normalizeProfile(profile) !== null
  })

// Nobody may move the championship on while an athlete has no player here
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

export const performanceKey = (state: Championship) => `performance:${state.challenge}:${state.performance?.index}`

export const performanceDeadlines = (state: Championship): Record<string, number> =>
  state.stage === 'results' && state.performance?.endsAt !== null && state.performance?.endsAt !== undefined && !isPaused(state)
    ? {[performanceKey(state)]: state.performance.endsAt}
    : {}

export const onPerformanceDeadline = (state: Championship, key: string, {now}: RoomContext): Championship =>
  state.stage === 'results' &&
  key === performanceKey(state) &&
  state.performance?.endsAt !== null &&
  state.performance?.endsAt !== undefined &&
  now >= state.performance.endsAt &&
  !isPaused(state)
    ? advancePerformance(state, now)
    : state

export const applyMove = (state: Championship, seat: string, move: Move, {occupiedSeats, now}: RoomContext): Championship | null => {
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
    case 'start':
      return isHostSeat(seat) && canStart(state, occupiedSeats) ? start(state, occupiedSeats) : null
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

export const notePresence = (state: Championship, seat: string, presence: SeatPresence, now = 0): Championship => {
  const away = state.away.filter(each => each !== seat)
  if (presence === 'left' && state.stage === 'lobby') {
    const {[seat]: _, ...profiles} = state.profiles
    return {...state, away, profiles}
  }

  let next = presence === 'lost' ? {...state, away: [...away, seat]} : {...state, away}
  if (presence === 'left') next = withAthlete(next, seat, athlete => ({...athlete, left: true}))
  const turn = next.performance
  if (turn) {
    if (isPaused(next) && turn.endsAt !== null) {
      next = {...next, performance: {...turn, remainingMs: Math.max(0, turn.endsAt - now), endsAt: null}}
    } else if (!isPaused(next) && turn.endsAt === null) {
      next = {...next, performance: {...turn, endsAt: now + turn.remainingMs}}
    }
  }
  return next
}

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
    case 'start':
    case 'train':
    case 'perform':
    case 'next':
      return true
    default:
      return false
  }
}

export const calisthenics: GameRules<Championship, Move> = {
  seats,
  createState: createChampionship,
  applyMove,
  // A championship is never restarted in its room (3-3), and the platform restarts only finished games
  isOver: () => false,
  onPresence: (state, seat, presence, {now}) => notePresence(state, seat, presence, now),
  deadlinesOf: performanceDeadlines,
  onDeadline: onPerformanceDeadline,
  isMove,
  isState: isChampionship
}
