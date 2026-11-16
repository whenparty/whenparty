import type {Clock} from '@whenparty/transport'
import type {ServerPart, ServerPartHandlers, ServerPort} from '@whenparty/transport/server'
import {
  codeAlphabet,
  codeLength,
  defaultWaitingSeconds,
  isAppId,
  isCode,
  isJoinData,
  isNumber,
  isWaitingSeconds,
  largestNumber,
  roomsVersion,
  type ServerMessage,
  type SimpleAnswer
} from '../protocol.ts'

const roomLimit = 10
const participantLimit = 12
const askMs = 60_000
const emptyMs = 600_000
const dayMs = 86_400_000

interface Request {
  readonly r: number
  readonly connection: string
}

interface Participant {
  readonly number: number
  state: 'asked' | 'member'
  token: string | null
  peerId: string
  request: Request | null
  timer: unknown
}

interface Room {
  readonly appId: string
  readonly code: string
  readonly waitingSeconds: number
  readonly ownerToken: string
  readonly createdBy: string
  term: number
  ownerPage: string
  ownerConnection: string | null
  readonly participants: Map<number, Participant>
  readonly byToken: Map<string, Participant>
  nextNumber: number
  closed: boolean
  waitTimer: unknown
  emptyTimer: unknown
  dayTimer: unknown
}

type Fields = {readonly [key: string]: unknown}

const isRecord = (value: unknown): value is Fields => typeof value === 'object' && value !== null && !Array.isArray(value)
const isRequestId = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0
const isLeaves = (value: unknown): value is readonly number[] => Array.isArray(value) && value.every(isNumber)

const randomToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

const randomCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(codeLength))
  return Array.from(bytes, byte => codeAlphabet[byte % codeAlphabet.length]).join('')
}

export interface RoomsServerOptions {
  readonly clock?: Clock
}

const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, milliseconds) => globalThis.setTimeout(callback, milliseconds),
  clearTimeout: timer => globalThis.clearTimeout(timer as ReturnType<typeof globalThis.setTimeout>)
}

class RoomsServer implements ServerPartHandlers {
  readonly #port: ServerPort
  readonly #clock: Clock
  readonly #rooms = new Map<string, Room>()
  readonly #waitingJoins = new Map<string, Participant & {readonly room: Room}>()

  constructor(port: ServerPort, clock: Clock) {
    this.#port = port
    this.#clock = clock
  }

  message(peerId: string, message: unknown): void {
    if (!isRecord(message)) {
      return
    }
    switch (message.t) {
      case 'create':
        return this.#create(peerId, message)
      case 'join':
        return this.#join(peerId, message)
      case 'withdraw':
        return this.#withdraw(peerId)
      case 'return':
        return this.#return(peerId, message)
      case 'reconnect':
        return this.#reconnect(peerId, message)
      case 'leave':
        return this.#leave(message)
      case 'admit':
      case 'refuse':
      case 'left':
        return this.#fromOwner(peerId, message)
    }
  }

  closed(peerId: string): void {
    const waiting = this.#waitingJoins.get(peerId)
    if (waiting) {
      this.#endRequest(waiting.room, waiting)
      this.#tellOwner(waiting.room, {t: 'ended', n: waiting.number})
    }
    for (const room of [...this.#rooms.values()]) {
      if (room.ownerConnection === peerId) {
        this.#setOwnerConnection(room, null)
      }
    }
  }

  #key(appId: string, code: string): string {
    return `${appId} ${code}`
  }

