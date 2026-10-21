import {decideSnapshot} from './handover.ts'
import {decodeIntent, decodePresence, decodeSnapshot, encode} from './protocol.ts'
import {
  applyDeadlines,
  applyIntent,
  createRoomState,
  dropPlayer,
  hostOf,
  isAbsent,
  joinPlayer,
  memberByPeer,
  memberByPlayer,
  syncPresence
} from './room-state.ts'
import type {GameRules, Intent, Member, NumberedIntent, RoomState} from './room-state.ts'
import type {PageEvent} from './transport.ts'

export interface Config<State, Move> {
  self: Member
  rules: GameRules<State, Move>
  seatHoldMs: number
  restoreGraceMs: number
}

export type Phase<State> =
  | {name: 'waiting'; restoreHost: boolean; aloneAt: number | null; closeAt: number | null}
  | {name: 'following'; room: RoomState<State>}
  | {name: 'hosting'; room: RoomState<State>}
  | {name: 'closed'; room: RoomState<State> | null; hostLeft: boolean}

export interface Peer {
  playerId: string | null
  away: boolean
  unreachable: boolean
}

export interface Model<State, Move> {
  config: Config<State, Move>
  phase: Phase<State>
  // Local time at which room.clock was last observed
  roomAt: number
  page: {hidden: boolean; gone: boolean}
  peers: Readonly<Record<string, Peer>>
  pending: NumberedIntent<Move> | null
  nextIntentId: number
}

export type Event<Move> =
  | {type: 'peerJoined'; peerId: string}
  | {type: 'peerLeft'; peerId: string}
  | {type: 'unreachable'; peerId: string}
  | {type: 'snapshot'; data: unknown; sender: string}
  | {type: 'intent'; data: unknown; sender: string}
  | {type: 'presence'; data: unknown; sender: string}
  | {type: 'bye'; sender: string}
  | {type: 'page'; event: PageEvent}
  | {type: 'send'; intent: Intent<Move>}
  | {type: 'leave'}
  | {type: 'deadline'; key: string}

export type Action = 'snapshot' | 'intent' | 'presence' | 'bye'
export type Effect = {type: 'send'; action: Action; data: string; target?: string} | {type: 'rejoin'} | {type: 'detach'} | {type: 'close'}

export interface Env {
  now: number
  peers: ReadonlySet<string>
}

export interface SessionView<State> {
  selfId: string
  playerId: string
  isHost: boolean
  inControl: boolean
  room: RoomState<State> | null
  waitingForHost: boolean
  hostLeft: boolean
  unreachable: boolean
}

export interface Start {
  isHost: boolean
  rejoinAsHost: boolean
}

export const initialModel = <State, Move>(config: Config<State, Move>, start: Start, now: number): Model<State, Move> => {
  for (const key of ['seatHoldMs', 'restoreGraceMs'] as const) {
    if (!Number.isSafeInteger(config[key]) || config[key] < 0) {
      throw new RangeError(`${key} must be a nonnegative safe integer`)
    }
  }

  return {
    config,
    phase: start.isHost
      ? {name: 'hosting', room: createRoomState(config.rules, config.self)}
      : {
          name: 'waiting',
          restoreHost: start.rejoinAsHost,
          aloneAt: start.rejoinAsHost ? now + config.restoreGraceMs : null,
          closeAt: start.rejoinAsHost ? now + config.seatHoldMs : null
        },
    roomAt: now,
    page: {hidden: false, gone: false},
    peers: {},
    pending: null,
    nextIntentId: 1
  }
}

const roomOf = <State>(phase: Phase<State>): RoomState<State> | null => ('room' in phase ? phase.room : null)
const hostTimer = 'host'
const holdTimer = (playerId: string) => `hold:${playerId}`
const gameTimer = (key: string) => `game:${key}`

