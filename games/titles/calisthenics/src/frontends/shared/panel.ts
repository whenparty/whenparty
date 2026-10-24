// The room and championship controls more than one frontend shows. It builds its own markup.
import {ROOM_CODE_LENGTH, normalizeRoomCode, seatOf} from '@whenparty/p2p'
import {
  actionsOf,
  actionsPerPlan,
  announcementOf,
  athleteAt,
  athletesOf,
  canAnnounceNext,
  canPerform,
  canStart,
  canTrain,
  challenges,
  characteristics,
  currentChallenge,
  emptyPlan,
  isFinished,
  isHostSeat,
  isPaused,
  maxEnergy,
  maxLevel,
  maxNameLength,
  nextChallenge,
  normalizeProfile,
  previewOf,
  resultsOf,
  restGain,
  seats,
  standingsOf,
  trainingCost,
  winnersOf,
  type Athlete,
  type Championship,
  type Characteristic,
  type Move,
  type Plan
} from '../../core/index.ts'
import type {Visit} from '../../connection.ts'
import {athleteStatus, characteristicNames, completionNames, levelsText, namesOf, problemNote, statusOf, trainedText} from './texts.ts'

export interface PanelActions {
  create: () => void
  join: (code: string) => void
  send: (move: Move) => void
}

export interface PanelOptions {
  // Room time for a visit, so the turn clock counts down between snapshots
  clock: (visit: Visit | null) => number
  // A frontend's own lobby controls, shown below the player list
  lobbyExtra?: HTMLElement
}

type ActionKey = Characteristic | 'rest'

interface Draft {
  key: string
  plan: Plan
  note: string
}

const markup = `
  <section id="entry">
    <p>A street workout championship for 2 to 12 players. Train your athlete for ten challenges and guess what each one needs.</p>
    <button id="create" type="button">Create a room</button>
    <form id="join">
      <label for="code">Or join one with its code</label>
      <div class="row">
        <input id="code" name="code" placeholder="K7MXQ" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" required />
        <button type="submit">Join</button>
      </div>
      <p id="join-error" class="error" role="alert"></p>
    </form>
  </section>

  <section id="game" hidden>
    <p id="room-info" class="room">
      Room <strong id="room-code"></strong>
      <span id="host-badge" hidden>you host</span>
      <button id="copy-link" type="button" class="quiet">Copy invite link</button>
    </p>
    <p id="status" aria-live="polite"></p>

    <div id="lobby" hidden>
      <h2 id="players-title">Players</h2>
      <ul id="players" class="list"></ul>
      <form id="name-form" hidden>
        <label for="name">Athlete name</label>
        <div class="row">
          <input id="name" name="name" maxlength="40" autocomplete="off" required />
          <button type="submit">Save</button>
        </div>
        <p id="name-error" class="error" role="alert"></p>
      </form>
      <button id="start" type="button" hidden>Start the championship</button>
    </div>

    <div id="announcement" class="splash" hidden>
      <p id="announce-number" class="muted"></p>
      <h2 id="announce-name"></h2>
      <p id="announce-note" class="muted"></p>
      <button id="train" type="button" hidden>Start training</button>
    </div>

    <div id="preparation" hidden>
      <h2 id="prep-title"></h2>
      <div id="plan" class="card" hidden>
        <div class="energy">
          <div>
            <span class="muted">Energy now</span>
            <strong id="energy-now"></strong>
          </div>
          <div>
            <span class="muted">After the plan</span>
            <strong id="energy-after"></strong>
          </div>
        </div>
        <p class="muted">A training raises a level by 1 and costs ${trainingCost} energy. A rest restores ${restGain} energy, up to ${maxEnergy}.</p>
        <div id="sliders"></div>
        <p id="plan-count"></p>
        <p id="plan-error" class="error" role="alert"></p>
        <button id="confirm" type="button">Ready for the challenge</button>
      </div>
      <p id="plan-done" hidden>Plan confirmed. Waiting for the others.</p>
      <h2>Athletes</h2>
      <ul id="athletes" class="list"></ul>
      <button id="perform" type="button" hidden>Start the challenge</button>
    </div>

    <div id="results" hidden>
      <h2 id="results-title"></h2>
      <div id="performance-card" class="performance-card" hidden>
        <p class="eyebrow">NOW PERFORMING</p>
        <h3 id="performer"></h3>
        <p id="performance-clock" role="timer"></p>
        <button id="next-athlete" type="button" hidden>Next athlete</button>
      </div>
      <ul id="scores" class="list"></ul>
      <h2 id="standings-title">Championship standings</h2>
      <ol id="standings" class="list"></ol>
      <p id="next"></p>
      <button id="next-challenge" type="button" hidden>Next challenge</button>
    </div>
  </section>
`

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

