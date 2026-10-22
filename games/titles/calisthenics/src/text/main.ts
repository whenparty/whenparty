// The text interface: draws the engine's screens with plain page elements
import './style.css'
import {ROOM_CODE_LENGTH, normalizeRoomCode, seatOf} from '@whenparty/p2p'
import {
  actionsOf,
  actionsPerPlan,
  athleteAt,
  athletesOf,
  canPerform,
  announcementOf,
  canAnnounceNext,
  canStart,
  canTrain,
  challenges,
  characteristics,
  currentChallenge,
  emptyPlan,
  isFinished,
  isHostSeat,
  maxEnergy,
  maxLevel,
  maxNameLength,
  nextChallenge,
  normalizeProfile,
  previewOf,
  resultsOf,
  seats,
  standingsOf,
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
} from '../engine/index.ts'
import {openRoom, type Search, type Visit} from '../room.ts'

const characteristicNames: Record<Characteristic, string> = {
  arms: 'Arms',
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  abs: 'Abs',
  balance: 'Balance',
  stamina: 'Stamina'
}

const completionNames: Record<Completion, string> = {full: 'full completion', partial: 'partial completion', none: 'not performed'}

const problemNotes: Record<PlanProblem, (plan: Plan, athlete: Athlete) => string> = {
  actions: () => `Plan all ${actionsPerPlan} actions.`,
  energy: (plan, athlete) =>
    `Not enough energy: the trainings cost ${trainingCost * trainingsOf(plan)}, and the athlete has ${athlete.energy}.`,
  level: () => `Levels go up to ${maxLevel}.`
}

const searchNotes: Record<Search, (code: string) => string> = {
  looking: code => `Looking for room ${code}…`,
  unreachable: code =>
    `Found room ${code}, but could not connect to the players in it. A network on the way blocks the connection. Try again in a moment, or switch between Wi-Fi and mobile data.`,
  offline: () => 'Cannot reach the game server. Check your internet connection.',
  nobody: code => `Nobody is hosting ${code}. Check the code with the room creator.`
}

type ActionKey = Characteristic | 'rest'

interface Draft {
  key: string
  plan: Plan
  note: string
}

let visit: Visit | null = null
// An unconfirmed plan lives only in this page
let draft: Draft = {key: '', plan: emptyPlan(), note: ''}

const find = <T extends Element>(selector: string): T => {
  const found = document.querySelector<T>(selector)

  if (!found) {
    throw new Error(`missing ${selector}`)
  }

  return found
}

const item = (title: string, detail = '') => {
  const li = document.createElement('li')
  li.textContent = title

  if (detail) {
    const span = document.createElement('span')
    span.className = 'detail'
    span.textContent = detail
    li.append(span)
  }

  return li
}

const entry = find<HTMLElement>('#entry')
const codeInput = find<HTMLInputElement>('#code')
const joinError = find<HTMLElement>('#join-error')
const gameSection = find<HTMLElement>('#game')
const roomCode = find<HTMLElement>('#room-code')
const copyLink = find<HTMLButtonElement>('#copy-link')
const hostBadge = find<HTMLElement>('#host-badge')
const statusText = find<HTMLElement>('#status')

const lobby = find<HTMLElement>('#lobby')
const players = find<HTMLElement>('#players')
const nameForm = find<HTMLFormElement>('#name-form')
const nameInput = find<HTMLInputElement>('#name')
const nameError = find<HTMLElement>('#name-error')
const startButton = find<HTMLButtonElement>('#start')

const preparation = find<HTMLElement>('#preparation')
const prepTitle = find<HTMLElement>('#prep-title')
const planCard = find<HTMLElement>('#plan')
const energyNow = find<HTMLElement>('#energy-now')
const energyAfterText = find<HTMLElement>('#energy-after')
const planCount = find<HTMLElement>('#plan-count')
const planError = find<HTMLElement>('#plan-error')
const confirmButton = find<HTMLButtonElement>('#confirm')
const planDone = find<HTMLElement>('#plan-done')
const athletesList = find<HTMLElement>('#athletes')
const performButton = find<HTMLButtonElement>('#perform')

const results = find<HTMLElement>('#results')
const resultsTitle = find<HTMLElement>('#results-title')
const scores = find<HTMLElement>('#scores')
const standings = find<HTMLElement>('#standings')
const nextText = find<HTMLElement>('#next')
const nextButton = find<HTMLButtonElement>('#next-challenge')

const announcement = find<HTMLElement>('#announcement')
const announceNumber = find<HTMLElement>('#announce-number')
const announceName = find<HTMLElement>('#announce-name')
const announceNote = find<HTMLElement>('#announce-note')
const trainButton = find<HTMLButtonElement>('#train')

const countOf = (plan: Plan, key: ActionKey) => (key === 'rest' ? plan.rest : (plan.training[key] ?? 0))