export const timersOf = <State, Move>({config, phase, roomAt, page}: Model<State, Move>): Map<string, number> => {
  const timers = new Map<string, number>()

  if (page.gone || phase.name === 'closed') {
    return timers
  }

  const local = (room: RoomState<State>, at: number) => roomAt + at - room.clock

  if (phase.name === 'waiting') {
    const next = [phase.aloneAt, phase.closeAt].filter((at): at is number => at !== null)

    if (next.length > 0) {
      timers.set(hostTimer, Math.min(...next))
    }
  } else if (phase.name === 'following') {
    const until = phase.room.reservations[phase.room.hostId]

    if (until !== undefined) {
      timers.set(hostTimer, local(phase.room, until))
    }
  } else if (phase.name === 'hosting') {
    const {room} = phase
    Object.entries(room.reservations).forEach(([playerId, until]) => timers.set(holdTimer(playerId), local(room, until)))
    Object.entries(config.rules.deadlinesOf?.(room.game) ?? {}).forEach(([key, at]) => timers.set(gameTimer(key), local(room, at)))
  }

  return timers
}

export const viewOf = <State, Move>({config, phase, peers}: Model<State, Move>): SessionView<State> => {
  const room = roomOf(phase)
  const player = room ? memberByPlayer(room, config.self.playerId) : null

  return {
    selfId: config.self.peerId,
    playerId: config.self.playerId,
    isHost: phase.name === 'hosting',
    inControl: !player || player.peerId === config.self.peerId,
    room,
    waitingForHost:
      (phase.name === 'following' && isAbsent(phase.room, phase.room.hostId)) || (phase.name === 'waiting' && phase.restoreHost),
    hostLeft: phase.name === 'closed' && phase.hostLeft,
    unreachable: Object.values(peers).some(peer => peer.unreachable)
  }
}

export const invariantViolations = <State, Move>({config, phase}: Model<State, Move>): string[] => {
  const room = roomOf(phase)
  const problems: string[] = []

  if (phase.name === 'hosting' && (room?.hostId !== config.self.playerId || hostOf(room)?.peerId !== config.self.peerId)) {
    problems.push('only the creator controls the room')
  }

  if (phase.name === 'following' && hostOf(phase.room)?.peerId === config.self.peerId) {
    problems.push('following its own connection')
  }

  if (room && phase.name !== 'closed' && !hostOf(room)) {
    problems.push('a room without its creator')
  }

  if (room && Object.keys(room.reservations).some(playerId => !memberByPlayer(room, playerId))) {
    problems.push('a reservation for a player that is not a member')
  }

  return problems
}

interface Draft<State, Move> extends Model<State, Move> {
  env: Env
  effects: Effect[]
}

const send = <State, Move>(draft: Draft<State, Move>, action: Action, data: string, target?: string) =>
  draft.effects.push({type: 'send', action, data, ...(target ? {target} : {})})

// Room time now. A snapshot may anchor roomAt after the clock it carries, so the room never runs backwards.
const roomNow = <State, Move>(draft: Draft<State, Move>, room: RoomState<State>) => room.clock + Math.max(0, draft.env.now - draft.roomAt)

const stamp = <State, Move>(draft: Draft<State, Move>, room: RoomState<State>): RoomState<State> => {
  const stamped = {...room, clock: roomNow(draft, room)}
  draft.roomAt = draft.env.now
  return stamped
}

// Broadcasts the room, after telling the game who became absent or present since previous: the room
// this tab had, or the snapshot a room was taken from, whose game already knows its reservations
const commit = <State, Move>(
  draft: Draft<State, Move>,
  room: RoomState<State>,
  previous: RoomState<State> = roomOf(draft.phase) ?? {...room, reservations: {}}
) => {
  const next = stamp(draft, syncPresence(draft.config.rules, previous, room, roomNow(draft, room)))
  draft.phase = hostOf(next)?.peerId === draft.config.self.peerId ? {name: 'hosting', room: next} : {name: 'following', room: next}
  send(draft, 'snapshot', encode(next))
}

const withoutReservation = <State>(room: RoomState<State>, playerId: string): RoomState<State> => {
  const {[playerId]: _, ...reservations} = room.reservations
  return {...room, reservations}
}

// An existing reservation keeps its deadline: repeated signs of absence never extend a hold
const hold = <State, Move>(draft: Draft<State, Move>, room: RoomState<State>, playerId: string): RoomState<State> =>
  isAbsent(room, playerId)
    ? room
    : {...room, reservations: {...room.reservations, [playerId]: roomNow(draft, room) + draft.config.seatHoldMs}}

