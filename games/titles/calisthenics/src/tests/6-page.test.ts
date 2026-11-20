import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {ActProblem, GameHandlers, Json, Netcode, Phase as NetPhase, Snapshot} from '@whenparty/netcode'
import {Room, type Visit} from '../connection.ts'
import {createChampionship, type Championship, type Move} from '../core/index.ts'
import {notACode} from '../frontends/shared/texts.ts'
import {announced} from './fixtures.ts'
import {table, type Event, type Outcome, type State} from './6-page.states.ts'

const codeLetters = /^[23456789BCDFGHJKMNPQRSTVWXYZ]{5}$/

class FakeNetcode implements Netcode {
  phase: NetPhase = 'none'
  readonly calls: string[] = []
  readonly answers: (ActProblem | null)[] = []
  readonly handlers: GameHandlers
  constructor(handlers: GameHandlers) {
    this.handlers = handlers
  }

  parseCode(text: string): string | null {
    const code = text.replace(/[\s-]/gu, '').toUpperCase()
    return codeLetters.test(code) ? code : null
  }
  start(): void {
    this.calls.push('start')
  }
  enter(code: string): void {
    this.calls.push(`enter ${code}`)
  }
  leave(): void {
    this.calls.push('leave')
  }
  startMatch(): void {
    this.calls.push('start a match')
  }
  act(action: Json): ActProblem | null {
    const answer = this.answers.length > 0 ? (this.answers.shift() ?? null) : null
    this.calls.push(`act ${JSON.stringify(action)}${answer ? ` (${answer})` : ''}`)
    if (answer === null) {
      this.handlers.canAct?.(false)
    }
    return answer
  }
  roomTime(): number | null {
    return null
  }
}

interface Harness {
  room: Room
  netcode: FakeNetcode
  hash: string
  readonly addresses: (string | null)[]
  reload(): void
}

const harness = (hash: string): Harness => {
  const self = {hash, addresses: [] as (string | null)[]} as Harness
  const make = (): void => {
    self.room = new Room({
      createNetcode: handlers => (self.netcode = new FakeNetcode(handlers)),
      hash: () => self.hash,
      replaceAddress: code => {
        self.addresses.push(code)
        self.hash = code ?? ''
      },
      changed: () => {}
    })
  }
  self.reload = () => {
    make()
    self.room.open()
  }
  make()
  return self
}

const snapshotOf = (state: Championship): Snapshot =>
  ({
    versions: [1, 1],
    state: state as unknown as Json,
    running: state.stage !== 'lobby',
    match: {term: 1, number: state.stage === 'lobby' ? 0 : 1},
    seats: [1, 2, null, null, null, null, null, null, null, null, null, null],
    queue: [],
    accepted: [],
    roomTime: 0,
    term: 1,
    number: 1
  }) as Snapshot

const show = (h: Harness, state: Championship): void => {
  h.netcode.handlers.snapshot?.({snapshot: snapshotOf(state), participant: 2, seat: '2', isHost: false})
}

const name = (text: string): Move => ({type: 'profile', profile: {name: text}})
const shirt = (color: string): Move => ({type: 'appearance', appearance: {shirt: color}})
const hair: Move = {type: 'appearance', appearance: {hairstyle: 'bald'}}
const train: Move = {type: 'train'}

const inRoom = (): Harness => {
  const h = harness('K7MXQ')
  h.room.open()
  show(h, createChampionship())
  h.netcode.handlers.canAct?.(true)
  return h
}

const keepAll = (h: Harness, moves: readonly Move[]): void => {
  h.netcode.handlers.canAct?.(false)
  h.netcode.answers.push('cannot act')
  for (const move of moves) {
    h.room.send(move)
  }
}

const setups: {readonly [S in State]: (event: Event) => Harness} = {
  start: () => {
    const h = harness('')
    h.room.open()
    return h
  },
  inRoom: () => inRoom(),
  keeping: event => {
    const h = inRoom()
    if (event === 'canActSeveral' || event === 'canActTooLarge') {
      keepAll(h, [name('Bo'), hair])
    } else if (event === 'canActStale') {
      keepAll(h, [name('Bo')])
      show(h, announced(2))
      h.room.send({type: 'confirm', plan: {training: {}, rest: 3}})
    } else if (event === 'appearanceKept') {
      keepAll(h, [name('Bo'), shirt('#111111')])
    } else {
      keepAll(h, [name('Bo')])
    }
    return h
  },
  over: () => {
    const h = inRoom()
    h.netcode.handlers.ended?.({cause: 'room closed'})
    return h
  }
}

const stateOf = (h: Harness): State => {
  const visit: Visit | null = h.room.visit
  if (visit === null) return 'start'
  if (visit.phase === 'over') return 'over'
  return h.room.kept.length > 0 ? 'keeping' : 'inRoom'
}