const withCount = (plan: Plan, key: ActionKey, count: number): Plan =>
  key === 'rest' ? {...plan, rest: count} : {...plan, training: {...plan.training, [key]: count}}

const trainedText = (trained: Counts) => {
  const parts = characteristics.filter(each => trained[each]).map(each => `${characteristicNames[each]} +${trained[each]}`)
  return parts.length > 0 ? `Trained ${parts.join(', ')}` : 'Only rested'
}

const levelsText = (row: Pick<AthleteRow, 'levels'>) =>
  characteristics.map(each => `${characteristicNames[each]} ${row.levels[each]}`).join(' · ')

const namesOf = (athletes: Pick<Athlete, 'profile'>[]) => athletes.map(athlete => athlete.profile.name).join(', ')

const myAthlete = () => {
  const room = visit?.view?.room
  return room && visit?.view ? athleteAt(room.game, seatOf(room, visit.view.playerId)) : null
}

const changeCount = (key: ActionKey, wanted: number) => {
  const me = myAthlete()
  const others = actionsOf(draft.plan) - countOf(draft.plan, key)
  let count = Math.min(wanted, actionsPerPlan - others)
  let note = count < wanted ? `${actionsPerPlan} actions are already planned. Lower another slider to add this one.` : ''

  if (key !== 'rest' && me && count > maxLevel - me.levels[key]) {
    count = maxLevel - me.levels[key]
    note = `Levels go up to ${maxLevel}.`
  }

  draft = {...draft, plan: withCount(draft.plan, key, count), note}
  render()
}

const sliders = new Map(
  [...characteristics, 'rest' as const].map(key => {
    const row = document.createElement('div')
    row.className = 'slider'
    const head = document.createElement('div')
    head.className = 'head'
    const label = document.createElement('label')
    label.textContent = key === 'rest' ? 'Rest' : characteristicNames[key]
    label.htmlFor = `slider-${key}`
    const info = document.createElement('span')
    info.className = 'muted'
    head.append(label, info)
    const input = document.createElement('input')
    input.type = 'range'
    input.id = `slider-${key}`
    input.min = '0'
    input.max = `${actionsPerPlan}`
    input.step = '1'
    input.addEventListener('input', () => changeCount(key, Number(input.value)))
    const count = document.createElement('span')
    row.append(head, input, count)
    find('#sliders').append(row)
    return [key, {input, info, count}]
  })
)

const pauseText = (state: Championship) => {
  const left = state.athletes.filter(athlete => athlete.left)
  const away = state.athletes.filter(athlete => !athlete.left && state.away.includes(athlete.seat))

  if (left.length > 0) {
    return `Paused for good: the player of ${namesOf(left)} left the room.`
  }

  return away.length > 0 ? `Paused: the player of ${namesOf(away)} is away. The championship waits for them to come back.` : null
}

const describe = ({code, view, search}: Visit): string => {
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

  return view.isHost ? 'Announce the next challenge when everyone has seen the results.' : 'The host announces the next challenge.'
}

const renderLobby = (state: Championship, occupied: string[], seat: string | null, isHost: boolean) => {
  players.replaceChildren(
    ...occupied.map(each => {
      const tags = [isHostSeat(each) ? 'host' : '', each === seat ? 'you' : ''].filter(Boolean)
      return item(state.profiles[each]?.name ?? 'Entering a name…', tags.join(', '))
    })
  )
  nameForm.hidden = !seat
  startButton.hidden = !isHost
  startButton.disabled = !canStart(state, occupied)
}

const renderPlan = (state: Championship, me: Athlete) => {
  const preview = previewOf(state, me, draft.plan)

  energyNow.textContent = `${preview.energy} of ${maxEnergy}`
  energyAfterText.textContent = `${preview.energyAfter} of ${maxEnergy}`
  sliders.forEach(({input, info, count}, key) => {
    const value = countOf(draft.plan, key)
    input.value = `${value}`
    info.textContent = key === 'rest' ? '+50 energy per action' : `Level ${me.levels[key]} / ${maxLevel}`
    count.textContent = value === 1 ? '1 action' : `${value} actions`
  })
  planCount.textContent = `Planned ${preview.actions} of ${actionsPerPlan} actions`
  planError.textContent = draft.note || (preview.problem && preview.actions > 0 ? problemNotes[preview.problem](draft.plan, me) : '')
  confirmButton.disabled = preview.problem !== null
}

const athleteStatus = (row: AthleteRow) => (row.left ? 'left the room' : row.away ? 'away' : row.confirmed ? 'ready' : 'planning')

