import type {Ending, Failure, JoinRequest, Json, Room, RoomHandlers, Rooms, Visibility as RoomsVisibility} from '@whenparty/rooms'
import type {Clock, Visibility} from '../api.ts'

interface Timer {
  readonly id: number
  readonly at: number
  readonly callback: () => void
}

export class FakeClock implements Clock {
  #now = 1_000_000
  #monotonic = 0
  #next = 1
  #timers: Timer[] = []

  now(): number {
    return this.#now
  }

  setTimeout(callback: () => void, milliseconds: number): unknown {
    const id = this.#next++
    this.#timers.push({id, at: this.#monotonic + milliseconds, callback})
    return id
  }

  clearTimeout(timer: unknown): void {
    this.#timers = this.#timers.filter(each => each.id !== timer)
  }

  advance(milliseconds: number): void {
    const end = this.#monotonic + milliseconds
    for (;;) {
      const due = this.#timers.filter(timer => timer.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0]
      if (due === undefined) {
        break
      }
      this.#timers = this.#timers.filter(timer => timer !== due)
      if (due.at > this.#monotonic) {
        this.#now += due.at - this.#monotonic
        this.#monotonic = due.at
      }
      due.callback()
    }
    this.#now += end - this.#monotonic
    this.#monotonic = end
  }

  jump(milliseconds: number): void {
    this.#now += milliseconds
  }

  get pending(): number {
    return this.#timers.length
  }
}

export class FakeVisibility implements Visibility {
  hidden = false
  readonly #listeners: (() => void)[] = []

  onChange(listener: () => void): void {
    this.#listeners.push(listener)
  }

  set(hidden: boolean): void {
    this.hidden = hidden
    for (const listener of this.#listeners) {
      listener()
    }
  }
}

export type Kind = 'create' | 'join' | 'return'

export type RoomCall = readonly ['send', string] | readonly ['sendTo', number, string] | readonly ['write', Json]

export class FakeRoom implements Room {
  readonly kind: Kind
  readonly handlers: RoomHandlers
  readonly sent: string[] = []
  readonly sentTo: (readonly [number, string])[] = []
  readonly writes: Json[] = []
  readonly calls: RoomCall[] = []
  record: Json | undefined = undefined
  failWrites = false
  left = false

  constructor(kind: Kind, handlers: RoomHandlers) {
    this.kind = kind
    this.handlers = handlers
  }

  send(text: unknown): boolean {
    this.sent.push(String(text))
    this.calls.push(['send', String(text)])
    return true
  }

  sendTo(number: number, text: unknown): boolean {
    this.sentTo.push([number, String(text)])
    this.calls.push(['sendTo', number, String(text)])
    return true
  }

  setRecordData(data: unknown): boolean {
    this.writes.push(data as Json)
    this.calls.push(['write', data as Json])
    if (!this.failWrites) {
      this.record = data as Json
    }
    return true
  }

  leave(): void {
    this.left = true
  }
}

const codeLetters = /^[23456789BCDFGHJKMNPQRSTVWXYZ]{5}$/

export class FakeRooms implements Rooms {
  readonly rooms: FakeRoom[] = []
  readonly calls: {
    readonly kind: Kind
    readonly appId: string
    readonly code?: string
    readonly joinData?: unknown
    readonly waitingSeconds?: number | null
  }[] = []
  refuseCalls = false

  get last(): FakeRoom {
    const room = this.rooms.at(-1)
    if (room === undefined) {
      throw new Error('no room yet')
    }
    return room
  }

  get on(): Required<RoomHandlers> {
    return this.last.handlers as Required<RoomHandlers>
  }

  parseCode(text: string): string | null {
    const code = text.replace(/[\s-]/gu, '').replace(/[a-z]/g, letter => letter.toUpperCase())
    return codeLetters.test(code) ? code : null
  }

  #room(kind: Kind, handlers: RoomHandlers): Room | null {
    if (this.refuseCalls) {
      return null
    }
    const room = new FakeRoom(kind, handlers)
    this.rooms.push(room)
    return room
  }

  create(appId: string, waitingSeconds: number | null, handlers: RoomHandlers): Room | null {
    this.calls.push({kind: 'create', appId, waitingSeconds})
    return this.#room('create', handlers)
  }

  join(appId: string, codeText: string, joinData: unknown, handlers: RoomHandlers): Room | null {
    this.calls.push({kind: 'join', appId, code: codeText, joinData})
    return this.#room('join', handlers)
  }

  return(appId: string, handlers: RoomHandlers): Room | null {
    this.calls.push({kind: 'return', appId})
    return this.#room('return', handlers)
  }
}

export type Answer = 'let in' | 'refuse without data' | 'refuse with the host versions' | 'refuse with data'

export class FakeJoinRequest implements JoinRequest {
  readonly number: number
  readonly joinData: Json
  answers: {readonly answer: Answer; readonly joinData?: unknown}[] = []

  constructor(number: number, joinData: Json) {
    this.number = number
    this.joinData = joinData
  }

  letIn(): boolean {
    this.answers.push({answer: 'let in'})
    return true
  }

  refuse(joinData?: unknown): boolean {
    this.answers.push(joinData === undefined ? {answer: 'refuse without data'} : {answer: 'refuse with data', joinData})
    return true
  }
}

export type {Ending, Failure, RoomsVisibility}
