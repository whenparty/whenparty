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
import type {Finish, Visit} from '../../connection.ts'

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

export const notACode = 'That is not a room code. Codes have 5 characters, like K7MXQ.'

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

const endingOf = (finish: Finish, code: string, waitedForHost: boolean): string => {
  if (finish.kind === 'ended') {
    const {end} = finish
    switch (end.cause) {
      case 'other version':
        return end.older === 'host'
          ? 'The host runs an older version of the game. Ask them to reload the page.'
          : 'This game was updated. Reload the page.'
      case 'outdated':
        return end.older === 'page'
          ? 'This game was updated. Reload the page.'
          : 'The game server is being updated. Try again in a few minutes.'
      case 'removed':
        return 'You were away too long, so you left this game.'
      case 'owner away':
        return 'The connection was lost for too long, so the game is over.'
      case 'idle':
        return 'Nobody played for a while, so the room is closed.'
      case 'unreachable':
      case 'no relay':
        return 'Lost the connection to the host and could not get it back.'
      case 'room closed':
        return 'The room is closed, so the game is over.'
    }
  }
  const {failure} = finish
  switch (failure.cause) {
    case 'other version':
      return failure.older === 'page'
        ? 'This game was updated. Reload the page.'
        : `The host of ${code} runs an older version of the game. Ask them to reload the page.`
    case 'outdated':
      return failure.older === 'page'
        ? 'This game was updated. Reload the page.'
        : 'The game server is being updated. Try again in a few minutes.'
    case 'bad rules':
      return 'This game has an error and cannot start.'
    case 'busy':
      return 'The game server is busy. Try again in a few minutes.'
    case 'bad app':
    case 'bad wait':
      return 'This game was updated. Reload the page.'
    case 'no room':
      return waitedForHost ? `Room ${code} is closed.` : `Nobody hosts ${code}. Check the code with the room creator.`
    case 'owner away':
      return `The host of ${code} is offline. Try again in a moment.`
    case 'full':
      return `Room ${code} is full.`
    case 'refused':
      return `The host of ${code} did not let you in.`
    case 'unreachable':
      return `Found room ${code}, but could not connect to its host. A network on the way may block the connection. Try again in a moment, or switch between Wi-Fi and mobile data.`
    case 'offline':
      return 'Cannot reach the game server. Check your internet connection.'
    case 'open elsewhere':
      return 'This game is open in another tab. Close it and reload this page.'
  }
}

export const isLostLobby = (visit: Pick<Visit, 'game' | 'matchNumber'>) => visit.game?.stage === 'lobby' && visit.matchNumber > 0

const championshipText = (visit: Visit, state: Championship): string => {
  const {seat, isHost} = visit
  const me = athleteAt(state, seat)

  if (isLostLobby(visit)) {
    return 'This room lost its championship. Create a new room to play again.'
  }

  if (state.stage === 'lobby') {
    return isHost
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

  if (!me) {
    return 'You are watching the championship.'
  }

  if (state.stage === 'announcement') {
    return isHost ? 'Talk the challenge over, then start training.' : 'The host starts training.'
  }

  if (state.stage === 'preparation') {
    return me.plan ? 'Waiting for the others to confirm their plans.' : 'Plan three actions for your athlete, then confirm.'
  }

  if (state.performance) return 'Watch each athlete take their turn. Their result appears after the performance.'

  return isHost ? 'Announce the next challenge when everyone has seen the results.' : 'The host announces the next challenge.'
}

// The status of 7-1 and, after a failure or an end, of 7-2 in 7-status.md.
export const statusOf = (visit: Visit): string => {
  const code = visit.code ?? ''
  if (visit.finish !== null) {
    return endingOf(visit.finish, code, visit.waitedForHost)
  }
  if (visit.phase === 'starting') {
    return 'Creating a room…'
  }
  if (visit.waiting === 'decides') {
    return `Waiting for the host of ${code} to let you in…`
  }
  if (visit.waiting === 'offline') {
    return `Waiting for the host of ${code} to come back…`
  }
  if (visit.hostAway) {
    return 'The connection to the host is lost. The game goes on when it is back. The room closes if the host is away for 10 minutes.'
  }
  const prefixes = [
    ...(visit.serverLost ? ['New players cannot join right now: the game server is out of reach.'] : []),
    ...(visit.rulesError ? ['This game has an error.'] : [])
  ]
  const rest = visit.phase === 'entering' || visit.game === null ? `Looking for room ${code}…` : championshipText(visit, visit.game)
  return [...prefixes, rest].join(' ')
}