const happen = (h: Harness, event: Event): {formError?: string; letIn?: boolean} => {
  switch (event) {
    case 'create':
      h.room.create()
      return {}
    case 'submitCode':
      assert.equal(h.room.submit('k7m-xq'), true)
      return {}
    case 'submitNoCode':
      return h.room.submit('nope') ? {} : {formError: notACode}
    case 'openWithCode':
      h.hash = 'K7MXQ'
      h.room.open()
      return {}
    case 'reload':
      h.hash = 'K7MXQ'
      h.reload()
      return {}
    case 'reloadNoCode':
      h.hash = ''
      h.reload()
      return {}
    case 'addressOtherCode':
      h.hash = 'B2CDF'
      h.room.addressChanged()
      return {}
    case 'addressNoChange':
      for (const hash of [...(h.room.visit?.code ? [h.room.visit.code] : []), 'zz', '']) {
        h.hash = hash
        h.room.addressChanged()
      }
      return {}
    case 'leavePressed':
      h.room.leave()
      return {}
    case 'joinRequest': {
      let letIn = false
      h.netcode.handlers.joinRequest?.({number: 5, letIn: () => (letIn = true), refuse: () => {}})
      return {letIn}
    }
    case 'action':
      h.room.send(name('Bo'))
      return {}
    case 'actionCannotAct':
      h.netcode.answers.push('cannot act')
      h.room.send(h.room.kept.length > 0 ? train : name('Bo'))
      return {}
    case 'appearanceKept':
      h.room.send(shirt('#222222'))
      return {}
    case 'nameKept':
      h.room.send(name('Cy'))
      return {}
    case 'canActOne':
    case 'canActSeveral':
    case 'canActStale':
      h.netcode.handlers.canAct?.(true)
      return {}
    case 'canActTooLarge':
      h.netcode.answers.push('too large')
      h.netcode.handlers.canAct?.(true)
      return {}
    case 'gameEnds':
      h.netcode.handlers.ended?.({cause: 'room closed'})
      return {}
  }
}

const check = (state: State, event: Event, outcome: Outcome): void => {
  const h = setups[state](event)
  assert.equal(stateOf(h), state, 'the setup is in the state of the row')
  const keptBefore = h.room.kept
  const netcodeBefore = h.netcode
  const callsBefore = h.netcode.calls.length
  const addressesBefore = h.addresses.length
  const {formError, letIn} = happen(h, event)
  const code = event === 'addressOtherCode' ? 'B2CDF' : 'K7MXQ'
  const calls = (h.netcode === netcodeBefore ? h.netcode.calls.slice(callsBefore) : h.netcode.calls).filter(
    call => !call.includes('(cannot act)')
  )
  assert.equal(stateOf(h), outcome.next)
  assert.equal(h.room.visit === null ? 'start' : 'room', outcome.screen)
  assert.equal(h.room.visit !== null, outcome.leaveButton)
  if (outcome.formError) assert.equal(formError, outcome.formError)
  if (outcome.request) assert.equal(letIn, true)
  switch (outcome.netcode) {
    case 'starts a game':
      assert.deepEqual(calls, ['start'])
      break
    case 'enters the game':
      assert.deepEqual(calls, [`enter ${code}`])
      break
    case 'leaves, then enters the other game':
      assert.deepEqual(calls, ['leave', 'enter B2CDF'])
      break
    case 'leaves the game':
      assert.deepEqual(calls, ['leave'])
      break
    case 'nothing':
      assert.deepEqual(calls, [])
      break
  }
  switch (outcome.address) {
    case 'ends in # and the code':
      assert.equal(h.addresses.at(-1), code)
      break
    case 'no room code':
      assert.equal(h.addresses.length, addressesBefore + 1)
      assert.equal(h.addresses.at(-1), null)
      break
  }
  const acts = calls.filter(call => call.startsWith('act '))
  switch (outcome.sent) {
    case 'the action':
      assert.deepEqual(acts, [`act ${JSON.stringify(name('Bo'))}`])
      break
    case 'the first kept action':
      assert.deepEqual(acts, [`act ${JSON.stringify(keptBefore[0])}`])
      break
    case 'the second kept action':
      assert.equal(acts.at(-1), `act ${JSON.stringify(keptBefore[1])}`)
      break
    case 'nothing':
      assert.deepEqual(acts, [])
      break
  }
  switch (outcome.kept) {
    case 'added':
      assert.deepEqual(h.room.kept, [...keptBefore, keptBefore.length > 0 ? train : name('Bo')])
      break
    case 'merged into the last':
      assert.deepEqual(h.room.kept, [name('Bo'), shirt('#222222')])
      break
    case 'replaces the kept name':
      assert.deepEqual(h.room.kept, [name('Cy')])
      break
    case 'one left':
      assert.deepEqual(h.room.kept, keptBefore.slice(1))
      break
    case 'none left':
      assert.deepEqual(h.room.kept, [])
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

test('6-5 merges an appearance change only into a kept appearance change that is last, and keeps a name in its place', () => {
  const h = inRoom()
  keepAll(h, [shirt('#111111'), name('Bo'), shirt('#222222'), hair, name('Cy')])
  assert.deepEqual(h.room.kept, [shirt('#111111'), name('Cy'), {type: 'appearance', appearance: {shirt: '#222222', hairstyle: 'bald'}}])
})

test('6-2 a page that left has no room, so the code of the room it left enters it again', () => {
  const h = inRoom()
  h.room.leave()
  h.hash = 'K7MXQ'
  h.room.addressChanged()
  assert.equal(h.netcode.calls.at(-1), 'enter K7MXQ')
})