const playerRow = (label: string, tags: string, value: string) => {
  const li = item(label, tags)
  const right = document.createElement('span')
  right.className = 'value'
  right.textContent = value
  li.classList.add('split')
  li.prepend(right)
  return li
}

const countOf = (plan: Plan, key: ActionKey) => (key === 'rest' ? plan.rest : (plan.training[key] ?? 0))

const withCount = (plan: Plan, key: ActionKey, count: number): Plan =>
  key === 'rest' ? {...plan, rest: count} : {...plan, training: {...plan.training, [key]: count}}

export const mountPanel = (container: HTMLElement, actions: PanelActions, {clock, lobbyExtra}: PanelOptions) => {
  container.innerHTML = markup

  const find = <T extends Element>(selector: string): T => {
    const found = container.querySelector<T>(selector)

    if (!found) {
      throw new Error(`missing ${selector}`)
    }

    return found
  }

  let visit: Visit | null = null
  // An unconfirmed plan lives only in this page
  let draft: Draft = {key: '', plan: emptyPlan(), note: ''}

  const entry = find<HTMLElement>('#entry')
  const codeInput = find<HTMLInputElement>('#code')
  const joinError = find<HTMLElement>('#join-error')
  const gameSection = find<HTMLElement>('#game')
  const roomInfo = find<HTMLElement>('#room-info')
  const roomCode = find<HTMLElement>('#room-code')
  const copyLink = find<HTMLButtonElement>('#copy-link')
  const hostBadge = find<HTMLElement>('#host-badge')
  const statusText = find<HTMLElement>('#status')

  const lobby = find<HTMLElement>('#lobby')
  const playersTitle = find<HTMLElement>('#players-title')
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
  const standingsTitle = find<HTMLElement>('#standings-title')
  const standings = find<HTMLElement>('#standings')
  const nextText = find<HTMLElement>('#next')
  const nextButton = find<HTMLButtonElement>('#next-challenge')
  const performanceCard = find<HTMLElement>('#performance-card')
  const performer = find<HTMLElement>('#performer')
  const performanceClock = find<HTMLElement>('#performance-clock')
  const nextAthleteButton = find<HTMLButtonElement>('#next-athlete')

  const announcement = find<HTMLElement>('#announcement')
  const announceNumber = find<HTMLElement>('#announce-number')
  const announceName = find<HTMLElement>('#announce-name')
  const announceNote = find<HTMLElement>('#announce-note')
  const trainButton = find<HTMLButtonElement>('#train')

  if (lobbyExtra) {
    lobby.insertBefore(lobbyExtra, nameForm)
  }

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
    render(visit)
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

  const renderLobby = (state: Championship, occupied: string[], seat: string | null, isHost: boolean) => {
    playersTitle.textContent = `Players: ${occupied.length} of ${seats.length}`
    players.replaceChildren(
      ...occupied.map(each => {
        const tags = [isHostSeat(each) ? 'host' : '', each === seat ? 'you' : ''].filter(Boolean)
        return playerRow(`Player ${each}`, tags.join(', '), state.profiles[each]?.name || 'Entering a name…')
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
      info.textContent = key === 'rest' ? `+${restGain} energy per action` : `Level ${me.levels[key]} / ${maxLevel}`
      count.textContent = value === 1 ? '1 action' : `${value} actions`
    })
    planCount.textContent = `Planned ${preview.actions} of ${actionsPerPlan} actions`
    planError.textContent = draft.note || (preview.problem && preview.actions > 0 ? problemNote(preview.problem, draft.plan, me) : '')
    confirmButton.disabled = preview.problem !== null
  }

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

  const updatePerformanceClock = () => {
    const turn = visit?.view?.room?.game.performance
    if (!turn) return
    const remaining = turn.endsAt === null ? turn.remainingMs : Math.max(0, turn.endsAt - clock(visit))
    performanceClock.textContent =
      turn.endsAt === null ? `Paused · ${Math.ceil(remaining / 1000)} s remaining` : `${Math.ceil(remaining / 1000)} s remaining`
  }

  const renderResults = (state: Championship, isHost: boolean) => {
    const next = nextChallenge(state)

    resultsTitle.textContent = `Results: ${currentChallenge(state).name}`
    performanceCard.hidden = !state.performance
    nextAthleteButton.hidden = !isHost || !state.performance
    nextAthleteButton.disabled = isPaused(state)
    if (state.performance) {
      performer.textContent = `${state.performance.index + 1} of ${state.athletes.length} · ${state.athletes[state.performance.index]?.profile.name}`
    }
    updatePerformanceClock()
    scores.replaceChildren(
      ...resultsOf(state).map(row => {
        const reason = row.short.length > 0 ? ` Below the requirement: ${row.short.map(each => characteristicNames[each]).join(', ')}.` : ''
        return item(`${row.profile.name}: ${row.score}, ${completionNames[row.completion]}`, `${trainedText(row.trained)}.${reason}`)
      })
    )
    standings.replaceChildren(
      ...standingsOf(state).map((row, index) => item(`${index + 1}. ${row.profile.name}: ${row.points} points`, levelsText(row)))
    )
    standingsTitle.hidden = Boolean(state.performance)
    nextText.textContent = isFinished(state) ? `Champions: ${namesOf(winnersOf(state))}. The championship is over.` : ''
    nextButton.hidden = !isHost || !next || Boolean(state.performance)
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

  const render = (next: Visit | null) => {
    visit = next
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
    statusText.textContent = statusOf(visit)
    hostBadge.hidden = !isHost
    lobby.hidden = !live || state?.stage !== 'lobby'
    roomInfo.hidden = Boolean(state && state.stage !== 'lobby')
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

  const flash = (button: HTMLButtonElement, text: string) => {
    const original = button.textContent
    button.textContent = text
    setTimeout(() => (button.textContent = original), 2000)
  }

  find('#create').addEventListener('click', () => actions.create())

  find('#join').addEventListener('submit', event => {
    event.preventDefault()
    const code = normalizeRoomCode(codeInput.value)

    if (!code) {
      joinError.textContent = `That is not a room code. Codes have ${ROOM_CODE_LENGTH} characters, like K7MXQ.`
      return
    }

    joinError.textContent = ''
    actions.join(code)
  })

  nameForm.addEventListener('submit', event => {
    event.preventDefault()
    const profile = normalizeProfile({name: nameInput.value})

    nameError.textContent = profile ? '' : `Use 1 to ${maxNameLength} characters.`

    if (profile) {
      actions.send({type: 'profile', profile})
    }
  })

  copyLink.addEventListener('click', () => {
    const link = `${location.origin}/#${visit?.code ?? ''}`

    navigator.clipboard.writeText(link).then(
      () => flash(copyLink, 'Copied'),
      () => flash(copyLink, 'Copy failed')
    )
  })

  startButton.addEventListener('click', () => actions.send({type: 'start'}))
  confirmButton.addEventListener('click', () => actions.send({type: 'confirm', plan: draft.plan}))
  performButton.addEventListener('click', () => actions.send({type: 'perform'}))
  trainButton.addEventListener('click', () => actions.send({type: 'train'}))
  nextButton.addEventListener('click', () => actions.send({type: 'next'}))
  nextAthleteButton.addEventListener('click', () => {
    const state = visit?.view?.room?.game
    if (state?.performance) actions.send({type: 'next-athlete', challenge: state.challenge, index: state.performance.index})
  })
  const clockTimer = setInterval(updatePerformanceClock, 100)
  addEventListener('pagehide', () => clearInterval(clockTimer), {once: true})

  return {render}
}
