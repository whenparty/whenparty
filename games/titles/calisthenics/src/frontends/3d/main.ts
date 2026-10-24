import './style.css'
import {seatOf} from '@whenparty/p2p'
import {mountControls} from '../controls.ts'
import {
  appearanceOf,
  athleteAt,
  completionOf,
  currentChallenge,
  isFinished,
  isPaused,
  performanceMs,
  podiumOf,
  startingCondition,
  type Appearance
} from '../engine/index.ts'
import {visitNow, type Visit} from '../room.ts'
import {ClubScene, type SceneView, type VisualAthlete} from './scene.ts'

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
let visit: Visit | null = null
let scene: ClubScene | null = null
let previewSeat = ''
const previewSelect = element<HTMLSelectElement>('preview-athlete')
const appearance = element<HTMLFieldSetElement>('appearance')
const hairstyle = element<HTMLSelectElement>('hairstyle')
const bodyType = element<HTMLSelectElement>('body-type')
const colors = ['hair', 'skin', 'shirt', 'shorts', 'shoes'] as const
const loader = element('scene-loader'),
  error = element('scene-error')
const updateLinks = () => {
  element<HTMLAnchorElement>('fallback-link').href = `text.html${visit ? `#${visit.code}` : ''}`
}
const fail = (message: string) => {
  loader.hidden = true
  error.hidden = false
  element('scene-error-message').textContent = message
  updateLinks()
}

try {
  scene = new ClubScene(element('scene'), element('actor-labels'), fail, () => {
    loader.hidden = true
  })
} catch {
  fail('This browser could not start the 3D scene. Your room is available in the text interface.')
}

const update = (next: Visit | null) => {
  visit = next
  updateLinks()
  const state = next?.view?.room?.game
  const seat = next?.view?.room ? seatOf(next.view.room, next.view.playerId) : null
  const me = state ? athleteAt(state, seat) : null
  const shownAthlete = me ?? state?.athletes[0]
  const profile = (state?.stage === 'lobby' && seat ? state.profiles[seat] : shownAthlete?.profile) ?? {name: 'Your athlete'}
  const look = appearanceOf(profile)
  appearance.disabled = !state || state.stage !== 'lobby' || !seat || !next?.view?.inControl
  hairstyle.value = look.hairstyle
  bodyType.value = look.bodyType
  for (const key of colors) element<HTMLInputElement>(`look-${key}`).value = look[key]
  const own: VisualAthlete = {
    seat: shownAthlete?.seat ?? seat ?? 'preview',
    profile,
    levels: shownAthlete?.levels ?? startingCondition().levels,
    points: shownAthlete?.points ?? 0
  }
  previewSelect.hidden = !state || state.stage !== 'lobby'
  if (state?.stage === 'lobby') {
    const choices = [
      ['', 'Your athlete'],
      ...Object.entries(state.profiles)
        .filter(([other]) => other !== seat)
        .map(([other, p]) => [other, p.name || `Athlete ${other}`])
    ]
    previewSelect.replaceChildren(
      ...choices.map(([value, label]) => {
        const option = document.createElement('option')
        option.value = value!
        option.textContent = label!
        return option
      })
    )
    if (!choices.some(([value]) => value === previewSeat)) previewSeat = ''
    previewSelect.value = previewSeat
    if (previewSeat && state.profiles[previewSeat]) own.profile = state.profiles[previewSeat]!
  }
  const view: SceneView = {kind: 'personal', challenge: state?.challenge ?? 0, athletes: [own]}
  const title = element('scene-title'),
    round = element('round-label'),
    caption = element('scene-caption'),
    mode = element('scene-mode')
  const note = element('motion-note')
  note.hidden = true
  note.textContent = ''
  element<HTMLButtonElement>('replay').hidden = state?.stage !== 'results' || Boolean(state.performance)
  if (!state || state.stage === 'lobby') {
    title.textContent = 'One good rep.'
    round.textContent = 'SMALL STEPS. GOOD COMPANY.'
    caption.textContent = 'Make an athlete. Invite your friends.'
    mode.textContent = 'YOUR STUDIO'
    if (state) {
      const others = Object.entries(state.profiles).filter(([other]) => other !== seat)
      element('appearance-preview').replaceChildren(
        ...others.map(([, other]) => {
          const row = document.createElement('span')
          row.className = 'look-preview'
          const swatch = document.createElement('i')
          swatch.style.backgroundColor = appearanceOf(other).shirt
          row.append(swatch, document.createTextNode(`${other.name || 'Choosing a name'} · ${appearanceOf(other).hairstyle}`))
          return row
        })
      )
    }
  } else {
    round.textContent = `CHALLENGE ${state.challenge + 1} OF 10`
    title.textContent = currentChallenge(state).name
    caption.textContent =
      state.stage === 'preparation'
        ? 'Three actions. Make them count.'
        : state.stage === 'announcement'
          ? 'Talk it over. Make your plan.'
          : 'Every attempt has a story.'
    mode.textContent =
      state.stage === 'preparation' ? 'YOUR STUDIO' : state.stage === 'announcement' ? 'THE NEXT CHALLENGE' : 'THE CLUB FLOOR'
    if (state.stage === 'announcement') view.kind = 'announcement'
    if (state.stage === 'results') {
      const turn = state.performance
      view.kind = isFinished(state) ? 'podium' : 'results'
      view.athletes = isFinished(state)
        ? podiumOf(state).map(row => ({...row, completion: completionOf(athleteAt(state, row.seat)?.result?.score ?? 0)}))
        : state.athletes.map((athlete, index) => ({
            ...athlete,
            score: !turn || index < turn.index ? athlete.result?.score : undefined,
            completion: completionOf(athlete.result?.score ?? 0)
          }))
      if (turn) {
        view.activeSeat = state.athletes[turn.index]?.seat
        view.elapsed =
          Math.min(performanceMs, Math.max(0, performanceMs - (turn.endsAt === null ? turn.remainingMs : turn.endsAt - visitNow(next)))) /
          1000
        view.paused = isPaused(state) || Boolean(next?.view?.waitingForHost)
        caption.textContent = `${state.athletes[turn.index]?.profile.name} · ${turn.index + 1} of ${state.athletes.length}`
      }
      if (isFinished(state)) {
        title.textContent = 'Your moment.'
        mode.textContent = 'THE PODIUM'
        caption.textContent = 'One club. More than one champion.'
      }
    }
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    note.textContent = `${note.textContent ? note.textContent + ' ' : ''}Reduced motion: showing still poses.`
    note.hidden = false
  }
  scene?.show(view)
}

update(null)
const controls = mountControls(update)
previewSelect.addEventListener('change', () => {
  previewSeat = previewSelect.value
  update(visit)
})
const choose = (choice: Partial<Appearance>) => {
  previewSeat = ''
  controls.send({type: 'appearance', appearance: choice})
}
hairstyle.addEventListener('change', () => choose({hairstyle: hairstyle.value as Appearance['hairstyle']}))
bodyType.addEventListener('change', () => choose({bodyType: bodyType.value as Appearance['bodyType']}))
for (const key of colors)
  element<HTMLInputElement>(`look-${key}`).addEventListener('input', event => choose({[key]: (event.target as HTMLInputElement).value}))
element('replay').addEventListener('click', () => scene?.replay())
element('camera-reset').addEventListener('click', () => scene?.resetCamera())
window.addEventListener('pagehide', () => scene?.dispose(), {once: true})
