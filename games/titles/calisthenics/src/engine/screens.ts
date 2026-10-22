// What each screen shows, whatever the interface draws it with
import {actionsOf, energyAfter, planProblem, type Characteristic, type Counts, type Levels, type Plan, type PlanProblem} from './athlete.ts'
import {challenges, completionOf, type Completion} from './challenges.ts'
import {currentChallenge, type Athlete, type Championship, type Profile} from './championship.ts'

export interface AthleteRow {
  seat: string
  profile: Profile
  levels: Levels
  energy: number
  points: number
  confirmed: boolean
  away: boolean
  left: boolean
}

export interface ResultRow {
  seat: string
  profile: Profile
  trained: Counts
  score: number
  completion: Completion
  short: Characteristic[]
}

export interface Announcement {
  number: number
  total: number
  name: string
}

export interface Preview {
  challenge: string
  levels: Levels
  energy: number
  energyAfter: number
  actions: number
  problem: PlanProblem | null
}

export const athletesOf = (state: Championship): AthleteRow[] =>
  state.athletes.map(({seat, profile, levels, energy, points, plan, left}) => ({
    seat,
    profile,
    levels,
    energy,
    points,
    confirmed: plan !== null,
    away: state.away.includes(seat),
    left
  }))

export const standingsOf = (state: Championship): AthleteRow[] =>
  state.performance ? [] : athletesOf(state).sort((a, b) => b.points - a.points)

export const podiumOf = (state: Championship): (AthleteRow & {place: number | null})[] => {
  const rows = standingsOf(state)
  const totals = [...new Set(rows.map(row => row.points))].slice(0, 3)
  return rows.map(row => ({...row, place: totals.includes(row.points) ? totals.indexOf(row.points) + 1 : null}))
}

export const resultsOf = (state: Championship): ResultRow[] =>
  state.athletes
    .slice(0, state.performance?.index ?? state.athletes.length)
    .flatMap(({seat, profile, result}) =>
      result
        ? [{seat, profile, trained: result.trained, score: result.score, completion: completionOf(result.score), short: result.short}]
        : []
    )

export const previewOf = (state: Championship, athlete: Athlete, plan: Plan): Preview => ({
  challenge: currentChallenge(state).name,
  levels: athlete.levels,
  energy: athlete.energy,
  energyAfter: Math.max(0, energyAfter(athlete.energy, plan)),
  actions: actionsOf(plan),
  problem: planProblem(athlete, plan)
})

export const announcementOf = (state: Championship): Announcement => ({
  number: state.challenge + 1,
  total: challenges.length,
  name: currentChallenge(state).name
})
