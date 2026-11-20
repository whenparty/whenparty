import type {JoinRequest, Visibility as RoomsVisibility} from '@whenparty/rooms'
import type {Clock, Context, Json, JoinRequestAnswer, MatchId, PresenceEvent, Snapshot} from './api.ts'
import {isRecord, isWhole} from './json.ts'
import type {TitleRules} from './rules.ts'
import {matchOf, parseSnapshot, sameVersions, snapshotJson, versionsOf, type Versions} from './snapshot.ts'
import {RoomTime} from './time.ts'

const numberMax = 2 ** 53 - 1
const timerMax = 2 ** 31 - 1
const batchMax = 100
const writeEveryMs = 5_000
const hostNumber = 1

interface Presence {
  lost: boolean
  hidden: boolean
}

type Skip = {readonly kind: 'none'} | {readonly kind: 'upTo'; readonly time: number} | {readonly kind: 'all'}

export interface HostPort {
  readonly rules: TitleRules
  readonly versions: Versions
  readonly clock: Clock
  random(): number
  hostHidden(): boolean
  send(text: string): void
  sendTo(number: number, text: string): void
  write(data: Json): void
  snapshot(snapshot: Snapshot): void
  canAct(canAct: boolean): void
  refused(number: number): void
  joinRequest(request: JoinRequestAnswer): void
  requestEnded(number: number): void
  rulesError(): void
  cannotStart(): void
}

export class Host {
  readonly #port: HostPort
  readonly #rules: TitleRules
  #term = 0
  #state: Json | null = null
  #running = false
  #match: MatchId = {term: 0, number: 0}
  #seats: (number | null)[]
  #queue: number[] = []
  #accepted = new Map<number, number>()
  #snapshotNumber = 0
  readonly #presence = new Map<number, Presence>()
  #hostHidden: boolean
  #skip: Skip = {kind: 'none'}
  #timer: unknown = null
  #writeTimer: unknown = null
  readonly #asked = new Map<number, JoinRequest>()
  #time: RoomTime | null = null
  #recovering: boolean
  #record: unknown
  #last: Snapshot | null = null
  #canAct = false
  #disposed = false
  #failuresInChange = 0
  #sweepAll = false
  readonly #seated = new Set<number>()

  private constructor(port: HostPort, recovering: boolean, record: unknown) {
    this.#port = port
    this.#rules = port.rules
    this.#seats = port.rules.seats.map(() => null)
    this.#hostHidden = port.hostHidden()
    this.#recovering = recovering
    this.#record = record
  }

  static started(port: HostPort, term: number): Host {
    const host = new Host(port, false, undefined)
    host.#term = term
    host.#match = {term, number: 0}
    host.#time = new RoomTime(port.clock, 0)
    host.#seats[0] = hostNumber
    if (port.rules.lobby !== null) {
      host.#state = port.rules.lobby
      host.#sweepAll = true
    }
    host.#change(true)
    host.#scheduleWrite()
    return host
  }

  static recovering(port: HostPort, record: unknown): Host {
    return new Host(port, true, record)
  }

  get recovering(): boolean {
    return this.#recovering
  }

  dispose(): void {
    this.#disposed = true
    this.#port.clock.clearTimeout(this.#timer)
    this.#port.clock.clearTimeout(this.#writeTimer)
  }

  roomTime(): number | null {
    return this.#recovering ? null : this.#readTime()
  }

