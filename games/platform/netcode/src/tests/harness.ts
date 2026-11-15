import assert from 'node:assert/strict'
import type {Context, GameHandlers, Json, Netcode, PresenceEvent, Rules, Snapshot, SnapshotView, Title} from '../index.ts'
import {createNetcode} from '../index.ts'
import {FakeClock, FakeJoinRequest, FakeRooms, FakeVisibility, type FakeRoom} from './fakes.ts'

export const code = 'BCDFG'
export const format = 3
export const versions: [number, number] = [1, format]

export interface Play {
  readonly log: readonly string[]
  readonly over?: boolean
  readonly due?: readonly number[]
}

export type Call = {readonly name: string; readonly detail: string; readonly context?: Context}

export interface TitleOptions {
  readonly presence?: boolean
  readonly canStart?: (last: Json | null, seats: readonly string[]) => boolean
  readonly admit?: (number: number) => boolean
  readonly seats?: readonly string[]
}

export interface Failing {
  seats: boolean
  initialState: boolean
  step: boolean
  presence: Set<string>
  deadline: Set<number>
  deadlines: boolean
  over: boolean
  deadlinesAlways: number | null
  initialDue: readonly number[]
  chainBelow: number | null
}

export interface Harness {
  readonly clock: FakeClock
  readonly rooms: FakeRooms
  readonly visibility: FakeVisibility
  readonly netcode: Netcode<Json>
  readonly told: (readonly [string, ...unknown[]])[]
  readonly calls: Call[]
  readonly failing: Failing
  readonly title: Title<Json, Json>
  readonly options: TitleOptions
}

const isPlay = (value: Json): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Array.isArray((value as {log?: unknown}).log)

const testRules = (calls: Call[], failing: Failing, options: TitleOptions): Rules<Json, Json> => {
  const record = (name: string, detail = '', context?: Context) => calls.push({name, detail, context})
  const rules: Rules<Json, Json> = {
    seats: () => {
      if (failing.seats) {
        throw new Error('seats')
      }
      return options.seats ?? ['A', 'B']
    },
    initialState: (_random, context) => {
      record('initial state', '', context)
      if (failing.initialState) {
        throw new Error('initial')
      }
      return (failing.initialDue.length === 0 ? {log: ['initial']} : {log: ['initial'], due: [...failing.initialDue]}) as Json
    },
    step: (state, seat, action, _random, context) => {
      record('step', `${seat} ${JSON.stringify(action)}`, context)
      if (failing.step) {
        throw new Error('step')
      }
      if (action === 'refuse') {
        return null
      }
      const play = state as unknown as Play
      return {...play, log: [...play.log, `step ${seat} ${JSON.stringify(action)}`], ...(action === 'win' ? {over: true} : {})} as Json
    },
    over: state => {
      record('over')
      if (failing.over) {
        throw new Error('over')
      }
      return (state as unknown as Play).over === true
    },
    isAction: value => value !== 'not an action',
    isState: isPlay,
    deadlines: state => {
      record('deadlines')
      if (failing.deadlines) {
        throw new Error('deadlines')
      }
      if (failing.deadlinesAlways !== null) {
        return [failing.deadlinesAlways]
      }
      return (state as unknown as Play).due ?? []
    },
    deadline: (state, time, _random, context) => {
      record('deadline', String(time), context)
      if (failing.deadline.has(time)) {
        return state
      }
      const play = state as unknown as Play
      const chain = failing.chainBelow
      const due =
        chain !== null && time < chain
          ? [time + 1, ...(play.due ?? []).filter(each => each >= chain)]
          : (play.due ?? []).filter(each => each > time)
      return {...play, due, log: [...play.log, `deadline ${time}`]} as Json
    }
  }
  if (options.presence !== false) {
    rules.presence = (state: Json, seat: string, event: PresenceEvent, context: Context) => {
      record('presence', `${event} ${seat}`, context)
      if (failing.presence.has(event) || failing.presence.has(`${event} ${seat}`)) {
        throw new Error('presence')
      }
      const play = state as unknown as Play
      return {...play, log: [...play.log, `${event} ${seat}`]} as Json
    }
  }
  if (options.canStart) {
    rules.canStart = options.canStart
  }
  if (options.admit) {
    rules.admit = options.admit
  }
  return rules
}

