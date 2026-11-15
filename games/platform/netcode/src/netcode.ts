import type {Ending, Failure as RoomsFailure, Room, RoomHandlers} from '@whenparty/rooms'
import type {ActProblem, End, Environment, Failure, GameHandlers, Json, Netcode, Phase, Snapshot, Title} from './api.ts'
import {Host, type HostPort} from './host.ts'
import {isRecord, isWithin, readBack, valueBytes} from './json.ts'
import {Participant, type ParticipantPort} from './participant.ts'
import {seatsOf, TitleRules} from './rules.ts'
import {isActionNumber, matchOf, olderOf, parseSnapshot, protocolVersion, sameVersions, versionsOf, type Versions} from './snapshot.ts'

const hostNumber = 1

const callSafely = <A extends unknown[]>(handler: ((...args: A) => unknown) | undefined, ...args: A): void => {
  if (handler === undefined) {
    return
  }
  try {
    const result = handler(...args)
    if (typeof (result as PromiseLike<unknown> | null)?.then === 'function') {
      Promise.resolve(result).catch(() => {})
    }
  } catch {
    return
  }
}

const sideOf = (older: 'page' | 'server' | 'owner'): 'page' | 'server' => (older === 'server' ? 'server' : 'page')

const startFailure = (failure: RoomsFailure): Failure => {
  switch (failure.reason) {
    case 'outdated':
      return {cause: 'outdated', older: failure.older}
    case 'refused':
      return {cause: 'refused'}
    default:
      return {cause: failure.reason}
  }
}

const entryFailure = (failure: RoomsFailure, own: Versions): Failure => {
  if (failure.reason === 'refused') {
    const versions = versionsOf(failure.joinData)
    return versions !== null && !sameVersions(versions, own) ? {cause: 'other version', older: olderOf(own, versions)} : {cause: 'refused'}
  }
  return startFailure(failure)
}

const endOf = (ending: Ending): End =>
  ending.reason === 'outdated' ? {cause: 'outdated', older: sideOf(ending.older)} : {cause: ending.reason}

const failureOfEnding = (ending: Ending): Failure => {
  switch (ending.reason) {
    case 'room closed':
    case 'idle':
      return {cause: 'no room'}
    case 'owner away':
      return {cause: 'owner away'}
    case 'outdated':
      return {cause: 'outdated', older: sideOf(ending.older)}
    default:
      return {cause: 'unreachable'}
  }
}

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

class Game {
  phase: Phase
  readonly #page: NetcodePage
  readonly #rules: TitleRules
  readonly #versions: Versions
  #room: Room | null = null
  #host: Host | null = null
  #participant: Participant | null = null
  #done = false
  #ownerBack = false

  constructor(page: NetcodePage, rules: TitleRules, phase: Phase) {
    this.#page = page
    this.#rules = rules
    this.#versions = [protocolVersion, page.title.formatVersion]
    this.phase = phase
  }