  #readTime(): number {
    return this.#time?.read() ?? 0
  }

  #seatOf(number: number): number {
    return this.#seats.indexOf(number)
  }

  #outside(): boolean {
    return this.#running || this.#rules.hasLobby
  }

  #context(roomTime = this.#readTime()): Context {
    const seats: {[seat: string]: {taken: boolean; lost: boolean; hidden: boolean}} = {}
    this.#rules.seats.forEach((seat, index) => {
      const number = this.#seats[index] ?? null
      const presence = number === null ? undefined : this.#presence.get(number)
      seats[seat] = {
        taken: number !== null,
        lost: number !== null && number !== hostNumber && (presence?.lost ?? false),
        hidden: number === hostNumber ? this.#hostHidden : (presence?.hidden ?? false)
      }
    })
    return {roomTime, matchRuns: this.#running, seats}
  }

  #playersOf(): string[] {
    return this.#rules.seats.filter((_, index) => this.#seats[index] !== null)
  }

  #snapshot(roomTime: number): Snapshot {
    return {
      versions: this.#port.versions,
      state: this.#state,
      running: this.#running,
      match: this.#match,
      seats: [...this.#seats],
      queue: [...this.#queue],
      accepted: [...this.#accepted.entries()].sort(([a], [b]) => a - b),
      roomTime,
      term: this.#term,
      number: this.#snapshotNumber
    }
  }

  #recordData(roomTime = this.#readTime()): Json {
    return {versions: [...this.#port.versions], snapshot: this.#last === null ? null : snapshotJson(this.#last), time: roomTime}
  }

  #fillSeats(): void {
    this.#seats.forEach((number, index) => {
      if (number === null && this.#queue.length > 0) {
        const taker = this.#queue.shift() ?? null
        this.#seats[index] = taker
        if (taker !== null) {
          this.#seated.add(taker)
        }
      }
    })
  }

  #isLost(number: number): boolean {
    return number !== hostNumber && (this.#presence.get(number)?.lost ?? false)
  }

  #isHidden(number: number): boolean {
    return number === hostNumber ? this.#hostHidden : (this.#presence.get(number)?.hidden ?? false)
  }

  #sweep(): void {
    const sweepAll = this.#sweepAll
    const seated = new Set(this.#seated)
    this.#sweepAll = false
    this.#seated.clear()
    if (this.#running || !this.#rules.hasLobby) {
      return
    }
    const swept = this.#seats.filter((number): number is number => number !== null && (sweepAll || seated.has(number)))
    for (const number of swept.filter(each => this.#isLost(each))) {
      this.#callPresence(number, 'lost')
    }
    for (const number of swept.filter(each => this.#isHidden(each))) {
      this.#callPresence(number, 'hidden')
    }
  }

  #commit(checkOver: boolean, roomTime: number): void {
    if (this.#running && checkOver && this.#state !== null && this.#rules.over(this.#state)) {
      this.#running = false
    }
    if (!this.#running) {
      this.#fillSeats()
    }
    this.#sweep()
    this.#snapshotNumber += 1
    this.#skip = {kind: 'none'}
    const snapshot = this.#snapshot(roomTime)
    this.#last = snapshot
    this.#port.write(this.#recordData(roomTime))
    this.#port.send(JSON.stringify(snapshotJson(snapshot)))
    this.#port.snapshot(snapshot)
    this.#tellFailuresInChange()
    this.#updateCanAct()
  }

  #tellFailuresInChange(): void {
    const failures = this.#failuresInChange
    this.#failuresInChange = 0
    for (let told = 0; told < failures; told += 1) {
      this.#port.rulesError()
    }
  }

  #change(checkOver: boolean): void {
    this.#commit(checkOver, this.#readTime())
    this.#setTimer()
  }

  #updateCanAct(): void {
    const canAct =
      !this.#recovering && this.#outside() && this.#seatOf(hostNumber) >= 0 && (this.#accepted.get(hostNumber) ?? 0) < numberMax
    if (canAct !== this.#canAct) {
      this.#canAct = canAct
      this.#port.canAct(canAct)
    }
  }

  get canAct(): boolean {
    return this.#canAct
  }

  #scheduleWrite(): void {
    this.#writeTimer = this.#port.clock.setTimeout(() => {
      if (!this.#disposed) {
        this.#port.write(this.#recordData())
        this.#scheduleWrite()
      }
    }, writeEveryMs)
  }

  #deadlinesOf(state: Json, timeRead: number): readonly number[] | undefined {
    return this.#rules.deadlines(state, timeRead + timerMax)
  }

  #earliest(times: readonly number[]): number | undefined {
    const skip = this.#skip
    const open = times.filter(time => skip.kind === 'none' || (skip.kind === 'upTo' && time > skip.time))
    return open.length === 0 ? undefined : Math.min(...open)
  }

  #armTimer(times: readonly number[] | undefined): void {
    this.#port.clock.clearTimeout(this.#timer)
    this.#timer = null
    const due = times === undefined || !this.#running || this.#disposed ? undefined : this.#earliest(times)
    if (due === undefined) {
      return
    }
    this.#timer = this.#port.clock.setTimeout(
      () => {
        this.#timer = null
        if (!this.#disposed) {
          this.#batch()
        }
      },
      Math.max(0, due - this.#readTime())
    )
  }

  #setTimer(): void {
    if (!this.#running || this.#recovering || this.#disposed || this.#state === null) {
      this.#armTimer(undefined)
      return
    }
    const times = this.#deadlinesOf(this.#state, this.#readTime())
    if (times === undefined) {
      this.#port.rulesError()
      this.#skip = {kind: 'all'}
    }
    this.#armTimer(times)
  }

  #batch(): void {
    if (!this.#running) {
      return
    }
    const time = this.#readTime()
    let given = 0
    let times: readonly number[] | undefined
    while (this.#running && this.#state !== null) {
      times = this.#deadlinesOf(this.#state, time)
      if (times === undefined) {
        this.#port.rulesError()
        this.#skip = given === batchMax ? {kind: 'upTo', time} : {kind: 'all'}
        break
      }
      const due = this.#earliest(times)
      if (due === undefined || due > time) {
        break
      }
      if (given === batchMax) {
        this.#port.rulesError()
        this.#skip = {kind: 'upTo', time}
        break
      }
      const next = this.#rules.deadline(this.#state, due, this.#port.random(), this.#context(time))
      const after = next === undefined ? undefined : this.#deadlinesOf(next, time)
      if (next === undefined || (after !== undefined && after.some(later => later <= due))) {
        this.#port.rulesError()
        this.#skip = {kind: 'upTo', time: due}
        break
      }
      given += 1
      this.#state = next
      this.#commit(true, time)
    }
    this.#armTimer(times)
  }

  #beforeChange(): void {
    if (this.#running) {
      this.#batch()
    }
  }

  #callPresence(number: number, event: PresenceEvent): boolean {
    const seat = this.#seatOf(number)
    if (!this.#outside() || seat < 0 || this.#state === null) {
      return false
    }
    const next = this.#rules.presence(this.#state, this.#rules.seats[seat] ?? '', event, this.#context())
    if (next === undefined) {
      this.#failuresInChange += 1
      return false
    }
    this.#state = next
    return true
  }

  #presenceChange(number: number, event: PresenceEvent, update: () => void): boolean {
    const calls = this.#outside() && this.#seatOf(number) >= 0 && this.#rules.hasPresence
    if (calls) {
      this.#beforeChange()
    }
    update()
    if (!calls) {
      return false
    }
    if (!this.#callPresence(number, event)) {
      this.#tellFailuresInChange()
      return false
    }
    this.#change(true)
    return true
  }

  #presenceOf(number: number): Presence {
    let presence = this.#presence.get(number)
    if (presence === undefined) {
      presence = {lost: false, hidden: false}
      this.#presence.set(number, presence)
    }
    return presence
  }

  joined(number: number, visibility: RoomsVisibility): void {
    if (this.#recovering) {
      return
    }
    this.#presence.set(number, {lost: false, hidden: visibility === 'hidden'})
    if (this.#seatOf(number) >= 0 || this.#queue.includes(number)) {
      this.#sendLast(number)
      return
    }
    this.#beforeChange()
    const free = this.#seats.indexOf(null)
    if (!this.#running && free >= 0) {
      this.#seats[free] = number
      this.#seated.add(number)
    } else {
      this.#queue.push(number)
    }
    this.#change(true)
  }

  back(number: number, visibility: RoomsVisibility): void {
    if (this.#recovering) {
      return
    }
    const presence = this.#presenceOf(number)
    const backChanged = this.#presenceChange(number, 'back', () => (presence.lost = false))
    const visibleChanged = this.#presenceChange(number, visibility, () => (presence.hidden = visibility === 'hidden'))
    if (!backChanged && !visibleChanged) {
      this.#sendLast(number)
    }
  }

  lost(number: number): void {
    const presence = this.#presenceOf(number)
    this.#presenceChange(number, 'lost', () => (presence.lost = true))
  }

  visibility(number: number, visibility: RoomsVisibility): void {
    const presence = this.#presenceOf(number)
    this.#presenceChange(number, visibility, () => (presence.hidden = visibility === 'hidden'))
  }

  hostVisibility(): void {
    if (this.#recovering) {
      return
    }
    const hidden = this.#port.hostHidden()
    if (hidden) {
      this.#port.write(this.#recordData())
    }
    this.#presenceChange(hostNumber, hidden ? 'hidden' : 'visible', () => (this.#hostHidden = hidden))
  }

  #leave(number: number, callPresence: boolean): boolean {
    const seat = this.#seatOf(number)
    let ended = false
    let reset = false
    if (callPresence && this.#outside() && seat >= 0) {
      if (!this.#rules.hasPresence || !this.#callPresence(number, 'left')) {
        ended = this.#running
        this.#running = false
        reset = this.#rules.hasLobby
      }
    }
    if (seat >= 0) {
      this.#seats[seat] = null
    }
    if (reset) {
      this.#state = this.#rules.lobby
      this.#sweepAll = true
    }
    this.#queue = this.#queue.filter(each => each !== number)
    this.#accepted.delete(number)
    this.#presence.delete(number)
    return ended
  }

  left(number: number): void {
    if (this.#recovering || (this.#seatOf(number) < 0 && !this.#queue.includes(number))) {
      return
    }
    this.#beforeChange()
    const ended = this.#leave(number, true)
    this.#change(!ended)
  }

  startMatch(): void {
    if (this.#recovering) {
      return
    }
    if (this.#running) {
      this.#port.cannotStart()
      return
    }
    const players = this.#playersOf()
    const allowed = this.#rules.hasCanStart
      ? this.#rules.canStart(this.#state, players, this.#match.number)
      : players.length === this.#rules.seats.length
    if (!allowed) {
      this.#port.cannotStart()
      return
    }
    const initial = this.#rules.initialState(this.#port.random(), this.#context(), this.#state)
    if (initial === undefined) {
      this.#port.rulesError()
      this.#port.cannotStart()
      return
    }
    this.#state = initial
    this.#running = true
    this.#match = {term: this.#term, number: this.#match.number + 1}
    this.#seats.forEach(number => {
      if (number !== null && number !== hostNumber && this.#presence.get(number)?.lost && this.#rules.hasPresence) {
        this.#callPresence(number, 'lost')
      }
    })
    this.#seats.forEach(number => {
      const hidden = number === hostNumber ? this.#hostHidden : number !== null && this.#presence.get(number)?.hidden
      if (number !== null && hidden && this.#rules.hasPresence) {
        this.#callPresence(number, 'hidden')
      }
    })
    this.#change(true)
  }

  #sendLast(number: number): void {
    if (this.#last !== null) {
      this.#port.sendTo(number, JSON.stringify(snapshotJson(this.#last)))
    }
  }

  action(from: number, number: number, match: MatchId, action: Json): void {
    if (this.#recovering) {
      return
    }
    if (number <= (this.#accepted.get(from) ?? 0)) {
      this.#sendLast(from)
      return
    }
    this.#beforeChange()
    const seat = this.#seatOf(from)
    const judged =
      seat >= 0 &&
      this.#outside() &&
      this.#state !== null &&
      match.term === this.#match.term &&
      match.number === this.#match.number &&
      this.#rules.isAction(action)
    const next =
      judged && this.#state !== null
        ? this.#rules.step(this.#state, this.#rules.seats[seat] ?? '', action, this.#port.random(), this.#context())
        : null
    if (next === undefined) {
      this.#port.rulesError()
    }
    if (next === null || next === undefined) {
      if (from === hostNumber) {
        this.#port.refused(number)
      } else {
        this.#port.sendTo(from, JSON.stringify({t: 'refused', n: number}))
      }
      return
    }
    this.#state = next
    this.#accepted.set(from, number)
    this.#change(true)
  }

  ownAction(action: Json): void {
    this.action(hostNumber, (this.#accepted.get(hostNumber) ?? 0) + 1, this.#match, action)
  }

  joinRequest(request: JoinRequest): void {
    const versions = versionsOf(request.joinData)
    if (versions === null) {
      request.refuse()
      return
    }
    if (!sameVersions(versions, this.#port.versions)) {
      request.refuse({versions: [...this.#port.versions]})
      return
    }
    if (this.#match.number === 0) {
      if (this.#rules.admit(request.number)) {
        request.letIn()
      } else {
        request.refuse()
      }
      return
    }
    this.#asked.set(request.number, request)
    const answer = (letIn: boolean) => () => {
      const asked = this.#asked.get(request.number)
      if (asked === undefined || this.#disposed) {
        return
      }
      this.#asked.delete(request.number)
      if (letIn) {
        asked.letIn()
      } else {
        asked.refuse()
      }
    }
    this.#port.joinRequest({number: request.number, letIn: answer(true), refuse: answer(false)})
  }

  requestEnded(number: number): void {
    if (this.#asked.delete(number)) {
      this.#port.requestEnded(number)
    }
  }

  endRecovery(term: number, roster: readonly number[]): void {
    if (!this.#recovering) {
      return
    }
    this.#recovering = false
    this.#term = term
    this.#hostHidden = this.#port.hostHidden()
    const record = isRecord(this.#record) ? this.#record : {}
    const recordVersions = versionsOf(record)
    const recordTime = isWhole(record.time, 0, 2 ** 53 - 1) ? record.time : 0
    const usable =
      recordVersions !== null && sameVersions(recordVersions, this.#port.versions)
        ? parseSnapshot(record.snapshot, this.#rules.seats.length, state => this.#rules.isState(state))
        : null
    const usableForTitle = usable !== null && usable.state === null && this.#rules.hasLobby ? null : usable
    const members = [...new Set(roster)].filter(number => number !== hostNumber).sort((a, b) => a - b)
    if (usableForTitle !== null) {
      const usable = usableForTitle
      this.#state = usable.state
      this.#running = usable.running
      this.#match = usable.match
      this.#seats = [...usable.seats]
      this.#queue = [...usable.queue]
      this.#accepted = new Map(usable.accepted)
      this.#time = new RoomTime(this.#port.clock, Math.max(recordTime, usable.roomTime))
    } else {
      const recordMatch = isRecord(record.snapshot) ? matchOf(record.snapshot.match) : null
      this.#state = this.#rules.lobby
      this.#running = false
      this.#match = {term, number: recordMatch?.number ?? 0}
      this.#seats = this.#rules.seats.map(() => null)
      this.#queue = []
      this.#accepted = new Map()
      this.#time = new RoomTime(this.#port.clock, recordTime)
      this.#seats[0] = hostNumber
      for (const number of members) {
        const free = this.#seats.indexOf(null)
        if (free >= 0) {
          this.#seats[free] = number
        } else {
          this.#queue.push(number)
        }
      }
    }
    let ended = false
    const present = [...this.#seats, ...this.#queue].filter((number): number is number => number !== null && number !== hostNumber)
    for (const number of present.filter(each => !members.includes(each)).sort((a, b) => a - b)) {
      ended = this.#leave(number, !ended || this.#rules.hasLobby) || ended
    }
    for (const number of members) {
      if (this.#seatOf(number) < 0 && !this.#queue.includes(number)) {
        this.#queue.push(number)
      }
      this.#presence.set(number, {lost: true, hidden: false})
    }
    if (this.#outside() && this.#rules.hasPresence) {
      this.#seats.forEach(number => {
        if (number !== null && number !== hostNumber && members.includes(number)) {
          this.#callPresence(number, 'lost')
        }
      })
      this.#callPresence(hostNumber, this.#hostHidden ? 'hidden' : 'visible')
    }
    this.#snapshotNumber = 0
    this.#sweepAll = false
    this.#seated.clear()
    this.#commit(!ended, this.#readTime())
    this.#scheduleWrite()
    this.#batch()
  }
}