const close = <State, Move>(draft: Draft<State, Move>, hostLeft: boolean) => {
  draft.phase = {name: 'closed', room: roomOf(draft.phase), hostLeft}
  draft.effects.push({type: 'close'})
}

const endRoom = <State, Move>(draft: Draft<State, Move>) => {
  const room = roomOf(draft.phase)
  draft.phase = {
    name: 'closed',
    room: room ? dropPlayer(draft.config.rules, room, room.hostId, roomNow(draft, room)) : null,
    hostLeft: true
  }
  draft.effects.push({type: 'close'})
}

// Nobody is linked to restore the room from: the creator starts over under the same code
const hostFresh = <State, Move>(draft: Draft<State, Move>) => {
  draft.roomAt = draft.env.now
  const room = createRoomState(draft.config.rules, draft.config.self)
  commit(draft, draft.page.hidden ? hold(draft, room, room.hostId) : room)
}

const expire = <State, Move>(draft: Draft<State, Move>) => {
  const {phase} = draft
  const {now} = draft.env

  if (phase.name === 'waiting') {
    if (phase.aloneAt !== null && phase.aloneAt <= now) {
      if (draft.env.peers.size === 0) {
        hostFresh(draft)
        return
      }

      draft.phase = {...phase, aloneAt: null}
    }

    if (phase.closeAt !== null && phase.closeAt <= now) {
      endRoom(draft)
    }
  } else if (phase.name === 'following') {
    const until = phase.room.reservations[phase.room.hostId]

    if (until !== undefined && until <= roomNow(draft, phase.room)) {
      endRoom(draft)
    }
  } else if (phase.name === 'hosting') {
    const {room} = phase
    const roomTime = roomNow(draft, room)
    const due = Object.entries(room.reservations)
      .filter(([, until]) => until <= roomTime)
      .map(([playerId]) => playerId)

    // The creator's own hold ran out while its page was hidden: the room ends for everyone, and the bye says so at once
    if (due.includes(room.hostId)) {
      send(draft, 'bye', '')
      endRoom(draft)
      return
    }

    const next = applyDeadlines(
      draft.config.rules,
      due.reduce((current, playerId) => dropPlayer(draft.config.rules, current, playerId, roomTime), room),
      roomTime
    )

    if (next !== room) {
      commit(draft, next)
    }
  }
}

const tellPresence = <State, Move>(draft: Draft<State, Move>, target?: string) =>
  send(draft, 'presence', encode({playerId: draft.config.self.playerId, away: draft.page.hidden}), target)

const setPeer = <State, Move>(draft: Draft<State, Move>, peerId: string, change: Partial<Peer>) => {
  draft.peers = {...draft.peers, [peerId]: {...(draft.peers[peerId] ?? {playerId: null, away: false, unreachable: false}), ...change}}
}

// A guest holds the creator's seat and shows the pause itself, and offers the room to the creator's other tabs
const loseHost = <State, Move>(draft: Draft<State, Move>) => {
  if (draft.phase.name !== 'following') {
    return
  }

  const held = hold(draft, draft.phase.room, draft.phase.room.hostId)
  const room = syncPresence(draft.config.rules, draft.phase.room, held, roomNow(draft, held))
  draft.phase = {name: 'following', room}
  Object.entries(draft.peers).forEach(([peerId, peer]) => {
    if (peerId !== hostOf(room)?.peerId && peer.playerId === room.hostId && !peer.away && draft.env.peers.has(peerId)) {
      send(draft, 'snapshot', encode({...room, clock: roomNow(draft, room)}), peerId)
    }
  })
}

// A visible tab of the creator that lost the creator's controlling connection hosts the room itself
const reclaimAsCreator = <State, Move>(draft: Draft<State, Move>): boolean => {
  const {phase} = draft

  if (
    phase.name !== 'following' ||
    !isAbsent(phase.room, phase.room.hostId) ||
    phase.room.hostId !== draft.config.self.playerId ||
    draft.page.hidden
  ) {
    return false
  }

  commit(draft, joinPlayer(withoutReservation(phase.room, phase.room.hostId), draft.config.self))
  return true
}