  get #tell(): GameHandlers {
    return this.#page.handlers
  }

  start(): void {
    const {appId, waitingSeconds} = this.#page.title
    this.#attach(this.#page.environment.rooms.create(appId, waitingSeconds, this.#handlers()))
  }

  enter(code: string): void {
    callSafely(this.#tell.entering)
    this.#attach(this.#page.environment.rooms.join(this.#page.title.appId, code, {versions: [...this.#versions]}, this.#handlers()))
  }

  #attach(room: Room | null): void {
    if (this.#done) {
      return
    }
    if (room === null) {
      this.#fail({cause: 'open elsewhere'})
      return
    }
    this.#room = room
  }

  #finish(): void {
    this.#done = true
    this.phase = 'none'
    this.#host?.dispose()
    this.#participant?.end()
    this.#page.finished(this)
  }

  #fail(failure: Failure): void {
    this.#finish()
    callSafely(this.#tell.failed, failure)
  }

  #end(end: End): void {
    this.#finish()
    callSafely(this.#tell.ended, end)
  }

  leave(): void {
    if (this.#done) {
      return
    }
    this.#finish()
    this.#room?.leave()
  }

  #hostPort(): HostPort {
    const tell = this.#tell
    return {
      rules: this.#rules,
      versions: this.#versions,
      clock: this.#page.environment.clock,
      random: () => this.#page.environment.random(),
      hostHidden: () => this.#page.environment.visibility.hidden,
      send: text => this.#room?.send(text),
      sendTo: (number, text) => this.#room?.sendTo(number, text),
      write: data => this.#room?.setRecordData(data),
      snapshot: snapshot => this.#tellSnapshot(snapshot, hostNumber, true),
      canAct: canAct => callSafely(tell.canAct, canAct),
      refused: number => callSafely(tell.refused, number),
      joinRequest: request => callSafely(tell.joinRequest, request),
      requestEnded: number => callSafely(tell.requestEnded, number),
      rulesError: () => callSafely(tell.rulesError),
      cannotStart: () => callSafely(tell.cannotStart)
    }
  }

  #participantPort(): ParticipantPort {
    return {
      rules: this.#rules,
      versions: this.#versions,
      clock: this.#page.environment.clock,
      send: text => this.#room?.send(text),
      write: data => this.#room?.setRecordData(data),
      canAct: canAct => callSafely(this.#tell.canAct, canAct)
    }
  }

  #tellSnapshot(snapshot: Snapshot, participant: number, isHost: boolean): void {
    const index = snapshot.seats.indexOf(participant)
    callSafely(this.#tell.snapshot, {snapshot, participant, seat: index < 0 ? null : (this.#rules.seats[index] ?? null), isHost})
  }

  #handlers(): RoomHandlers {
    const handlers: RoomHandlers = {
      returning: (role, number, recordData) => this.#returning(role, number, recordData),
      created: (code, term) => this.#created(code, term),
      asked: () => this.#wait('decides'),
      waitingForOwner: () => this.#wait('offline'),
      letIn: () => {
        if (this.phase === 'waiting') {
          this.phase = 'joining'
          callSafely(this.#tell.entering)
        }
      },
      joined: number => {
        if (this.phase === 'joining') {
          this.phase = 'joined'
          this.#participant = new Participant(this.#participantPort(), number, 0)
          this.#room?.setRecordData({versions: [...this.#versions]})
        }
      },
      failed: failure => this.#roomsFailed(failure),
      ended: ending => this.#roomEnded(ending),
      ownerLost: () => {
        if (this.phase === 'playing' && this.#participant !== null) {
          this.phase = 'hostAway'
          this.#ownerBack = false
          this.#participant.goAway()
          callSafely(this.#tell.hostAway)
        }
      },
      ownerBack: () => {
        if (this.phase === 'hostAway') {
          this.#ownerBack = true
        }
      },
      ownerReturned: (term, roster) => {
        if (this.phase === 'recovering' && this.#host !== null) {
          this.phase = 'hosting'
          this.#host.endRecovery(term, roster)
        }
      },
      serverLost: () => {
        if (this.phase === 'hosting') {
          callSafely(this.#tell.serverLost)
        }
      },
      serverBack: () => {
        if (this.phase === 'hosting') {
          callSafely(this.#tell.serverBack)
        }
      },
      joinRequest: request => {
        if (this.phase === 'hosting' && this.#host !== null) {
          this.#host.joinRequest(request)
        } else {
          request.refuse()
        }
      },
      requestEnded: number => this.#hosting()?.requestEnded(number),
      participantJoined: (number, visibility) => this.#hosting()?.joined(number, visibility),
      participantBack: (number, visibility) => this.#hosting()?.back(number, visibility),
      visibility: (number, visibility) => this.#hosting()?.visibility(number, visibility),
      participantLost: number => this.#hosting()?.lost(number),
      participantLeft: number => this.#hosting()?.left(number),
      text: (text, from) => (this.#host === null ? this.#participantText(text, from) : this.#hostText(text, from))
    }
    const guarded: {[name: string]: unknown} = {}
    for (const [name, handler] of Object.entries(handlers)) {
      guarded[name] = (...args: unknown[]) => (this.#done ? undefined : (handler as (...args: unknown[]) => unknown)(...args))
    }
    return guarded as RoomHandlers
  }

  #hosting(): Host | null {
    return this.phase === 'hosting' ? this.#host : null
  }

  #returning(role: 'owner' | 'participant', number: number, recordData: Json | undefined): void {
    if (this.phase !== 'joining') {
      return
    }
    if (role === 'owner') {
      this.phase = 'recovering'
      this.#host = Host.recovering(this.#hostPort(), recordData)
      return
    }
    this.phase = 'returning'
    const action = isRecord(recordData) && isActionNumber(recordData.action) ? recordData.action : 0
    this.#participant = new Participant(this.#participantPort(), number, action)
  }

  #created(code: string, term: number): void {
    if (this.phase !== 'starting') {
      return
    }
    this.phase = 'hosting'
    callSafely(this.#tell.code, code)
    this.#host = Host.started(this.#hostPort(), term)
  }

  #wait(host: 'decides' | 'offline'): void {
    if (this.phase === 'returning') {
      this.phase = 'joining'
      this.#participant = null
    }
    if (this.phase === 'joining' || this.phase === 'waiting') {
      this.phase = 'waiting'
      callSafely(this.#tell.waiting, host)
    }
  }

  #roomsFailed(failure: RoomsFailure): void {
    switch (this.phase) {
      case 'starting':
        this.#fail(startFailure(failure))
        return
      case 'joining':
      case 'waiting':
      case 'returning':
      case 'recovering':
        this.#fail(entryFailure(failure, this.#versions))
    }
  }

  #roomEnded(ending: Ending): void {
    switch (this.phase) {
      case 'joined':
      case 'joining':
      case 'waiting':
        this.#fail(failureOfEnding(ending))
        return
      case 'starting':
        return
      default:
        this.#end(endOf(ending))
    }
  }

  #hostText(text: string, from: number): void {
    const host = this.#hosting()
    const value = parsed(text)
    if (host === null || from === hostNumber || !isRecord(value) || value.t !== 'action' || !isActionNumber(value.n)) {
      return
    }
    const match = matchOf(value.match)
    const action = readBack(value.action)
    if (match === null || action === null || action.value === null || !isWithin(action.json, valueBytes)) {
      return
    }
    host.action(from, value.n, match, action.value)
  }

  #participantText(text: string, from: number): void {
    const participant = this.#participant
    if (participant === null || from !== hostNumber || !['joined', 'returning', 'playing', 'hostAway'].includes(this.phase)) {
      return
    }
    const value = parsed(text)
    if (!isRecord(value)) {
      return
    }
    if (value.t === 'snapshot') {
      this.#snapshotArrived(participant, value)
    } else if (value.t === 'refused' && isActionNumber(value.n) && participant.refused(value.n)) {
      callSafely(this.#tell.refused, value.n)
    }
  }

  #snapshotArrived(participant: Participant, value: unknown): void {
    const versions = versionsOf(value)
    if (versions === null) {
      return
    }
    if (!sameVersions(versions, this.#versions)) {
      const older = olderOf(this.#versions, versions)
      const first = this.phase === 'joined'
      this.#finish()
      this.#room?.leave()
      if (first) {
        callSafely(this.#tell.failed, {cause: 'other version', older})
      } else {
        callSafely(this.#tell.ended, {cause: 'other version', older})
      }
      return
    }
    const snapshot = parseSnapshot(value, this.#rules.seats.length, state => this.#rules.isState(state))
    if (snapshot === null) {
      return
    }
    const arrival = participant.arrive(snapshot)
    const returns = this.phase === 'hostAway' && this.#ownerBack
    if (arrival === 'dropped' || (arrival === 'equal' && !returns)) {
      return
    }
    if (this.phase !== 'hostAway' || returns) {
      this.phase = 'playing'
    }
    if (arrival === 'taken') {
      this.#tellSnapshot(snapshot, participant.number, false)
    }
    if (returns) {
      callSafely(this.#tell.hostBack)
      participant.comeBack()
    } else {
      participant.updateCanAct()
    }
  }

  startMatch(): void {
    if (this.phase === 'hosting' || this.phase === 'recovering') {
      this.#host?.startMatch()
    }
  }

  hostVisibility(): void {
    this.#hosting()?.hostVisibility()
  }

  roomTime(): number | null {
    if (this.#host !== null) {
      return this.#host.roomTime()
    }
    return this.#participant?.roomTime() ?? null
  }

  act(action: unknown): ActProblem | null {
    const host = this.#hosting()
    if (host !== null) {
      if (!host.canAct) {
        return 'cannot act'
      }
      const back = readBack(action)
      if (back === null || back.value === null || !this.#rules.isAction(back.value)) {
        return 'not an action'
      }
      if (!isWithin(back.json, valueBytes)) {
        return 'too large'
      }
      host.ownAction(back.value)
      return null
    }
    if (this.#participant !== null && (this.phase === 'playing' || this.phase === 'hostAway')) {
      return this.#participant.act(action)
    }
    return 'cannot act'
  }
}

class NetcodePage implements Netcode {
  readonly title: Title
  readonly handlers: GameHandlers
  readonly environment: Environment
  #game: Game | null = null

  constructor(title: Title, handlers: GameHandlers, environment: Environment) {
    this.title = title
    this.handlers = handlers
    this.environment = environment
    environment.visibility.onChange(() => this.#game?.hostVisibility())
  }

  get phase(): Phase {
    return this.#game?.phase ?? 'none'
  }

  parseCode(text: string): string | null {
    return this.environment.rooms.parseCode(text)
  }

  #begin(phase: Phase): Game | null {
    this.leave()
    const seats = seatsOf(this.title)
    if (seats === null) {
      callSafely(this.handlers.failed, {cause: 'bad rules'})
      return null
    }
    const game = new Game(this, new TitleRules(this.title.rules, seats), phase)
    this.#game = game
    return game
  }

  start(): void {
    this.#begin('starting')?.start()
  }

  enter(code: string): void {
    this.#begin('joining')?.enter(code)
  }

  leave(): void {
    this.#game?.leave()
  }

  finished(game: Game): void {
    if (this.#game === game) {
      this.#game = null
    }
  }

  startMatch(): void {
    this.#game?.startMatch()
  }

  act(action: Json): ActProblem | null {
    return this.#game === null ? 'cannot act' : this.#game.act(action)
  }

  roomTime(): number | null {
    return this.#game?.roomTime() ?? null
  }
}

export const createNetcode = <S extends Json, A extends Json>(
  title: Title<S, A>,
  handlers: GameHandlers<S>,
  environment: Environment
): Netcode<A> => new NetcodePage(title as unknown as Title, handlers as GameHandlers, environment) as Netcode<A>
