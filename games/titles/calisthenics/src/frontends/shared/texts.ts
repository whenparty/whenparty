// Wording that more than one frontend shows, as functions of the core's data
import {seatOf} from '@whenparty/p2p'
import {
  actionsPerPlan,
  athleteAt,
  characteristics,
  isFinished,
  maxLevel,
  trainingCost,
  trainingsOf,
  winnersOf,
  type Athlete,
  type AthleteRow,
  type Championship,
  type Characteristic,
  type Completion,
  type Counts,
  type Plan,
  type PlanProblem
} from '../../core/index.ts'
import type {Search, Visit} from '../../connection.ts'

export const characteristicNames: Record<Characteristic, string> = {
  arms: 'Arms',
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  abs: 'Abs',
  balance: 'Balance',
  stamina: 'Stamina'
}

export const completionNames: Record<Completion, string> = {full: 'full completion', partial: 'partial completion', none: 'not performed'}

export const problemNote = (problem: PlanProblem, plan: Plan, athlete: Athlete): string =>
  problem === 'actions'
    ? `Plan all ${actionsPerPlan} actions.`
    : problem === 'energy'
      ? `Not enough energy: the trainings cost ${trainingCost * trainingsOf(plan)}, and the athlete has ${athlete.energy}.`
      : `Levels go up to ${maxLevel}.`

const searchNotes: Record<Search, (code: string) => string> = {
  looking: code => `Looking for room ${code}…`,
  unreachable: code =>
    `Found room ${code}, but could not connect to the players in it. A network on the way blocks the connection. Try again in a moment, or switch between Wi-Fi and mobile data.`,
  offline: () => 'Cannot reach the game server. Check your internet connection.',
  nobody: code => `Nobody is hosting ${code}. Check the code with the room creator.`
}

export const trainedText = (trained: Counts) => {
  const parts = characteristics.filter(each => trained[each]).map(each => `${characteristicNames[each]} +${trained[each]}`)
  return parts.length > 0 ? `Trained ${parts.join(', ')}` : 'Only rested'
}

export const levelsText = (row: Pick<AthleteRow, 'levels'>) =>
  characteristics.map(each => `${characteristicNames[each]} ${row.levels[each]}`).join(' · ')

export const namesOf = (athletes: Pick<Athlete, 'profile'>[]) => athletes.map(athlete => athlete.profile.name).join(', ')

export const athleteStatus = (row: AthleteRow) => (row.left ? 'left the room' : row.away ? 'away' : row.confirmed ? 'ready' : 'planning')

const pauseText = (state: Championship) => {
  const left = state.athletes.filter(athlete => athlete.left)
  const away = state.athletes.filter(athlete => !athlete.left && state.away.includes(athlete.seat))

  if (left.length > 0) {
    return `Paused for good: the player of ${namesOf(left)} left the room.`
  }

  return away.length > 0 ? `Paused: the player of ${namesOf(away)} is away. The championship waits for them to come back.` : null
}

export const statusOf = ({code, view, search}: Visit): string => {
  if (view?.hostLeft) {
    return 'The host left, so the championship is over.'
  }

  if (view?.waitingForHost) {
    return view.room ? 'Waiting for the room creator. The room closes if they are away for two minutes.' : 'Restoring your room…'
  }

  if (!view?.room) {
    return searchNotes[search](code)
  }

  if (!view.inControl) {
    return 'This championship is open in another tab of yours, which plays now.'
  }

  const state = view.room.game
  const seat = seatOf(view.room, view.playerId)
  const me = athleteAt(state, seat)

  if (state.stage === 'lobby') {
    if (!seat) {
      return 'The room is full. You are watching.'
    }

    return view.isHost
      ? 'Send the code to the other players. Start when everyone has entered a name.'
      : 'Enter a name. The host starts the championship.'
  }

  if (isFinished(state)) {
    const winners = winnersOf(state)
    return winners.length > 1 ? `${namesOf(winners)} share the win.` : `${namesOf(winners)} wins the championship.`
  }

  const pause = pauseText(state)

  if (pause) {
    return pause
  }

  if (!me || me.left) {
    return 'You are watching the championship.'
  }

  if (state.stage === 'announcement') {
    return view.isHost ? 'Talk the challenge over, then start training.' : 'The host starts training.'
  }

  if (state.stage === 'preparation') {
    return me.plan ? 'Waiting for the others to confirm their plans.' : 'Plan three actions for your athlete, then confirm.'
  }

  if (state.performance) return 'Watch each athlete take their turn. Their result appears after the performance.'

  return view.isHost ? 'Announce the next challenge when everyone has seen the results.' : 'The host announces the next challenge.'
}