export const harness = (options: TitleOptions = {}): Harness => {
  const clock = new FakeClock()
  const rooms = new FakeRooms()
  const visibility = new FakeVisibility()
  const told: (readonly [string, ...unknown[]])[] = []
  const calls: Call[] = []
  const failing: Failing = {
    seats: false,
    initialState: false,
    step: false,
    presence: new Set(),
    deadline: new Set(),
    deadlines: false,
    over: false,
    deadlinesAlways: null,
    initialDue: [],
    chainBelow: null
  }
  const title: Title<Json, Json> = {
    appId: 'when.party/test',
    waitingSeconds: 600,
    formatVersion: format,
    rules: testRules(calls, failing, options)
  }
  const tell =
    (name: string) =>
    (...args: unknown[]) => {
      told.push([name, ...args])
    }
  const handlers: GameHandlers<Json> = {
    code: tell('code'),
    entering: tell('entering'),
    waiting: tell('waiting'),
    failed: tell('failed'),
    ended: tell('ended'),
    serverLost: tell('server lost'),
    serverBack: tell('server back'),
    snapshot: tell('snapshot'),
    hostAway: tell('host away'),
    hostBack: tell('host back'),
    canAct: tell('can act'),
    refused: tell('refused'),
    joinRequest: tell('join request'),
    requestEnded: tell('request ended'),
    rulesError: tell('rules error'),
    cannotStart: tell('cannot start')
  }
  let random = 0
  const netcode = createNetcode(title, handlers, {rooms, clock, visibility, random: () => random++})
  return {clock, rooms, visibility, netcode, told, calls, failing, title, options}
}

export const since = (h: Harness, mark: number): (readonly [string, ...unknown[]])[] => h.told.slice(mark)

export const names = (h: Harness, mark: number): string[] => since(h, mark).map(([name]) => name)

export const lastSnapshot = (h: Harness): SnapshotView<Json> => {
  const found = [...h.told].reverse().find(([name]) => name === 'snapshot')
  assert.ok(found, 'no snapshot was told')
  return found[1] as SnapshotView<Json>
}

export const snapshots = (h: Harness, mark: number): SnapshotView<Json>[] =>
  since(h, mark)
    .filter(([name]) => name === 'snapshot')
    .map(([, view]) => view as SnapshotView<Json>)

export const stateLog = (view: SnapshotView<Json>): readonly string[] => (view.snapshot.state as unknown as Play | null)?.log ?? []

export const hosting = (h: Harness, participants: readonly number[] = []): FakeRoom => {
  h.netcode.start()
  h.rooms.on.created(code, 1)
  for (const number of participants) {
    h.rooms.on.participantJoined(number, 'visible')
  }
  return h.rooms.last
}

export const running = (h: Harness, extra: readonly number[] = []): FakeRoom => {
  const room = hosting(h, [2, ...extra])
  h.netcode.startMatch()
  assert.equal(lastSnapshot(h).snapshot.running, true)
  return room
}

export const request = (h: Harness, number: number, joinData: Json = {versions}): FakeJoinRequest => {
  const joinRequest = new FakeJoinRequest(number, joinData)
  h.rooms.on.joinRequest(joinRequest)
  return joinRequest
}

export interface SnapshotFields {
  readonly versions?: readonly [number, number]
  readonly state?: Json | null
  readonly running?: boolean
  readonly match?: readonly [number, number]
  readonly seats?: readonly (number | null)[]
  readonly queue?: readonly number[]
  readonly accepted?: readonly (readonly [number, number])[]
  readonly time?: number
  readonly term?: number
  readonly n?: number
}

export const snapshotValue = (fields: SnapshotFields = {}): {[key: string]: Json} => ({
  t: 'snapshot',
  versions: [...(fields.versions ?? versions)],
  state: fields.state === undefined ? {log: ['initial']} : fields.state,
  running: fields.running ?? true,
  match: [...(fields.match ?? [1, 1])],
  seats: [...(fields.seats ?? [1, 2])],
  queue: [...(fields.queue ?? [])],
  accepted: (fields.accepted ?? []).map(([participant, number]) => [participant, number]),
  time: fields.time ?? 0,
  term: fields.term ?? 1,
  n: fields.n ?? 1
})

export const snapshotText = (fields: SnapshotFields = {}): string => JSON.stringify(snapshotValue(fields))

export const joinedPage = (h: Harness, number = 2): FakeRoom => {
  h.netcode.enter(code)
  h.rooms.on.asked()
  h.rooms.on.letIn()
  h.rooms.on.joined(number)
  return h.rooms.last
}

export const playingPage = (h: Harness, fields: SnapshotFields = {}, number = 2): FakeRoom => {
  const room = joinedPage(h, number)
  h.rooms.on.text(snapshotText(fields), 1)
  assert.equal(h.netcode.phase, 'playing')
  return room
}

export const returningPage = (h: Harness, recordData: Json = {versions, action: 1}, number = 2): FakeRoom => {
  h.netcode.enter(code)
  h.rooms.on.returning('participant', number, recordData)
  return h.rooms.last
}

export const recordOf = (snapshot: Snapshot | {[key: string]: Json}, time = 0): Json => ({versions, snapshot: snapshot as Json, time})

export const recoveringHost = (h: Harness, recordData: Json): FakeRoom => {
  h.netcode.enter(code)
  h.rooms.on.returning('owner', 1, recordData)
  return h.rooms.last
}

export const sentValues = (texts: readonly string[]): {[key: string]: unknown}[] =>
  texts.map(text => JSON.parse(text) as {[key: string]: unknown})
