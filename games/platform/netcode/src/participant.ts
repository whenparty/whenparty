import type {ActProblem, Clock, Json, MatchId, Snapshot} from './api.ts'
import {isWithin, readBack, valueBytes} from './json.ts'
import type {TitleRules} from './rules.ts'
import {acceptedOf, isNewer, type Versions} from './snapshot.ts'
import {RoomTime} from './time.ts'

const numberMax = 2 ** 53 - 1

interface Awaiting {
  readonly number: number
  readonly match: MatchId
  readonly action: Json
}

export interface ParticipantPort {
  readonly rules: TitleRules
  readonly versions: Versions
  readonly clock: Clock
  send(text: string): void
  write(data: Json): void
  canAct(canAct: boolean): void
}

export type Arrival = 'taken' | 'equal' | 'dropped'

export class Participant {
  readonly #port: ParticipantPort
  readonly #time: RoomTime
  number: number
  #recordAction: number
  #last: Snapshot | null = null
  #awaiting: Awaiting | null = null
  #away = false
  #over = false
  #canAct = false

  constructor(port: ParticipantPort, number: number, recordAction: number) {
    this.#port = port
    this.number = number
    this.#recordAction = recordAction
    this.#time = new RoomTime(port.clock, 0)
  }

  get last(): Snapshot | null {
    return this.#last
  }

  get away(): boolean {
    return this.#away
  }

  roomTime(): number | null {
    return this.#last === null ? null : this.#time.read()
  }

  seatOf(snapshot: Snapshot): string | null {
    const index = snapshot.seats.indexOf(this.number)
    return index < 0 ? null : (this.#port.rules.seats[index] ?? null)
  }

  #nextNumber(): number {
    return Math.max(this.#recordAction, this.#last === null ? 0 : acceptedOf(this.#last, this.number)) + 1
  }

  #computeCanAct(): boolean {
    const last = this.#last
    return (
      !this.#over &&
      last !== null &&
      (last.running || this.#port.rules.hasLobby) &&
      this.seatOf(last) !== null &&
      !this.#away &&
      this.#awaiting === null &&
      this.#nextNumber() <= numberMax
    )
  }

  updateCanAct(): void {
    const canAct = this.#computeCanAct()
    if (canAct !== this.#canAct) {
      this.#canAct = canAct
      this.#port.canAct(canAct)
    }
  }

  arrive(snapshot: Snapshot): Arrival {
    if (this.#last === null || isNewer(snapshot, this.#last)) {
      this.#last = snapshot
      this.#time.set(snapshot.roomTime)
      if (this.#awaiting !== null && acceptedOf(snapshot, this.number) >= this.#awaiting.number) {
        this.#awaiting = null
      }
      return 'taken'
    }
    return snapshot.term === this.#last.term && snapshot.number === this.#last.number ? 'equal' : 'dropped'
  }

  goAway(): void {
    this.#away = true
    this.#time.stop()
    this.updateCanAct()
  }

  comeBack(): void {
    this.#away = false
    this.#time.goOn()
    const awaiting = this.#awaiting
    if (awaiting !== null && this.#last !== null && acceptedOf(this.#last, this.number) < awaiting.number) {
      this.#sendAction(awaiting)
    }
    this.updateCanAct()
  }

  refused(number: number): boolean {
    if (this.#awaiting?.number !== number) {
      return false
    }
    this.#awaiting = null
    this.updateCanAct()
    return true
  }

  end(): void {
    this.#over = true
  }

  #sendAction(awaiting: Awaiting): void {
    this.#port.send(
      JSON.stringify({t: 'action', n: awaiting.number, match: [awaiting.match.term, awaiting.match.number], action: awaiting.action})
    )
  }

  act(action: unknown): ActProblem | null {
    const last = this.#last
    if (!this.#computeCanAct() || last === null) {
      return 'cannot act'
    }
    const back = readBack(action)
    if (back === null || back.value === null || !this.#port.rules.isAction(back.value)) {
      return 'not an action'
    }
    if (!isWithin(back.json, valueBytes)) {
      return 'too large'
    }
    const number = this.#nextNumber()
    this.#recordAction = number
    this.#port.write({versions: [...this.#port.versions], action: number})
    this.#awaiting = {number, match: last.match, action: back.value}
    this.#sendAction(this.#awaiting)
    this.updateCanAct()
    return null
  }
}
