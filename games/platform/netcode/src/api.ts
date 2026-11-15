import type {Rooms} from '@whenparty/rooms'

export type Json = null | boolean | number | string | readonly Json[] | {readonly [key: string]: Json}

export type PresenceEvent = 'lost' | 'back' | 'hidden' | 'visible' | 'left'

export interface SeatContext {
  readonly taken: boolean
  readonly lost: boolean
  readonly hidden: boolean
}

export interface Context {
  readonly roomTime: number
  readonly seats: {readonly [seat: string]: SeatContext}
}

export interface Rules<S extends Json = Json, A extends Json = Json> {
  seats(): readonly string[]
  initialState(random: number, context: Context): S
  step(state: S, seat: string, action: A, random: number, context: Context): S | null
  over(state: S): boolean
  isAction(value: Json): boolean
  isState(value: Json): boolean
  presence?(state: S, seat: string, event: PresenceEvent, context: Context): S
  deadlines?(state: S): readonly number[]
  deadline?(state: S, time: number, random: number, context: Context): S
  admit?(number: number): boolean
  canStart?(lastState: S | null, seatsWithPlayers: readonly string[]): boolean
}

export interface Title<S extends Json = Json, A extends Json = Json> {
  readonly appId: string
  readonly waitingSeconds: number | null
  readonly formatVersion: number
  readonly rules: Rules<S, A>
}

export type VersionsOlder = 'page' | 'host'

export type SideOlder = 'page' | 'server'

export type Failure =
  | {
      readonly cause:
        | 'open elsewhere'
        | 'bad rules'
        | 'bad app'
        | 'bad wait'
        | 'busy'
        | 'offline'
        | 'no room'
        | 'full'
        | 'refused'
        | 'unreachable'
        | 'owner away'
    }
  | {readonly cause: 'other version'; readonly older: VersionsOlder}
  | {readonly cause: 'outdated'; readonly older: SideOlder}

export type End =
  | {readonly cause: 'room closed' | 'idle' | 'owner away' | 'removed' | 'unreachable' | 'no relay'}
  | {readonly cause: 'other version'; readonly older: VersionsOlder}
  | {readonly cause: 'outdated'; readonly older: SideOlder}

export interface MatchId {
  readonly term: number
  readonly number: number
}

export interface Snapshot<S extends Json = Json> {
  readonly versions: readonly [number, number]
  readonly state: S | null
  readonly running: boolean
  readonly match: MatchId
  readonly seats: readonly (number | null)[]
  readonly queue: readonly number[]
  readonly accepted: readonly (readonly [number, number])[]
  readonly roomTime: number
  readonly term: number
  readonly number: number
}

export interface SnapshotView<S extends Json = Json> {
  readonly snapshot: Snapshot<S>
  readonly participant: number
  readonly seat: string | null
  readonly isHost: boolean
}

export interface JoinRequestAnswer {
  readonly number: number
  letIn(): void
  refuse(): void
}

export type Waiting = 'decides' | 'offline'

export interface GameHandlers<S extends Json = Json> {
  code?(code: string): unknown
  entering?(): unknown
  waiting?(host: Waiting): unknown
  failed?(failure: Failure): unknown
  ended?(end: End): unknown
  serverLost?(): unknown
  serverBack?(): unknown
  snapshot?(view: SnapshotView<S>): unknown
  hostAway?(): unknown
  hostBack?(): unknown
  canAct?(canAct: boolean): unknown
  refused?(actionNumber: number): unknown
  joinRequest?(request: JoinRequestAnswer): unknown
  requestEnded?(number: number): unknown
  rulesError?(): unknown
  cannotStart?(): unknown
}

export type Phase = 'none' | 'starting' | 'recovering' | 'hosting' | 'joining' | 'waiting' | 'joined' | 'returning' | 'playing' | 'hostAway'

export type ActProblem = 'cannot act' | 'not an action' | 'too large'

export interface Netcode<A extends Json = Json> {
  readonly phase: Phase
  parseCode(text: string): string | null
  start(): void
  enter(code: string): void
  leave(): void
  startMatch(): void
  act(action: A): ActProblem | null
  roomTime(): number | null
}

export interface Clock {
  now(): number
  setTimeout(callback: () => void, milliseconds: number): unknown
  clearTimeout(timer: unknown): void
}

export interface Visibility {
  readonly hidden: boolean
  onChange(listener: () => void): void
}

export interface Environment {
  readonly rooms: Rooms
  readonly clock: Clock
  readonly visibility: Visibility
  random(): number
}
