import assert from 'node:assert/strict'
import type {JoinRequest, Room, RoomHandlers, Visibility} from '../api.ts'
import type {Lock, RoomsEnvironment, StorageLike} from '../environment.ts'
import {recordKey} from '../record.ts'
import {createRooms} from '../rooms.ts'
import {FakeClock} from './clock.ts'
import {FakeTransport, type FakePeer, type FakeSignaling} from './fake-transport.ts'

export const app = 'tictactoe'
export const code = 'BCDFG'
export const ownerPeer = 'owner peer'

export class FakeStorage implements StorageLike {
  readonly items = new Map<string, string>()
  failWrites = false
  writes = 0

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error('quota')
    }
    this.writes += 1
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }
}

type JoinRequestMode = 'keep' | 'throw' | 'reject' | 'none'

const handlerNames = [
  'returning',
  'created',
  'asked',
  'waitingForOwner',
  'letIn',
  'joined',
  'failed',
  'ended',
  'ownerLost',
  'ownerBack',
  'ownerReturned',
  'serverLost',
  'serverBack',
  'requestEnded',
  'participantJoined',
  'participantBack',
  'visibility',
  'participantLost',
  'participantLeft',
  'text',
  'path'
] as const

export const settle = (): Promise<void> => new Promise(resolve => setImmediate(resolve))

export const pageHarness = (options: {readonly lock?: 'free' | 'elsewhere' | 'refused'} = {}) => {
  const clock = new FakeClock()
  const transport = new FakeTransport(clock)
  const storage = new FakeStorage()
  const held = new Set<string>()
  let visible: Visibility = 'visible'
  const visibilityListeners: (() => void)[] = []
  const hideListeners: ((persisted: boolean) => void)[] = []
  const showListeners: ((persisted: boolean) => void)[] = []
  let reloads = 0
  const env: RoomsEnvironment = {
    transport,
    clock,
    storage,
    takeLock: name => {
      if (options.lock === 'elsewhere' || options.lock === 'refused' || held.has(name)) {
        return Promise.resolve(null)
      }
      held.add(name)
      const lock: Lock = {release: () => held.delete(name)}
      return Promise.resolve(lock)
    },
    visibility: () => visible,
    onVisibilityChange: listener => visibilityListeners.push(listener),
    onPageHide: listener => hideListeners.push(listener),
    onPageShow: listener => showListeners.push(listener),
    reload: () => {
      reloads += 1
    }
  }
  const rooms = createRooms(env)
  const events: (readonly [string, ...unknown[]])[] = []
  const requests: JoinRequest[] = []
  let joinRequestMode: JoinRequestMode = 'keep'
  const handlers: RoomHandlers = {
    ...Object.fromEntries(handlerNames.map(name => [name, (...args: unknown[]) => void events.push([name, ...args])])),
    joinRequest: (request: JoinRequest) => {
      events.push(['joinRequest', request.number, request.joinData])
      requests.push(request)
      if (joinRequestMode === 'throw') {
        throw new Error('app failed')
      }
      if (joinRequestMode === 'reject') {
        return Promise.reject(new Error('app failed'))
      }
      return undefined
    }
  }

  const told = (name: string): (readonly unknown[])[] => events.filter(event => event[0] === name).map(event => event.slice(1))
  const mark = (): number => events.length
  const since = (from: number): (readonly [string, ...unknown[]])[] => events.slice(from)
  const namesSince = (from: number): string[] => since(from).map(event => event[0])

  const record = (): {readonly [key: string]: unknown} | null => {
    const text = storage.items.get(recordKey(app))
    return text === undefined ? null : (JSON.parse(text) as {readonly [key: string]: unknown})
  }
  const putRecord = (value: unknown): void => {
    storage.items.set(recordKey(app), JSON.stringify(value))
  }
  const participantRecord = (fields: {readonly [key: string]: unknown} = {}) => ({
    role: 'participant',
    code,
    token: 'participant token',
    number: 2,
    wait: 600,
    ownerLostSince: null,
    ...fields
  })
  const ownerRecord = (fields: {readonly [key: string]: unknown} = {}) => ({
    role: 'owner',
    code,
    token: 'owner token',
    number: 1,
    wait: 600,
    term: 1,
    serverLostSince: null,
    numbers: [],
    leaves: [],
    ...fields
  })

  const setVisible = (value: Visibility): void => {
    visible = value
    for (const listener of visibilityListeners) {
      listener()
    }
  }

  const hide = (persisted: boolean): void => hideListeners.forEach(listener => listener(persisted))
  const show = (persisted: boolean): void => showListeners.forEach(listener => listener(persisted))

  const latest = (): FakeSignaling => transport.latest

  const create = async (wait: number | null = null): Promise<Room> => {
    const room = rooms.create(app, wait, handlers)
    assert.ok(room)
    await settle()
    return room
  }

  const owning = async (wait: number | null = null): Promise<Room> => {
    const room = await create(wait)
    latest().open(ownerPeer)
    latest().answer('created', {code, term: 1, token: 'owner token'})
    assert.deepEqual(told('created').at(-1), [code, 1])
    return room
  }

  const join = async (joinData: unknown = null, codeText = code): Promise<Room> => {
    const room = rooms.join(app, codeText, joinData, handlers)
    assert.ok(room)
    await settle()
    return room
  }

  const asked = async (): Promise<Room> => {
    const room = await join()
    latest().open('participant peer')
    latest().receive({t: 'asked', r: latest().last('join')?.r})
    return room
  }

  const letIn = async (wait = 600): Promise<{readonly room: Room; readonly peer: FakePeer}> => {
    const room = await asked()
    latest().answer('let in', {token: 'participant token', n: 2, wait, owner: ownerPeer}, 'join')
    const peer = latest().peers.at(-1)
    assert.ok(peer)
    return {room, peer}
  }

  const inRoom = async (wait = 600): Promise<{readonly room: Room; readonly peer: FakePeer}> => {
    const entered = await letIn(wait)
    entered.peer.open()
    entered.peer.receive('c')
    assert.deepEqual(told('joined').at(-1), [2])
    return entered
  }

  return {
    env,
    clock,
    transport,
    storage,
    held,
    rooms,
    handlers,
    events,
    requests,
    setJoinRequestMode: (mode: JoinRequestMode) => {
      joinRequestMode = mode
    },
    reloads: () => reloads,
    told,
    mark,
    since,
    namesSince,
    record,
    putRecord,
    participantRecord,
    ownerRecord,
    setVisible,
    hide,
    show,
    latest,
    create,
    owning,
    join,
    asked,
    letIn,
    inRoom
  }
}

export type PageHarness = ReturnType<typeof pageHarness>

export const ownerWithParticipant = async (h: PageHarness, visibility: Visibility = 'visible', wait: number | null = null) => {
  const room = await h.owning(wait)
  const signaling = h.latest()
  signaling.receive({t: 'ask', app, code, n: 2, data: null})
  h.requests.at(-1)?.letIn()
  signaling.receive({t: 'named', app, code, n: 2, peer: 'participant peer'})
  const peer = signaling.call('participant peer')
  peer.open()
  peer.receive(`v${visibility}`)
  return {room, signaling, peer}
}