const sendPending = <State, Move>(draft: Draft<State, Move>) => {
  const {phase, pending} = draft

  if (!pending || phase.name !== 'following' || isAbsent(phase.room, phase.room.hostId)) {
    return
  }

  if ((phase.room.handled[draft.config.self.playerId] ?? 0) >= pending.id) {
    draft.pending = null
  } else {
    send(draft, 'intent', encode(pending), hostOf(phase.room)?.peerId)
  }
}

const receiveSnapshot = <State, Move>(draft: Draft<State, Move>, data: unknown, sender: string) => {
  const snapshot = decodeSnapshot(draft.config.rules, data)
  const {phase} = draft

  if (!snapshot || phase.name === 'closed') {
    return
  }

  const known = roomOf(phase)
  const decision = decideSnapshot(snapshot, {
    self: draft.config.self,
    standing: phase.name,
    restoring: phase.name === 'waiting' && phase.restoreHost,
    hidden: draft.page.hidden,
    known,
    sender
  })

  switch (decision) {
    case 'ignore':
      return
    case 'expired':
      return endRoom(draft)
    case 'outrank':
      return commit(draft, {...known!, term: known!.term + 1})
    case 'restore': {
      draft.roomAt = draft.env.now
      const restored = joinPlayer(withoutReservation(snapshot, snapshot.hostId), draft.config.self)
      return commit(draft, draft.page.hidden ? hold(draft, restored, restored.hostId) : restored, snapshot)
    }
    case 'host':
      draft.roomAt = draft.env.now
      return commit(draft, snapshot, snapshot)
    case 'follow':
      draft.roomAt = draft.env.now
      draft.phase = {name: 'following', room: snapshot}
      return sendPending(draft)
  }
}

const receivePresence = <State, Move>(draft: Draft<State, Move>, data: unknown, sender: string) => {
  const presence = decodePresence(data)

  if (!presence) {
    return
  }

  setPeer(draft, sender, {...presence, unreachable: false})
  const {phase} = draft

  if (phase.name === 'hosting') {
    // Another tab of the creator takes the room by restoring from this snapshot (handover.ts), never through its presence
    if (presence.playerId === phase.room.hostId) {
      return commit(draft, phase.room)
    }

    const controlling = memberByPlayer(phase.room, presence.playerId)

    if (controlling && controlling.peerId !== sender && presence.away) {
      return
    }

    const joined = joinPlayer(phase.room, {playerId: presence.playerId, peerId: sender})
    commit(draft, presence.away ? hold(draft, joined, presence.playerId) : withoutReservation(joined, presence.playerId))
  } else if (phase.name === 'following') {
    if (presence.playerId === phase.room.hostId && sender !== hostOf(phase.room)?.peerId && isAbsent(phase.room, phase.room.hostId)) {
      send(draft, 'snapshot', encode({...phase.room, clock: roomNow(draft, phase.room)}), sender)
    } else if (sender === hostOf(phase.room)?.peerId && presence.away) {
      loseHost(draft)
    }
  }
}

const receiveIntent = <State, Move>(draft: Draft<State, Move>, data: unknown, sender: string) => {
  if (draft.phase.name !== 'hosting') {
    return
  }

  const {room} = draft.phase
  const member = memberByPeer(room, sender)
  const intent = member && decodeIntent(draft.config.rules, data)

  if (!member || !intent) {
    return
  }

  const next = applyIntent(draft.config.rules, room, member.playerId, intent, roomNow(draft, room))

  if (next.game !== room.game) {
    commit(draft, next)
  } else {
    // Only a game-changing intent goes to everyone; the sender alone learns that this one was handled
    const current = stamp(draft, next)
    draft.phase = {name: 'hosting', room: current}
    send(draft, 'snapshot', encode(current), sender)
  }
}

const receivePage = <State, Move>(draft: Draft<State, Move>, event: PageEvent) => {
  const gone = event === 'gone'
  draft.page = {hidden: event === 'away' || gone, gone}

  if (event === 'shown') {
    draft.effects.push({type: 'rejoin'})
    draft.peers = {}
    loseHost(draft)
  }

  const reclaimed = event === 'back' && reclaimAsCreator(draft)

  if (draft.phase.name === 'hosting' && !reclaimed) {
    let room = draft.phase.room
    room = draft.page.hidden ? hold(draft, room, room.hostId) : withoutReservation(room, room.hostId)

    // Back from the cache every link is new: everyone is held until their presence confirms them
    if (event === 'shown') {
      room.members.filter(member => member.playerId !== room.hostId).forEach(member => (room = hold(draft, room, member.playerId)))
    }

    commit(draft, room)
  }

  tellPresence(draft)

  if (gone) {
    draft.effects.push({type: 'detach'})
  }
}