const renderPreparation = (state: Championship, me: Athlete | null, code: string, isHost: boolean) => {
  const key = `${code}:${state.challenge}`

  if (draft.key !== key) {
    draft = {key, plan: emptyPlan(), note: ''}
  }

  prepTitle.textContent = `Challenge ${state.challenge + 1} of ${challenges.length}: ${currentChallenge(state).name}`
  planCard.hidden = !me || me.left || me.plan !== null
  planDone.hidden = !me?.plan

  if (me && !planCard.hidden) {
    renderPlan(state, me)
  }

  athletesList.replaceChildren(
    ...athletesOf(state).map(row => item(`${row.profile.name}: ${athleteStatus(row)}`, `${levelsText(row)} · Energy ${row.energy}`))
  )
  performButton.hidden = !isHost
  performButton.disabled = !canPerform(state)
}

const renderResults = (state: Championship, isHost: boolean) => {
  const next = nextChallenge(state)

  resultsTitle.textContent = `Results: ${currentChallenge(state).name}`
  scores.replaceChildren(
    ...resultsOf(state).map(row => {
      const reason = row.short.length > 0 ? ` Below the requirement: ${row.short.map(each => characteristicNames[each]).join(', ')}.` : ''
      return item(`${row.profile.name}: ${row.score}, ${completionNames[row.completion]}`, `${trainedText(row.trained)}.${reason}`)
    })
  )
  standings.replaceChildren(
    ...standingsOf(state).map((row, index) => item(`${index + 1}. ${row.profile.name}: ${row.points} points`, levelsText(row)))
  )
  nextText.textContent = next ? '' : `Champions: ${namesOf(winnersOf(state))}. The championship is over.`
  nextButton.hidden = !isHost || !next
  nextButton.disabled = !canAnnounceNext(state)
}

const renderAnnouncement = (state: Championship, note: string, isHost: boolean) => {
  const {number, total, name} = announcementOf(state)

  announceNumber.textContent = `Challenge ${number} of ${total}`
  announceName.textContent = name
  announceNote.textContent = note
  trainButton.hidden = !isHost
  trainButton.disabled = !canTrain(state)
}

const render = () => {
  entry.hidden = visit !== null
  gameSection.hidden = visit === null

  if (!visit) {
    return
  }

  const {view} = visit
  const room = view?.room ?? null
  const live = Boolean(room && view?.inControl && !view.hostLeft && !view.waitingForHost)
  const state = room?.game ?? null
  const seat = view && room ? seatOf(room, view.playerId) : null
  const isHost = Boolean(view?.isHost)

  roomCode.textContent = visit.code
  statusText.textContent = describe(visit)
  hostBadge.hidden = !isHost
  lobby.hidden = !live || state?.stage !== 'lobby'
  announcement.hidden = !live || state?.stage !== 'announcement'
  preparation.hidden = !live || state?.stage !== 'preparation'
  results.hidden = !live || state?.stage !== 'results'

  if (!live || !room || !state) {
    return
  }

  if (state.stage === 'lobby') {
    renderLobby(
      state,
      seats.filter(each => room.seats[each]),
      seat,
      isHost
    )
  } else if (state.stage === 'announcement') {
    renderAnnouncement(state, statusText.textContent ?? '', isHost)
  } else if (state.stage === 'preparation') {
    renderPreparation(state, athleteAt(state, seat), visit.code, isHost)
  } else {
    renderResults(state, isHost)
  }
}

const room = openRoom(next => {
  visit = next
  render()
})

const flash = (button: HTMLButtonElement, text: string) => {
  const original = button.textContent
  button.textContent = text
  setTimeout(() => (button.textContent = original), 2000)
}

find('#create').addEventListener('click', () => room.create())

find('#join').addEventListener('submit', event => {
  event.preventDefault()
  const code = normalizeRoomCode(codeInput.value)

  if (!code) {
    joinError.textContent = `That is not a room code. Codes have ${ROOM_CODE_LENGTH} characters, like K7MXQ.`
    return
  }

  joinError.textContent = ''
  room.join(code)
})

nameForm.addEventListener('submit', event => {
  event.preventDefault()
  const profile = normalizeProfile({name: nameInput.value})

  nameError.textContent = profile ? '' : `Use 1 to ${maxNameLength} characters.`

  if (profile) {
    room.send({type: 'profile', profile})
  }
})

copyLink.addEventListener('click', () => {
  const link = `${location.origin}${location.pathname}#${visit?.code ?? ''}`

  navigator.clipboard.writeText(link).then(
    () => flash(copyLink, 'Copied'),
    () => flash(copyLink, 'Copy failed')
  )
})

startButton.addEventListener('click', () => room.send({type: 'start'}))
confirmButton.addEventListener('click', () => room.send({type: 'confirm', plan: draft.plan}))
performButton.addEventListener('click', () => room.send({type: 'perform'}))
trainButton.addEventListener('click', () => room.send({type: 'train'}))
nextButton.addEventListener('click', () => room.send({type: 'next'}))
find('#leave').addEventListener('click', () => room.leave())
