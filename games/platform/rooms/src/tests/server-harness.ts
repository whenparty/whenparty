import assert from 'node:assert/strict'
import type {ServerPort} from '@whenparty/transport/server'
import {createRoomsServer} from '../server/index.ts'
import {FakeClock} from './clock.ts'

export type Sent = {readonly t: string; readonly [key: string]: unknown}

export class FakePort implements ServerPort {
  readonly sent: {readonly to: string; readonly message: Sent}[] = []
  readonly lists = new Map<string, Set<string>>()
  readonly open = new Set<string>()
  refuseAllow = false

  send(peerId: string, message: unknown): boolean {
    this.sent.push({to: peerId, message: JSON.parse(JSON.stringify(message)) as Sent})
    return true
  }

  allow(listOf: string, peerId: string): boolean {
    if (this.refuseAllow || !this.open.has(listOf) || !this.open.has(peerId)) {
      return false
    }
    const list = this.lists.get(listOf) ?? new Set()
    list.add(peerId)
    this.lists.set(listOf, list)
    return true
  }

  disallow(listOf: string, peerId: string): boolean {
    this.lists.get(listOf)?.delete(peerId)
    return this.open.has(listOf)
  }

  listed(listOf: string, peerId: string): boolean {
    return this.lists.get(listOf)?.has(peerId) ?? false
  }
}

export const app = 'tictactoe'

export interface RoomRef {
  readonly app: string
  readonly code: string
  readonly token: string
  readonly term: number
}

export const serverHarness = () => {
  const clock = new FakeClock()
  const port = new FakePort()
  const handlers = createRoomsServer({clock}).start(port)
  let request = 0
  const say = (peer: string, message: unknown): void => {
    port.open.add(peer)
    handlers.message?.(peer, message as never)
  }
  const close = (peer: string): void => {
    port.open.delete(peer)
    port.lists.delete(peer)
    handlers.closed?.(peer)
  }
  const to = (peer: string): Sent[] => port.sent.filter(sent => sent.to === peer).map(sent => sent.message)
  const last = (peer: string): Sent | undefined => to(peer).at(-1)
  const mark = (): number => port.sent.length
  const since = (from: number, peer: string): Sent[] =>
    port.sent
      .slice(from)
      .filter(sent => sent.to === peer)
      .map(sent => sent.message)
  const next = (): number => ++request

  const create = (owner = 'owner', wait: number | null = null): RoomRef => {
    const r = next()
    say(owner, {t: 'create', r, app, wait, page: `page of ${owner}`})
    const answer = last(owner)
    assert.equal(answer?.t, 'created')
    return {app, code: String(answer.code), token: String(answer.token), term: Number(answer.term)}
  }

  const join = (peer: string, room: RoomRef, data: unknown = null): Sent | undefined => {
    say(peer, {t: 'join', r: next(), app: room.app, code: room.code, data})
    return last(peer)
  }

  const admit = (owner: string, room: RoomRef, n: number): void => say(owner, {t: 'admit', app: room.app, code: room.code, n})
  const refuse = (owner: string, room: RoomRef, n: number, data?: unknown): void =>
    say(owner, {t: 'refuse', app: room.app, code: room.code, n, data})

  const member = (owner: string, peer: string, room: RoomRef): {readonly n: number; readonly token: string} => {
    join(peer, room)
    const ask = last(owner)
    assert.equal(ask?.t, 'ask')
    admit(owner, room, Number(ask.n))
    const letIn = last(peer)
    assert.equal(letIn?.t, 'let in')
    return {n: Number(letIn.n), token: String(letIn.token)}
  }

  const returnAs = (peer: string, room: RoomRef, token: string): Sent | undefined => {
    say(peer, {t: 'return', r: next(), app: room.app, code: room.code, token})
    return last(peer)
  }

  const ownerReturn = (
    peer: string,
    room: RoomRef,
    fields: {readonly term: number; readonly page: string; readonly leaves?: readonly number[]}
  ): Sent | undefined => {
    say(peer, {t: 'return', r: next(), app: room.app, code: room.code, token: room.token, leaves: [], ...fields})
    return last(peer)
  }

  const reconnect = (
    peer: string,
    room: RoomRef,
    fields: {readonly token?: string; readonly page: string; readonly leaves?: readonly number[]}
  ): Sent | undefined => {
    say(peer, {t: 'reconnect', r: next(), app: room.app, code: room.code, token: room.token, leaves: [], ...fields})
    return last(peer)
  }

  const leave = (peer: string, room: RoomRef, token: string): void => say(peer, {t: 'leave', app: room.app, code: room.code, token})

  const probe = (room: RoomRef): 'owned' | 'away' | 'closed' => {
    const answer = join(`probe ${next()}`, room)
    if (answer?.t === 'asked') {
      return 'owned'
    }
    return answer?.a === 'owner away' ? 'away' : 'closed'
  }

  return {
    clock,
    port,
    handlers,
    say,
    close,
    to,
    last,
    mark,
    since,
    next,
    create,
    join,
    admit,
    refuse,
    member,
    returnAs,
    ownerReturn,
    reconnect,
    leave,
    probe
  }
}

export type ServerHarness = ReturnType<typeof serverHarness>