  #room(appId: string, code: unknown): Room | undefined {
    return isCode(code) ? this.#rooms.get(this.#key(appId, code)) : undefined
  }

  #send(peerId: string, message: ServerMessage): void {
    this.#port.send(peerId, message)
  }

  #answer(peerId: string, r: number, a: SimpleAnswer): void {
    this.#send(peerId, {t: 'answer', r, a})
  }

  #tellOwner(room: Room, notice: {readonly t: 'ask' | 'ended' | 'named' | 'left' | 'closed'; readonly [key: string]: unknown}): void {
    if (room.ownerConnection !== null) {
      this.#port.send(room.ownerConnection, {...notice, app: room.appId, code: room.code})
    }
  }

  #create(peerId: string, message: Fields): void {
    const {r, app, wait, page} = message
    if (!isRequestId(r) || typeof page !== 'string' || !(wait === null || typeof wait === 'number')) {
      return
    }
    if (!isAppId(app)) {
      return this.#answer(peerId, r, 'bad app')
    }
    if (!isWaitingSeconds(wait)) {
      return this.#answer(peerId, r, 'bad wait')
    }
    const rooms = [...this.#rooms.values()]
    if (rooms.length >= roomLimit || rooms.some(room => room.createdBy === peerId)) {
      return this.#answer(peerId, r, 'busy')
    }
    let code = randomCode()
    while (this.#rooms.has(this.#key(app, code))) {
      code = randomCode()
    }
    const room: Room = {
      appId: app,
      code,
      waitingSeconds: wait ?? defaultWaitingSeconds,
      ownerToken: randomToken(),
      createdBy: peerId,
      term: 1,
      ownerPage: page,
      ownerConnection: peerId,
      participants: new Map(),
      byToken: new Map(),
      nextNumber: 2,
      closed: false,
      waitTimer: null,
      emptyTimer: null,
      dayTimer: null
    }
    room.dayTimer = this.#clock.setTimeout(() => this.#close(room, true), dayMs)
    this.#rooms.set(this.#key(app, code), room)
    this.#send(peerId, {t: 'created', r, code, term: 1, token: room.ownerToken})
  }

  #join(peerId: string, message: Fields): void {
    const {r, app, code, data} = message
    if (!isRequestId(r) || typeof code !== 'string' || !isJoinData(data)) {
      return
    }
    if (!isAppId(app)) {
      return this.#answer(peerId, r, 'bad app')
    }
    const room = this.#room(app, code)
    if (!room) {
      return this.#answer(peerId, r, 'no room')
    }
    if (room.ownerConnection === null) {
      return this.#answer(peerId, r, 'owner away')
    }
    if (room.participants.size + 1 >= participantLimit || room.nextNumber > largestNumber) {
      return this.#answer(peerId, r, 'full')
    }
    if (this.#waitingJoins.has(peerId)) {
      return this.#answer(peerId, r, 'busy')
    }
    const participant: Participant = {
      number: room.nextNumber,
      state: 'asked',
      token: null,
      peerId,
      request: {r, connection: peerId},
      timer: null
    }
    room.nextNumber += 1
    room.participants.set(participant.number, participant)
    this.#waitingJoins.set(peerId, Object.assign(participant, {room}))
    participant.timer = this.#clock.setTimeout(() => {
      this.#endRequest(room, participant)
      this.#send(peerId, {t: 'refused', r})
      this.#tellOwner(room, {t: 'ended', n: participant.number})
    }, askMs)
    this.#tellOwner(room, {t: 'ask', n: participant.number, data})
    this.#send(peerId, {t: 'asked', r})
  }

  #endRequest(room: Room, participant: Participant): void {
    this.#clock.clearTimeout(participant.timer)
    if (participant.request) {
      this.#waitingJoins.delete(participant.request.connection)
    }
    participant.request = null
    room.participants.delete(participant.number)
  }

  #withdraw(peerId: string): void {
    const waiting = this.#waitingJoins.get(peerId)
    if (waiting) {
      this.#endRequest(waiting.room, waiting)
      this.#tellOwner(waiting.room, {t: 'ended', n: waiting.number})
    }
  }

  #fromOwner(peerId: string, message: Fields): void {
    const {app, code, n} = message
    if (!isAppId(app) || !isNumber(n)) {
      return
    }
    const room = this.#room(app, code)
    if (!room || room.ownerConnection !== peerId) {
      return
    }
    const participant = room.participants.get(n)
    if (message.t === 'left') {
      if (participant?.state === 'member') {
        this.#cancel(room, participant)
      }
      return
    }
    if (participant?.state !== 'asked' || participant.request === null) {
      return
    }
    const {r, connection} = participant.request
    if (message.t === 'refuse') {
      this.#endRequest(room, participant)
      this.#send(connection, isJoinData(message.data) ? {t: 'refused', r, data: message.data} : {t: 'refused', r})
      return
    }
    if (!this.#port.allow(peerId, participant.peerId)) {
      this.#endRequest(room, participant)
      this.#answer(connection, r, 'owner away')
      this.#tellOwner(room, {t: 'ended', n})
      return
    }
    this.#clock.clearTimeout(participant.timer)
    this.#waitingJoins.delete(connection)
    participant.request = null
    participant.state = 'member'
    participant.token = randomToken()
    room.byToken.set(participant.token, participant)
    this.#tellOwner(room, {t: 'named', n, peer: participant.peerId})
    this.#send(connection, {t: 'let in', r, token: participant.token, n, wait: room.waitingSeconds, owner: peerId})
    this.#updateEmpty(room)
  }

  #cancel(room: Room, participant: Participant): void {
    if (participant.token !== null) {
      room.byToken.delete(participant.token)
    }
    room.participants.delete(participant.number)
    if (room.ownerConnection !== null) {
      this.#port.disallow(room.ownerConnection, participant.peerId)
    }
    this.#updateEmpty(room)
  }

  #applyLeaves(room: Room, leaves: readonly number[]): void {
    for (const number of leaves) {
      const participant = room.participants.get(number)
      if (participant?.state === 'member') {
        this.#cancel(room, participant)
      }
    }
  }

  #roster(room: Room): number[] {
    return [...room.participants.values()].filter(participant => participant.state === 'member').map(participant => participant.number)
  }

  #return(peerId: string, message: Fields): void {
    const {r, app, code, token} = message
    if (!isRequestId(r) || typeof code !== 'string' || typeof token !== 'string') {
      return
    }
    if (!isAppId(app)) {
      return this.#answer(peerId, r, 'bad app')
    }
    const room = this.#room(app, code)
    if (!room) {
      return this.#answer(peerId, r, 'no room')
    }
    if (token === room.ownerToken) {
      return this.#ownerReturn(peerId, room, message)
    }
    const participant = room.byToken.get(token)
    if (!participant) {
      return this.#answer(peerId, r, 'removed')
    }
    if (room.ownerConnection === null || !this.#port.allow(room.ownerConnection, peerId)) {
      return this.#answer(peerId, r, 'owner away')
    }
    if (participant.peerId !== peerId) {
      this.#port.disallow(room.ownerConnection, participant.peerId)
      participant.peerId = peerId
    }
    this.#tellOwner(room, {t: 'named', n: participant.number, peer: peerId})
    this.#send(peerId, {t: 'owner', r, peer: room.ownerConnection})
  }

  #ownerReturn(peerId: string, room: Room, message: Fields): void {
    const {r, term, page, leaves} = message
    if (!isRequestId(r) || !isNumber(term) || typeof page !== 'string' || !isLeaves(leaves)) {
      return
    }
    if (page !== room.ownerPage) {
      if (term !== room.term) {
        return this.#send(peerId, {t: 'term', r, term: room.term})
      }
      room.term += 1
      room.ownerPage = page
    }
    this.#applyLeaves(room, leaves)
    this.#setOwnerConnection(room, peerId)
    this.#send(peerId, {t: 'roster', r, term: room.term, roster: this.#roster(room)})
  }

  #reconnect(peerId: string, message: Fields): void {
    const {r, app, code, token, page, leaves} = message
    if (!isRequestId(r) || typeof code !== 'string' || typeof token !== 'string' || typeof page !== 'string' || !isLeaves(leaves)) {
      return
    }
    const room = isAppId(app) ? this.#room(app, code) : undefined
    if (!room) {
      return this.#answer(peerId, r, 'no room')
    }
    if (token !== room.ownerToken) {
      return this.#answer(peerId, r, 'removed')
    }
    if (page !== room.ownerPage) {
      return
    }
    this.#applyLeaves(room, leaves)
    this.#setOwnerConnection(room, peerId)
    this.#send(peerId, {t: 'roster', r, roster: this.#roster(room)})
  }

  #leave(message: Fields): void {
    const {app, code, token} = message
    if (!isAppId(app) || typeof token !== 'string') {
      return
    }
    const room = this.#room(app, code)
    if (!room) {
      return
    }
    if (token === room.ownerToken) {
      return this.#close(room, false)
    }
    const participant = room.byToken.get(token)
    if (participant) {
      this.#cancel(room, participant)
      this.#tellOwner(room, {t: 'left', n: participant.number})
    }
  }

  #setOwnerConnection(room: Room, peerId: string | null): void {
    if (room.ownerConnection === peerId) {
      return
    }
    for (const participant of [...room.participants.values()]) {
      if (participant.state === 'asked' && participant.request) {
        const {r, connection} = participant.request
        this.#endRequest(room, participant)
        this.#answer(connection, r, 'owner away')
      }
    }
    room.ownerConnection = peerId
    this.#clock.clearTimeout(room.waitTimer)
    room.waitTimer = null
    if (peerId === null) {
      room.waitTimer = this.#clock.setTimeout(() => this.#close(room, false), room.waitingSeconds * 1000)
    }
    this.#updateEmpty(room)
  }

  #updateEmpty(room: Room): void {
    const empty = room.ownerConnection === null && this.#roster(room).length === 0
    if (!empty) {
      this.#clock.clearTimeout(room.emptyTimer)
      room.emptyTimer = null
    } else if (room.emptyTimer === null && !room.closed) {
      room.emptyTimer = this.#clock.setTimeout(() => this.#close(room, false), emptyMs)
    }
  }

  #close(room: Room, tellOwner: boolean): void {
    if (room.closed) {
      return
    }
    room.closed = true
    for (const timer of [room.waitTimer, room.emptyTimer, room.dayTimer]) {
      this.#clock.clearTimeout(timer)
    }
    this.#rooms.delete(this.#key(room.appId, room.code))
    for (const participant of [...room.participants.values()]) {
      if (participant.state === 'asked' && participant.request) {
        const {r, connection} = participant.request
        this.#endRequest(room, participant)
        this.#answer(connection, r, 'no room')
      } else {
        this.#cancel(room, participant)
      }
    }
    if (tellOwner) {
      this.#tellOwner(room, {t: 'closed'})
    }
  }
}

export const createRoomsServer = ({clock = systemClock}: RoomsServerOptions = {}): ServerPart => ({
  version: roomsVersion,
  start: port => new RoomsServer(port, clock)
})
