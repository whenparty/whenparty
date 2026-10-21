// The session as a state machine (see ../STATES.md). step() takes the model, one event and what
// the network looks like right now, and returns the next model and what to do: messages to send,
// and whether to join the room again or leave it. It never reads the clock or the network itself.
// The deadlines a model waits for are part of it (see timersOf): a state that is left takes its
// timers with it, so no timer outlives the state that set it. session.ts runs it.
import {decodeIntent, decodePresence, decodeSnapshot, encode} from './protocol.ts'
import {applyIntent, createRoomState, dropPlayer, hostOf, joinPlayer, memberByPeer, memberByPlayer} from './room-state.ts'
import type {Absence, GameRules, Intent, Member, NumberedIntent, RoomState} from './room-state.ts'
import {acceptsSnapshot, hostAlone, promote, successorOf, winsTie} from './succession.ts'
import type {PageEvent} from './transport.ts'

export interface Config<State, Move> {
  self: Member
  rules: GameRules<State, Move>
  takeoverDelayMs: number
  awayHoldMs: number
}

// A host's hold on the place and seat of a member whose link dropped. held: the member is gone,
// and is dropped at until. settling: its link is back, and the hold is forgotten at until, unless
// the link drops again first: then it is held again from the same since, so a link that keeps
// dropping holds a seat for one wait in all.
export interface Hold {
  status: 'held' | 'settling'
  since: number
  until: number
}

// What a guest whose host's link dropped waits for. awaitingSuccessor: the member next in line
// takes over by at, or this tab joins the room again. takingOver: this tab is next, and takes over at at.
export type Next = {name: 'awaitingSuccessor'; successor: string; at: number} | {name: 'takingOver'; at: number}

// A room to host again if no host speaks by at: the game as this tab last saw it, or a new one.
// asMember: this tab was a guest. It waits longer, gives way to any other room (its room is
// fresh), and waits on while the room may be out of reach: the signaling server is down, or a
// peer it found could not be connected to.
export interface Reclaim<State> {
  at: number
  lastRoom: RoomState<State> | null
  asMember: boolean
}

export type Phase<State> =
  // Joined, and no host has spoken yet
  | {name: 'waiting'; reclaim: Reclaim<State> | null}
  // A guest whose host's link is up. confirmBy: the link to the host came up again, and the host
  // has to answer this tab's presence with a snapshot by then, or this tab joins the room again:
  // that connection may be a new one of a tab that no longer hosts.
  | {name: 'following'; room: RoomState<State>; confirmBy: number | null}
  // A guest whose host's link dropped
  | {name: 'hostLost'; room: RoomState<State>; next: Next}
  // This tab hosts the room. Holds are keyed by peer.
  | {name: 'hosting'; room: RoomState<State>; holds: Readonly<Record<string, Hold>>}
  // The page went (pagehide) and left the room. It may come back from the back-forward cache.
  | {name: 'detached'; room: RoomState<State> | null; hostIfAlone: boolean}
  // For good. hostLeft: the host is gone and nobody can take over.
  | {name: 'closed'; room: RoomState<State> | null; hostLeft: boolean}

// What this tab knows of a peer, in every phase. lost: its link dropped and has not come back.
export interface Peer {
  // Whose connection it is, once it said so
  playerId: string | null
  // Its page is hidden, as it said last
  away: boolean
  // It said goodbye before leaving
  bye: boolean
  lost: boolean
  // The signaling server found it, but no link came up
  unreachable: boolean
}

export interface Page {
  hidden: boolean
  // When the page was last shown again after being hidden
  backAt: number
  // After beforeunload, when to join the room again if the page is still here
  revive: number | null
}

