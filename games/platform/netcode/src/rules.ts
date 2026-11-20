import type {Context, Json, PresenceEvent, Rules, Title} from './api.ts'
import {copy, isWhole, isWithin, readBack, valueBytes} from './json.ts'

const required = ['seats', 'initialState', 'step', 'over', 'isAction', 'isState'] as const
const optional = ['presence', 'deadlines', 'deadline', 'admit', 'canStart', 'lobby'] as const

export const roomTimeMax = 2 ** 53 - 1
const deadlinesMax = 64

const isSeatName = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value.isWellFormed()) {
    return false
  }
  const points = [...value].length
  return points >= 1 && points <= 16
}

export interface Checked {
  readonly seats: readonly string[]
  readonly lobby: Json | null
}

const lobbyOf = (rules: Rules, seats: readonly string[]): Json | null | undefined => {
  const lobby = rules.lobby
  if (lobby === undefined) {
    return null
  }
  try {
    const back = readBack(lobby.call(rules))
    if (back === null || back.value === null || !isWithin(back.json, valueBytes)) {
      return undefined
    }
    return new TitleRules(rules, seats, null).isState(back.value) ? back.value : undefined
  } catch {
    return undefined
  }
}

export const checkRules = (title: Title): Checked | null => {
  const seats = seatsOf(title)
  if (seats === null) {
    return null
  }
  const lobby = lobbyOf(title.rules, seats)
  return lobby === undefined ? null : {seats, lobby}
}

export const seatsOf = (title: Title): readonly string[] | null => {
  const rules = title.rules as unknown as {readonly [name: string]: unknown} | null
  if (typeof rules !== 'object' || rules === null || !isWhole(title.formatVersion, 1, 1_000_000)) {
    return null
  }
  if (required.some(name => typeof rules[name] !== 'function')) {
    return null
  }
  if (optional.some(name => rules[name] !== undefined && typeof rules[name] !== 'function')) {
    return null
  }
  if (rules.deadlines !== undefined && rules.deadline === undefined) {
    return null
  }
  if (rules.lobby !== undefined && rules.presence === undefined) {
    return null
  }
  let seats: unknown
  try {
    seats = title.rules.seats()
  } catch {
    return null
  }
  if (!Array.isArray(seats) || seats.length < 1 || seats.length > 12 || !seats.every(isSeatName) || new Set(seats).size !== seats.length) {
    return null
  }
  return [...seats]
}

const yes = (answer: () => unknown): boolean => {
  try {
    return answer() === true
  } catch {
    return false
  }
}

export class TitleRules {
  readonly #rules: Rules
  readonly seats: readonly string[]
  readonly lobby: Json | null

  constructor(rules: Rules, seats: readonly string[], lobby: Json | null) {
    this.#rules = rules
    this.seats = seats
    this.lobby = lobby
  }

  get hasLobby(): boolean {
    return this.lobby !== null
  }

  get hasPresence(): boolean {
    return this.#rules.presence !== undefined
  }

  get hasCanStart(): boolean {
    return this.#rules.canStart !== undefined
  }

  isState(value: Json): boolean {
    return yes(() => this.#rules.isState(copy(value)))
  }

  isAction(value: Json): boolean {
    return yes(() => this.#rules.isAction(copy(value)))
  }

  over(state: Json): boolean {
    return yes(() => this.#rules.over(copy(state)))
  }

  admit(number: number): boolean {
    const admit = this.#rules.admit
    return admit === undefined || yes(() => admit.call(this.#rules, number))
  }

  canStart(lastState: Json | null, seatsWithPlayers: readonly string[], matchNumber: number): boolean {
    const canStart = this.#rules.canStart
    return (
      canStart !== undefined &&
      yes(() => canStart.call(this.#rules, lastState === null ? null : copy(lastState), [...seatsWithPlayers], matchNumber))
    )
  }

  #state(make: () => unknown): Json | undefined {
    try {
      const back = readBack(make())
      if (back === null || back.value === null || !isWithin(back.json, valueBytes) || !this.isState(back.value)) {
        return undefined
      }
      return back.value
    } catch {
      return undefined
    }
  }

  initialState(random: number, context: Context, lastState: Json | null): Json | undefined {
    return this.#state(() => this.#rules.initialState(random, context, lastState === null ? null : copy(lastState)))
  }

  step(state: Json, seat: string, action: Json, random: number, context: Context): Json | null | undefined {
    let result: unknown
    try {
      result = this.#rules.step(copy(state), seat, copy(action), random, context)
    } catch {
      return undefined
    }
    return result === null ? null : this.#state(() => result)
  }

  presence(state: Json, seat: string, event: PresenceEvent, context: Context): Json | undefined {
    const presence = this.#rules.presence
    return presence === undefined ? undefined : this.#state(() => presence.call(this.#rules, copy(state), seat, event, context))
  }

  deadline(state: Json, time: number, random: number, context: Context): Json | undefined {
    const deadline = this.#rules.deadline
    return deadline === undefined ? undefined : this.#state(() => deadline.call(this.#rules, copy(state), time, random, context))
  }

  deadlines(state: Json, latest: number): readonly number[] | undefined {
    const deadlines = this.#rules.deadlines
    if (deadlines === undefined) {
      return []
    }
    let back
    try {
      back = readBack(deadlines.call(this.#rules, copy(state)))
    } catch {
      return undefined
    }
    const times = back?.value
    if (!Array.isArray(times) || times.length > deadlinesMax || !times.every(time => isWhole(time, 0, roomTimeMax) && time <= latest)) {
      return undefined
    }
    return times as readonly number[]
  }
}