const peerLeft = <State, Move>(draft: Draft<State, Move>, peerId: string) => {
  const {phase} = draft

  if (phase.name === 'hosting') {
    const member = memberByPeer(phase.room, peerId)

    if (!member) {
      return
    }

    // The player's other linked tab takes over instead of a reservation
    const otherTab = Object.entries(draft.peers).find(
      ([id, peer]) => id !== peerId && peer.playerId === member.playerId && draft.env.peers.has(id)
    )

    if (otherTab) {
      const [id, peer] = otherTab
      const moved = joinPlayer(phase.room, {playerId: member.playerId, peerId: id})
      commit(draft, peer.away ? hold(draft, moved, member.playerId) : moved)
    } else {
      commit(draft, hold(draft, phase.room, member.playerId))
    }
  } else if (phase.name === 'following' && hostOf(phase.room)?.peerId === peerId) {
    loseHost(draft)
    reclaimAsCreator(draft)
  }
}

const receiveBye = <State, Move>(draft: Draft<State, Move>, sender: string) => {
  const {phase} = draft

  if (phase.name === 'hosting') {
    const member = memberByPeer(phase.room, sender)

    if (member) {
      commit(draft, dropPlayer(draft.config.rules, phase.room, member.playerId, roomNow(draft, phase.room)))
    }
  } else if (phase.name === 'following' && hostOf(phase.room)?.peerId === sender) {
    endRoom(draft)
  }
}

const sendIntent = <State, Move>(draft: Draft<State, Move>, intent: Intent<Move>) => {
  // A hidden page cannot be acted on, so its intents are dropped rather than kept for a return the user did not see
  if (draft.page.hidden) {
    return
  }

  const numbered = {...intent, id: draft.nextIntentId++}

  if (draft.phase.name === 'hosting') {
    commit(draft, applyIntent(draft.config.rules, draft.phase.room, draft.config.self.playerId, numbered, roomNow(draft, draft.phase.room)))
  } else {
    draft.pending = numbered
    sendPending(draft)
  }
}

const handle = <State, Move>(draft: Draft<State, Move>, event: Event<Move>) => {
  // A page that went has left the room: only its return or an explicit leave count until then
  if (draft.page.gone && !(event.type === 'page' && event.event === 'shown') && event.type !== 'leave') {
    return
  }

  expire(draft)

  if (draft.phase.name === 'closed') {
    return
  }

  switch (event.type) {
    case 'peerJoined':
      setPeer(draft, event.peerId, {unreachable: false})
      return tellPresence(draft, event.peerId)
    case 'peerLeft':
      return peerLeft(draft, event.peerId)
    case 'unreachable':
      if (!draft.env.peers.has(event.peerId)) {
        setPeer(draft, event.peerId, {unreachable: true})
      }

      return
    case 'snapshot':
      return receiveSnapshot(draft, event.data, event.sender)
    case 'presence':
      return receivePresence(draft, event.data, event.sender)
    case 'intent':
      return receiveIntent(draft, event.data, event.sender)
    case 'bye':
      return receiveBye(draft, event.sender)
    case 'page':
      return receivePage(draft, event.event)
    case 'send':
      return sendIntent(draft, event.intent)
    case 'leave':
      send(draft, 'bye', '')
      return close(draft, false)
    case 'deadline':
      // expire() above handled whatever was due
      return
  }
}

export const step = <State, Move>(
  model: Model<State, Move>,
  event: Event<Move>,
  env: Env
): {model: Model<State, Move>; effects: Effect[]} => {
  if (model.phase.name === 'closed') {
    return {model, effects: []}
  }

  const draft: Draft<State, Move> = {...model, env, effects: []}
  handle(draft, event)
  const {effects, env: _, ...next} = draft

  return {model: next, effects}
}