export interface Model<State, Move> {
  config: Config<State, Move>
  phase: Phase<State>
  page: Page
  peers: Readonly<Record<string, Peer>>
  // The last intent this guest sent, until a snapshot shows the host handled it
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
  // A deadline from timersOf came
  | {type: 'deadline'; key: string}

export type Action = 'snapshot' | 'intent' | 'presence' | 'bye'

export type Effect =
  | {type: 'send'; action: Action; data: string; target?: string}
  // Leave the room and join it again, with new links
  | {type: 'rejoin'}
  // Leave the room, and hear nothing more from it, until a rejoin
  | {type: 'detach'}
  // Leave the room for good
  | {type: 'close'}

// What step needs to know about the world
export interface Env {
  now: number
  // The peers this tab has a link to right now
  peers: ReadonlySet<string>
  // This tab reaches the signaling server right now
  signalingOpen: boolean
}

export interface SessionView<State> {
  // This tab's connection
  selfId: string
  // This tab's player, the same in its other tabs and after a reload (see player-id.ts)
  playerId: string
  // This tab hosts the room right now. That changes when a host leaves.
  isHost: boolean
  // This tab's connection controls its player. False once another tab of the same player joined
  // the room later: that tab plays, and this one only watches.
  inControl: boolean
  // The latest room state, or null until a guest hears from a host
  room: RoomState<State> | null
  // The host is gone and the next member takes over after a pause
  switchingHost: boolean
  // The host is gone and nobody can take over. The session has left the room.
  hostLeft: boolean
  // The signaling server found a peer in this room, but this tab could not connect to it, and has
  // not since. Usually a network that blocks direct connections, even through TURN.
  unreachable: boolean
}

export interface Start {
  isHost: boolean
  rejoinAsHost: boolean
  provisional: boolean
}

export const initialModel = <State, Move>(config: Config<State, Move>, start: Start, now: number): Model<State, Move> => {
  const {rules, self, takeoverDelayMs} = config
  const phase: Phase<State> = start.isHost
    ? {name: 'hosting', room: createRoomState(rules, self, start.provisional ? 'fresh' : 'original'), holds: {}}
    : {name: 'waiting', reclaim: start.rejoinAsHost ? {at: now + takeoverDelayMs * 2, lastRoom: null, asMember: false} : null}

  return {config, phase, page: {hidden: false, backAt: -Infinity, revive: null}, peers: {}, pending: null, nextIntentId: 1}
}

const phaseTimer = 'phase'
const reviveTimer = 'revive'
const holdTimer = (peerId: string) => `hold:${peerId}`

// Every deadline the model waits for, by key. The phase has at most one; so does the page; a host
// has one per hold. Nothing else sets a timer.
export const timersOf = <State, Move>({phase, page}: Model<State, Move>): Map<string, number> => {
  const timers = new Map<string, number>()

  if (phase.name === 'closed' || phase.name === 'detached') {
    return timers
  }

  if (phase.name === 'waiting' && phase.reclaim) {
    timers.set(phaseTimer, phase.reclaim.at)
  } else if (phase.name === 'following' && phase.confirmBy !== null) {
    timers.set(phaseTimer, phase.confirmBy)
  } else if (phase.name === 'hostLost') {
    timers.set(phaseTimer, phase.next.at)
  } else if (phase.name === 'hosting') {
    Object.entries(phase.holds).forEach(([peerId, hold]) => timers.set(holdTimer(peerId), hold.until))
  }

  if (page.revive !== null) {
    timers.set(reviveTimer, page.revive)
  }

  return timers
}

const roomOf = <State>(phase: Phase<State>): RoomState<State> | null => ('room' in phase ? phase.room : null)

export const viewOf = <State, Move>({config, phase, peers}: Model<State, Move>): SessionView<State> => {
  const room = roomOf(phase)
  const player = room ? memberByPlayer(room, config.self.playerId) : null

  return {
    selfId: config.self.peerId,
    playerId: config.self.playerId,
    isHost: phase.name === 'hosting',
    inControl: player === null || player.peerId === config.self.peerId,
    room,
    switchingHost: phase.name === 'hostLost',
    hostLeft: phase.name === 'closed' && phase.hostLeft,
    unreachable: Object.values(peers).some(peer => peer.unreachable)
  }
}

// What must hold after every step. The tests check it; session.ts warns if it ever breaks.
export const invariantViolations = <State, Move>({config, phase, peers}: Model<State, Move>): string[] => {
  const self = config.self.peerId
  const host = (() => {
    const room = roomOf(phase)
    return room ? hostOf(room)?.peerId : undefined
  })()
  const lost = host !== undefined && peers[host]?.lost === true
  const problems: string[] = []

  if (phase.name === 'hosting' && host !== self) {
    problems.push(`hosting a room whose host is ${host}`)
  }

  if (phase.name === 'following' && (host === self || lost)) {
    problems.push(`following ${host}, which is ${host === self ? 'this tab' : 'lost'}`)
  }

  if (phase.name === 'hostLost' && (host === self || !lost)) {
    problems.push(`waiting for a new host while ${host} is ${host === self ? 'this tab' : 'linked'}`)
  }

  if (phase.name === 'hostLost' && phase.next.name === 'awaitingSuccessor' && phase.next.successor === self) {
    problems.push('waiting for itself to take over')
  }

  return problems
}

// step works on a draft: a copy of the model whose fields it replaces, never changes in place
interface Draft<State, Move> extends Model<State, Move> {
  effects: Effect[]
  env: Env
}

const blankPeer: Peer = {playerId: null, away: false, bye: false, lost: false, unreachable: false}

const setPeer = <State, Move>(draft: Draft<State, Move>, peerId: string, change: Partial<Peer>) => {
  draft.peers = {...draft.peers, [peerId]: {...(draft.peers[peerId] ?? blankPeer), ...change}}
}

const isLost = <State, Move>(draft: Draft<State, Move>, peerId: string) => draft.peers[peerId]?.lost === true

const departedOf = <State, Move>(draft: Draft<State, Move>) => Object.keys(draft.peers).filter(peerId => isLost(draft, peerId))

const selfId = <State, Move>(draft: Draft<State, Move>) => draft.config.self.peerId

const send = <State, Move>(draft: Draft<State, Move>, action: Action, data: string, target?: string) =>
  draft.effects.push(target ? {type: 'send', action, data, target} : {type: 'send', action, data})

// Tells the others (or one peer that just joined) whose connection this is and whether its page is
// hidden. Sent while the page still runs: once a phone freezes it, nothing goes out.
const tellPresence = <State, Move>(draft: Draft<State, Move>, target?: string) =>
  send(draft, 'presence', encode({playerId: draft.config.self.playerId, away: draft.page.hidden}), target)

// The peers this tab is linked to and knows the players of, as members
const connectedMembers = <State, Move>(draft: Draft<State, Move>): Member[] =>
  [...draft.env.peers].flatMap(peerId => {
    const playerId = draft.peers[peerId]?.playerId
    return playerId ? [{playerId, peerId}] : []
  })

// A page that was hidden may have been frozen, as phones do, and its last snapshot may be old: the
// host may have gone on without it. It was hidden if it still is, or was shown again only recently.
const wasJustAway = <State, Move>(draft: Draft<State, Move>) =>
  draft.page.hidden || draft.env.now - draft.page.backAt < draft.config.takeoverDelayMs * 12

// Whether a peer's page is hidden: it said so to this tab, or the host this tab took over from
// marked it so in its last snapshot, when the word reached that host but not this tab
const isAway = <State, Move>(draft: Draft<State, Move>, room: RoomState<State>, peerId: string) => {
  const member = memberByPeer(room, peerId)
  return draft.peers[peerId]?.away === true || (member !== null && room.absent[member.playerId] === 'away')
}

// The players that are not here, as the host sees them: whose page is hidden (they said so), or
// whose link dropped and whose place the host holds
const absentOf = <State, Move>(draft: Draft<State, Move>, room: RoomState<State>): Record<string, Absence> => {
  const holds = draft.phase.name === 'hosting' ? draft.phase.holds : {}

  return Object.fromEntries(
    room.members.flatMap(({playerId, peerId}): [string, Absence][] => {
      if (holds[peerId]?.status === 'held') {
        return [[playerId, 'offline']]
      }

      const away = peerId === selfId(draft) ? draft.page.hidden : draft.peers[peerId]?.away === true
      return away ? [[playerId, 'away']] : []
    })
  )
}

// The phase a room puts this tab in: hosting if it names this tab as host, waiting for a new host
// if this tab lost the one it names, following it otherwise. A phase that stays keeps its own data.
const settle = <State, Move>(draft: Draft<State, Move>, room: RoomState<State>) => {
  const host = hostOf(room)?.peerId

  if (host === selfId(draft)) {
    draft.phase = {name: 'hosting', room, holds: draft.phase.name === 'hosting' ? draft.phase.holds : {}}
  } else if (host !== undefined && isLost(draft, host)) {
    decideHostLost(draft, room)
  } else {
    draft.phase = {name: 'following', room, confirmBy: null}
  }
}

// The host broadcasts every new state, even when nothing changed: it puts a guest with a stale
// view right again. A room that names another host (this player's newer tab) hands it over.
const commit = <State, Move>(draft: Draft<State, Move>, room: RoomState<State>) => {
  const next = {...room, absent: absentOf(draft, room)}
  send(draft, 'snapshot', encode(next))
  settle(draft, next)
}

const sendToHost = <State, Move>(draft: Draft<State, Move>, intent: NumberedIntent<Move>) => {
  const room = roomOf(draft.phase)
  const host = room ? hostOf(room)?.peerId : undefined

  if (host !== undefined && host !== selfId(draft)) {
    send(draft, 'intent', encode(intent), host)
  }
}

// A guest that becomes a host applies its own unhandled intent to the room it now runs
const withPending = <State, Move>(draft: Draft<State, Move>, room: RoomState<State>): RoomState<State> => {
  const {pending} = draft
  draft.pending = null

  return pending ? applyIntent(draft.config.rules, room, draft.config.self.playerId, pending) : room
}

// A guest's last intent may have died with the old host. A new host that has not handled it gets it once more.
const settlePending = <State, Move>(draft: Draft<State, Move>, hostChanged: boolean) => {
  const {pending} = draft
  const room = roomOf(draft.phase)

  if (!pending || !room || draft.phase.name === 'hosting') {
    return
  }

  if ((room.handled[draft.config.self.playerId] ?? 0) >= pending.id) {
    draft.pending = null
  } else if (hostChanged) {
    sendToHost(draft, pending)
  }
}

// The reclaim of a tab that joins again. A host hosts again if no host speaks within twice the
// takeover pause. A guest that was in the room does too, but only after four times the pause: a
// host answers at once, so by then everyone left is a guest waiting like it (the host went while
// they were all reloading or away). A tab that never was in the room waits for a host: its code
// may be wrong.
const reclaimFor = <State, Move>(draft: Draft<State, Move>, lastRoom: RoomState<State> | null, hostIfAlone: boolean): Reclaim<State> | null => {
  const {now} = draft.env
  const {takeoverDelayMs} = draft.config

  if (hostIfAlone) {
    return {at: now + takeoverDelayMs * 2, lastRoom, asMember: false}
  }

  return lastRoom ? {at: now + takeoverDelayMs * 4, lastRoom, asMember: true} : null
}

// Leaves the room and joins it again as a newcomer, with new links. As the same player, it gets
// its place and seat back if the host still has them, and it sends its pending intent again to
// the host it finds. If no host speaks in time, it may host the room itself (see reclaimFor).
const joinAgain = <State, Move>(draft: Draft<State, Move>, lastRoom: RoomState<State> | null, hostIfAlone: boolean) => {
  draft.effects.push({type: 'rejoin'})
  draft.env = {...draft.env, peers: new Set()}
  draft.peers = {}
  draft.page = {...draft.page, revive: null}
  draft.phase = {name: 'waiting', reclaim: reclaimFor(draft, lastRoom, hostIfAlone)}
}

// How this tab joins again from the phase it is in: a host, or a tab about to host, hosts again if
// nobody else turns up. A guest waits for a host.
const joinAgainFrom = <State, Move>(draft: Draft<State, Move>) => {
  const {phase} = draft

  switch (phase.name) {
    case 'waiting':
      return joinAgain(draft, phase.reclaim?.lastRoom ?? null, phase.reclaim?.asMember === false)
    case 'detached':
      return joinAgain(draft, phase.room, phase.hostIfAlone)
    case 'hosting':
      return joinAgain(draft, phase.room, true)
    case 'following':
    case 'hostLost':
      return joinAgain(draft, phase.room, false)
    case 'closed':
      return
  }
}

const close = <State, Move>(draft: Draft<State, Move>, hostLeft: boolean) => {
  draft.phase = {name: 'closed', room: roomOf(draft.phase), hostLeft}
  draft.effects.push({type: 'close'})
}

// Drops the player of a connection that is gone, without broadcasting: the caller commits. A
// player that has another tab in the room moves to that connection instead, and a player on
// another connection by now is left alone.
const dropMember = <State, Move>(draft: Draft<State, Move>, peerId: string) => {
  if (draft.phase.name !== 'hosting') {
    return
  }

  const {room, holds} = draft.phase
  const {[peerId]: _, ...rest} = holds
  const member = memberByPeer(room, peerId)
  const otherTab = member && connectedMembers(draft).find(each => each.playerId === member.playerId && each.peerId !== peerId)
  const next = !member ? room : otherTab ? joinPlayer(room, otherTab) : dropPlayer(draft.config.rules, room, member.playerId)

  draft.phase = {...draft.phase, room: next, holds: rest}
}

// A host holds a member whose link dropped for twice the takeover pause: if that member is next
// in line and takes over meanwhile, its snapshot reaches the others while they still count it as
// next in line. A member that stepped away is held for awayHoldMs: a phone freezes a hidden page,
// its links drop, and it comes back when the player returns. A member that said goodbye is
// dropped at once. Without broadcasting: the caller commits.
const holdOrDrop = <State, Move>(draft: Draft<State, Move>, peerId: string) => {
  if (draft.phase.name !== 'hosting' || !memberByPeer(draft.phase.room, peerId)) {
    return
  }

  const {room, holds} = draft.phase
  const {now} = draft.env
  const {takeoverDelayMs, awayHoldMs} = draft.config
  const since = holds[peerId]?.since ?? now
  const until = since + (isAway(draft, room, peerId) ? awayHoldMs : takeoverDelayMs * 2)

  if (draft.peers[peerId]?.bye || until <= now) {
    dropMember(draft, peerId)
    return
  }

  draft.phase = {...draft.phase, holds: {...holds, [peerId]: {status: 'held', since, until}}}
}

// The new host starts from the last snapshot: with the peers it is linked to, and with its own
// unhandled intent applied. The old host stays a member with its seat, last in line, and is held
// like any member whose link dropped: for the usual wait, longer if it stepped away, and not at
// all if it said goodbye. So are the members this tab lost meanwhile.
const takeOver = <State, Move>(draft: Draft<State, Move>, room: RoomState<State>) => {
  const promoted = promote(room, selfId(draft))
  draft.phase = {name: 'hosting', room: withPending(draft, connectedMembers(draft).reduce(joinPlayer, promoted)), holds: {}}
  departedOf(draft).forEach(peerId => holdOrDrop(draft, peerId))
  commit(draft, draft.phase.room)
}

// A guest whose host's link dropped. Run on entry, on every change of the links, and when its
// deadline comes. Every peer works out the same member next in line from the same last snapshot:
// - nobody: the host is gone for good, and the session leaves the room (hostLeft).
// - another member: it should take over soon. If it hasn't four pauses later, this tab's own links
//   are what dropped, and it joins the room again.
// - this tab: it takes over after a pause, or at once if the host said goodbye. A page that was
//   just away joins again instead, since its snapshot may be old: it finds the host if it is still
//   there, and hosts the game as it was if nobody is.
// A deadline stays while the member it waits for does.
const decideHostLost = <State, Move>(draft: Draft<State, Move>, room: RoomState<State>) => {
  const previous = draft.phase.name === 'hostLost' ? draft.phase.next : null
  const host = hostOf(room)
  const successor = successorOf(room, departedOf(draft))
  const {now} = draft.env
  const {takeoverDelayMs} = draft.config

  if (!host || !successor) {
    close(draft, true)
    return
  }

  if (successor.peerId !== selfId(draft)) {
    const same = previous?.name === 'awaitingSuccessor' && previous.successor === successor.peerId
    const at = same ? previous.at : now + takeoverDelayMs * 4

    if (at <= now) {
      joinAgain(draft, room, false)
    } else {
      draft.phase = {name: 'hostLost', room, next: {name: 'awaitingSuccessor', successor: successor.peerId, at}}
    }

    return
  }

  if (wasJustAway(draft)) {
    joinAgain(draft, room, true)
    return
  }

  const at = draft.peers[host.peerId]?.bye ? now : previous?.name === 'takingOver' ? previous.at : now + takeoverDelayMs

  if (at <= now) {
    takeOver(draft, room)
  } else {
    draft.phase = {name: 'hostLost', room, next: {name: 'takingOver', at}}
  }
}

// A tab that heard from no host in time hosts the room again: resumed with the game as it last saw
// it, or fresh after a reload. Peers around it are no reason to wait: a host answers at once, so
// they are guests waiting like this one, and they follow. Two tabs that host again at the same
// time are settled by winsTie, and either gives way to the room if it went on elsewhere. Its
// pending intent goes in, as with a takeover. A guest's room keeps the game but is fresh, so it
// never replaces a room that went on, and it waits on while that room may be out of its reach.
const reclaim = <State, Move>(draft: Draft<State, Move>, {lastRoom, asMember}: Reclaim<State>) => {
  const {rules, self, takeoverDelayMs} = draft.config
  const {now, signalingOpen} = draft.env

  if (asMember && (!signalingOpen || Object.values(draft.peers).some(peer => peer.unreachable))) {
    draft.phase = {name: 'waiting', reclaim: {at: now + takeoverDelayMs * 4, lastRoom, asMember}}
    return
  }

  const resumed = lastRoom ? hostAlone(rules, lastRoom, self) : createRoomState(rules, self, 'fresh')
  const room = asMember ? {...resumed, origin: 'fresh' as const} : resumed
  draft.phase = {name: 'hosting', room, holds: {}}
  commit(draft, withPending(draft, connectedMembers(draft).reduce(joinPlayer, room)))
}

// A peer that joined says whose connection it is (presence); the host adds it then. A held member
// that is back starts settling. A guest whose host is back follows it again, if it answers: a host
// answers every presence with the room, and a tab that went and came back may host no more.
const peerJoined = <State, Move>(draft: Draft<State, Move>, peerId: string) => {
  setPeer(draft, peerId, {playerId: null, bye: false, lost: false, unreachable: false})
  const {phase} = draft

  if (phase.name === 'hosting') {
    const hold = phase.holds[peerId]

    if (hold) {
      const settling: Hold = {status: 'settling', since: hold.since, until: draft.env.now + draft.config.takeoverDelayMs * 2}
      draft.phase = {...phase, holds: {...phase.holds, [peerId]: settling}}
    }
  } else if (phase.name === 'hostLost') {
    settle(draft, phase.room)
  }

  if (draft.phase.name === 'following' && hostOf(draft.phase.room)?.peerId === peerId) {
    draft.phase = {...draft.phase, confirmBy: draft.env.now + draft.config.takeoverDelayMs * 2}
  }

  tellPresence(draft, peerId)
}

// Trystero reports a dropped link, which is not always a peer leaving the room. A host holds the
// member's place and tells the others, who see it as offline. A guest that lost its host waits
// for the next member in line.
const peerLeft = <State, Move>(draft: Draft<State, Move>, peerId: string) => {
  setPeer(draft, peerId, {lost: true})
  const {phase} = draft

  if (phase.name === 'hosting') {
    if (memberByPeer(phase.room, peerId)) {
      holdOrDrop(draft, peerId)
      commit(draft, draft.phase.name === 'hosting' ? draft.phase.room : phase.room)
    }
  } else if (phase.name === 'following' || phase.name === 'hostLost') {
    settle(draft, phase.room)
  }
}

const peerUnreachable = <State, Move>(draft: Draft<State, Move>, peerId: string) => {
  if (!draft.env.peers.has(peerId)) {
    setPeer(draft, peerId, {unreachable: true})
  }
}

// Every peer keeps track of whose connection each peer is and whether its page is hidden, so a
// member that takes over later knows who to add and who stepped away. The host adds the player to
// the room, or moves it to this connection, and broadcasts the room: a connection that joined gets
// the state at once, and everyone sees who stepped away or came back.
const receivePresence = <State, Move>(draft: Draft<State, Move>, data: unknown, sender: string) => {
  const presence = decodePresence(data)

  if (!presence) {
    return
  }

  setPeer(draft, sender, {playerId: presence.playerId, away: presence.away})

  if (draft.phase.name === 'hosting') {
    commit(draft, joinPlayer(draft.phase.room, {playerId: presence.playerId, peerId: sender}))
  }
}

const receiveBye = <State, Move>(draft: Draft<State, Move>, sender: string) => {
  setPeer(draft, sender, {bye: true})

  if (draft.phase.name === 'hosting' && draft.phase.holds[sender]?.status === 'held') {
    dropMember(draft, sender)
    commit(draft, draft.phase.room)
  }
}

const receiveSnapshot = <State, Move>(draft: Draft<State, Move>, data: unknown, sender: string) => {
  const snapshot = decodeSnapshot(draft.config.rules, data)

  if (!snapshot) {
    return
  }

  const {phase} = draft
  const known = roomOf(phase)
  const source = {selfId: selfId(draft), departed: departedOf(draft), sender}

  if (acceptsSnapshot(known, snapshot, source)) {
    const newHost = hostOf(snapshot)?.peerId ?? sender

    // Its host stepped down for a host this tab has no link to: following it would leave this tab
    // with nobody to send to or hear from. Joining again finds the room as it reaches it now.
    if (newHost !== sender && newHost !== selfId(draft) && !draft.env.peers.has(newHost)) {
      joinAgain(draft, known, phase.name === 'hosting')
      return
    }

    // A host that steps down hands its guests to the new host
    if (phase.name === 'hosting') {
      send(draft, 'snapshot', data as string)
    }

    // A host this tab had not followed yet may not have its pending intent: one that took over, one
    // its host passes it on to, or the one it finds after joining again
    const hostChanged = (known ? hostOf(known)?.peerId : undefined) !== newHost
    settle(draft, snapshot)
    settlePending(draft, hostChanged)
  } else if (known && phase.name === 'hosting' && winsTie(known, snapshot, source)) {
    commit(draft, {...known, term: known.term + 1})
  }
}

// Only an intent that changes the game goes to everyone. A duplicate or a rejected one goes back to
// its sender alone, so it stops resending, and a member that sends nonsense makes no broadcasts.
// Only the connection that controls a player speaks for it: an older tab of the same player is ignored.
const receiveIntent = <State, Move>(draft: Draft<State, Move>, data: unknown, sender: string) => {
  const {phase} = draft

  if (phase.name !== 'hosting') {
    return
  }

  const member = memberByPeer(phase.room, sender)
  const intent = member && decodeIntent(draft.config.rules, data)

  if (!member || !intent) {
    return
  }

  const next = applyIntent(draft.config.rules, phase.room, member.playerId, intent)

  if (next.game !== phase.room.game) {
    commit(draft, next)
    return
  }

  draft.phase = {...phase, room: next}
  send(draft, 'snapshot', encode(next), sender)
}

// Only leave() says goodbye: a page that unloads just drops its links, and the host holds its
// player's place and seat, so a reloaded tab comes back to them. A page that goes (pagehide)
// leaves the room, so the others hear at once instead of waiting for WebRTC to give up on the
// link: Trystero leaves on beforeunload only, which iOS Safari never fires. Trystero's leave also
// means a page that is still here a takeover pause later was not unloaded: the user stayed, or the
// next page is slow. A page back from the back-forward cache was gone meanwhile. Either way it
// joins again. A hidden page only tells the others, and a hidden host sends the room so they see
// it marked: it keeps running, and stays in the room as it is.
const receivePageEvent = <State, Move>(draft: Draft<State, Move>, event: PageEvent) => {
  const {phase, page} = draft

  switch (event) {
    case 'away':
    case 'back':
      draft.page = {...page, hidden: event === 'away', backAt: event === 'back' && page.hidden ? draft.env.now : page.backAt}

      if (phase.name !== 'detached') {
        tellPresence(draft)
      }

      if (phase.name === 'hosting') {
        commit(draft, phase.room)
      }

      return
    case 'leaving':
      draft.page = {...page, revive: draft.env.now + draft.config.takeoverDelayMs}
      return
    case 'gone': {
      const hostIfAlone = phase.name === 'hosting' || (phase.name === 'waiting' && phase.reclaim?.asMember === false)
      const room = phase.name === 'waiting' ? (phase.reclaim?.lastRoom ?? null) : roomOf(phase)
      draft.page = {...page, revive: null}
      draft.phase = {name: 'detached', room, hostIfAlone}
      draft.effects.push({type: 'detach'})
      return
    }
    case 'shown':
      joinAgainFrom(draft)
      return
  }
}

const sendIntent = <State, Move>(draft: Draft<State, Move>, intent: Intent<Move>) => {
  const numbered = {...intent, id: draft.nextIntentId}
  draft.nextIntentId += 1

  if (draft.phase.name === 'hosting') {
    commit(draft, applyIntent(draft.config.rules, draft.phase.room, draft.config.self.playerId, numbered))
    return
  }

  draft.pending = numbered
  sendToHost(draft, numbered)
}

const deadline = <State, Move>(draft: Draft<State, Move>, key: string) => {
  const {phase} = draft

  if (key === reviveTimer) {
    joinAgainFrom(draft)
  } else if (key === phaseTimer && phase.name === 'waiting' && phase.reclaim) {
    reclaim(draft, phase.reclaim)
  } else if (key === phaseTimer && phase.name === 'following') {
    joinAgain(draft, phase.room, false)
  } else if (key === phaseTimer && phase.name === 'hostLost') {
    decideHostLost(draft, phase.room)
  } else if (phase.name === 'hosting' && key.startsWith(holdTimer(''))) {
    const peerId = key.slice(holdTimer('').length)
    const hold = phase.holds[peerId]

    if (hold?.status === 'held') {
      dropMember(draft, peerId)
      commit(draft, draft.phase.name === 'hosting' ? draft.phase.room : phase.room)
    } else if (hold) {
      const {[peerId]: _, ...rest} = phase.holds
      draft.phase = {...phase, holds: rest}
    }
  }
}

const fromRoom = new Set<Event<unknown>['type']>(['peerJoined', 'peerLeft', 'unreachable', 'snapshot', 'intent', 'presence', 'bye'])

const handle = <State, Move>(draft: Draft<State, Move>, event: Event<Move>) => {
  // A page that went hears nothing more from the room it left
  if (draft.phase.name === 'detached' && fromRoom.has(event.type)) {
    return
  }

  switch (event.type) {
    case 'peerJoined':
      return peerJoined(draft, event.peerId)
    case 'peerLeft':
      return peerLeft(draft, event.peerId)
    case 'unreachable':
      return peerUnreachable(draft, event.peerId)
    case 'snapshot':
      return receiveSnapshot(draft, event.data, event.sender)
    case 'intent':
      return receiveIntent(draft, event.data, event.sender)
    case 'presence':
      return receivePresence(draft, event.data, event.sender)
    case 'bye':
      return receiveBye(draft, event.sender)
    case 'page':
      return receivePageEvent(draft, event.event)
    case 'send':
      return sendIntent(draft, event.intent)
    case 'leave':
      if (draft.phase.name !== 'detached') {
        send(draft, 'bye', '')
      }

      return close(draft, false)
    case 'deadline': {
      // Only a deadline the model still waits for, and only once it is due
      const at = timersOf(draft).get(event.key)

      if (at !== undefined && at <= draft.env.now) {
        if (event.key === reviveTimer) {
          draft.page = {...draft.page, revive: null}
        }

        deadline(draft, event.key)
      }
    }
  }
}

// The next model and what to do. A closed session stays closed, whatever it hears.
export const step = <State, Move>(
  model: Model<State, Move>,
  event: Event<Move>,
  env: Env
): {model: Model<State, Move>; effects: Effect[]} => {
  if (model.phase.name === 'closed') {
    return {model, effects: []}
  }

  const draft: Draft<State, Move> = {...model, effects: [], env}
  handle(draft, event)
  const {effects, env: _, ...next} = draft

  return {model: next, effects}
}
