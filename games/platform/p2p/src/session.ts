// Connects a game to its room over a Transport (Trystero in the browser, see
// trystero-transport.ts). The host runs the rules and broadcasts every new room state. Guests
// send their intents to the host and show what it broadcasts. When the host leaves, the next
// member takes over (see succession.ts). Nothing is stored on a server: the signaling server only
// helps browsers find each other.
import type {MessageAction} from '@trystero-p2p/ws-relay'
import {decodeIntent, decodePresence, decodeSnapshot, encode} from './protocol.ts'
import {applyIntent, createRoomState, dropPlayer, hostOf as hostOfRoom, joinPlayer, memberByPeer, memberByPlayer} from './room-state.ts'
import type {Absence, GameRules, Intent, Member, NumberedIntent, RoomState} from './room-state.ts'
import {acceptsSnapshot, hostAlone, promote, successorOf, winsTie} from './succession.ts'
import type {PageEvent, SessionRoom, Transport} from './transport.ts'
import {trystero} from './trystero-transport.ts'

const logError = (error: unknown) => console.warn('p2p:', error)

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

export interface SessionOptions<State, Move> {
  // One per game, so rooms with the same code in different games never meet
  appId: string
  code: string
  // Who this tab plays as. A room keeps a player's place and seat across its connections: a tab
  // that reloads comes back to them, and a second tab of the same player takes them over.
  playerId: string
  isHost: boolean
  // For a guest whose tab hosted this room before it reloaded: if it neither hears from a host nor
  // meets a peer within twice takeoverDelayMs, it hosts the room again, with a new game. A room
  // that went on under another host has a newer term, so this tab steps down when it gets there.
  rejoinAsHost?: boolean
  // For a host: this tab starts the room under a code it was given, whose room it could not reach
  // yet. A provisional room gives way to the room it stands in for when they meet (see winsTie).
  provisional?: boolean
  rules: GameRules<State, Move>
  onChange: (view: SessionView<State>) => void
  // How long the next member waits before it takes over from a host whose link dropped.
  // A host that comes back within it keeps the room.
  takeoverDelayMs?: number
  // How long the room holds the place and seat of a member that stepped away (its page was hidden)
  // and then lost its link. Default 2 minutes.
  awayHoldMs?: number
}

export interface Session<Move> {
  send: (intent: Intent<Move>) => void
  // Whether this tab is connected to the signaling server right now. Without it, a guest can't
  // find its room.
  isSignalingOpen: () => boolean
  leave: () => Promise<void>
}

const defaultTakeoverDelayMs = 2500
const defaultAwayHoldMs = 120_000

// Everything a session tracks. The functions below change it in place.
interface Context<State, Move> {
  selfId: string
  playerId: string
  transport: Transport
  appId: string
  code: string
  room: SessionRoom
  rules: GameRules<State, Move>
  snapshots: MessageAction<string>
  intents: MessageAction<string>
  byes: MessageAction<string>
  presences: MessageAction<string>
  onChange: (view: SessionView<State>) => void
  takeoverDelayMs: number
  awayHoldMs: number
  state: RoomState<State> | null
  // Whose connection each peer is, as it said when it joined (see receivePresence)
  players: Map<string, string>
  // Peers whose link dropped and that have not come back
  departed: string[]
  // Peers whose page is hidden, as they said last (see receivePresence)
  away: Set<string>
  // This tab's page is hidden
  selfAway: boolean
  // When this tab's page was last shown again after being hidden (see wasJustAway)
  backAt: number
  // The room as this tab last saw it before joining again, for hosting it alone (see reclaimRoom)
  lastRoom: RoomState<State> | null
  // Peers the signaling server found that this tab could not connect to
  unreachable: Set<string>
  // A host's timers for dropping members whose link dropped (see scheduleRemoval)
  removals: Map<string, ReturnType<typeof setTimeout>>
  // A host's record of when it first lost each peer's link, until the link has held for a while
  // again: a link that keeps dropping gets one wait in all, not a fresh one each time (see holdOf)
  holds: Map<string, {since: number; settled: ReturnType<typeof setTimeout> | undefined}>
  // Peers that said goodbye before leaving, so a host drops them at once
  saidBye: Set<string>
  // The last intent this guest sent, until a snapshot shows the host handled it
  pending: NumberedIntent<Move> | null
  nextIntentId: number
  takeover: ReturnType<typeof setTimeout> | undefined
  // A guest's timer for joining again when no new host turns up (see scheduleRejoin)
  rejoin: ReturnType<typeof setTimeout> | undefined
  // A guest's timer for hosting the room again after a reload (see rejoinAsHost)
  reclaim: ReturnType<typeof setTimeout> | undefined
  // The timer for joining again when the page stays after beforeunload (see receivePageEvent)
  revive: ReturnType<typeof setTimeout> | undefined
  hostLeft: boolean
  // Stops listening to the page's lifecycle events
  stopPageEvents: () => void
  // The leave that closed this session for good (see close)
  closed: Promise<void> | null
}

const self = <State, Move>(context: Context<State, Move>): Member => ({playerId: context.playerId, peerId: context.selfId})

const hostOf = <State, Move>(context: Context<State, Move>) => (context.state ? hostOfRoom(context.state) : null)

type Hosting<State, Move> = Context<State, Move> & {state: RoomState<State>}

// Whether this tab hosts the room right now
const isHost = <State, Move>(context: Context<State, Move>): context is Hosting<State, Move> =>
  hostOf(context)?.peerId === context.selfId

const publish = <State, Move>(context: Context<State, Move>) => {
  const host = hostOf(context)
  const player = context.state ? memberByPlayer(context.state, context.playerId) : null

  context.onChange({
    selfId: context.selfId,
    playerId: context.playerId,
    isHost: host?.peerId === context.selfId,
    inControl: player === null || player.peerId === context.selfId,
    room: context.state,
    switchingHost: host !== null && context.departed.includes(host.peerId),
    hostLeft: context.hostLeft,
    unreachable: context.unreachable.size > 0
  })
}

// The players that are not here, as the host sees them: whose page is hidden (they said so, see
// receivePresence), or whose link dropped and whose place the host holds (see scheduleRemoval)
const absentOf = <State, Move>(context: Context<State, Move>, room: RoomState<State>): Record<string, Absence> =>
  Object.fromEntries(
    room.members.flatMap(({playerId, peerId}): [string, Absence][] => {
      if (context.removals.has(peerId)) {
        return [[playerId, 'offline']]
      }

      return context.away.has(peerId) || (peerId === context.selfId && context.selfAway) ? [[playerId, 'away']] : []
    })
  )

// The host broadcasts every new state, even when nothing changed: it puts a guest with a stale view right again
const commit = <State, Move>(context: Context<State, Move>, next: RoomState<State>) => {
  context.state = {...next, absent: absentOf(context, next)}
  context.snapshots.send(encode(context.state)).catch(logError)
  publish(context)
}

const sendToHost = <State, Move>(context: Context<State, Move>, intent: NumberedIntent<Move>) => {
  const host = hostOf(context)

  if (host && host.peerId !== context.selfId) {
    context.intents.send(encode(intent), {target: host.peerId}).catch(logError)
  }
}

// A guest's last intent may have died with the old host. A new host that has not handled it gets it once more.
const settlePending = <State, Move>(context: Context<State, Move>, hostChanged: boolean) => {
  const {pending, state} = context

  if (!pending || !state) {
    return
  }

  if ((state.handled[context.playerId] ?? 0) >= pending.id) {
    context.pending = null
  } else if (hostChanged) {
    sendToHost(context, pending)
  }
}

const clearRemovals = <State, Move>(context: Context<State, Move>) => {
  context.removals.forEach(timer => clearTimeout(timer))
  context.removals.clear()
}

const clearHolds = <State, Move>(context: Context<State, Move>) => {
  context.holds.forEach(hold => clearTimeout(hold.settled))
  context.holds.clear()
}

const clearTimers = <State, Move>(context: Context<State, Move>) => {
  clearTimeout(context.takeover)
  clearTimeout(context.rejoin)
  clearTimeout(context.reclaim)
  clearTimeout(context.revive)
  clearRemovals(context)
  clearHolds(context)
}

// Leaves the room for good. Leaving takes a while, and the links drop meanwhile: the session
// ignores what it still hears, so no event, timer or page event brings it back into the room.
// Closing again gives the same leave.
const close = <State, Move>(context: Context<State, Move>): Promise<void> => {
  if (!context.closed) {
    context.stopPageEvents()
    clearTimers(context)
    context.closed = context.room.leave()
  }

  return context.closed
}

const cancelRemoval = <State, Move>(context: Context<State, Move>, peerId: string) => {
  clearTimeout(context.removals.get(peerId))
  context.removals.delete(peerId)
}

// Drops the player of a connection that is gone, unless the player is on another connection by now
const dropMember = <State, Move>(context: Context<State, Move>, peerId: string) => {
  cancelRemoval(context, peerId)
  clearTimeout(context.holds.get(peerId)?.settled)
  context.holds.delete(peerId)

  if (isHost(context)) {
    const member = memberByPeer(context.state, peerId)

    if (member) {
      commit(context, dropPlayer(context.rules, context.state, member.playerId))
    }
  }
}

// When the host first lost this peer's link. A link that comes back and drops again within twice
// the takeover pause continues the same hold, so a flapping link never holds a seat for longer than
// one wait in all. A link that has held that long starts over (see peerJoined).
const holdOf = <State, Move>(context: Context<State, Move>, peerId: string) => {
  const hold = context.holds.get(peerId) ?? {since: Date.now(), settled: undefined}
  clearTimeout(hold.settled)
  hold.settled = undefined
  context.holds.set(peerId, hold)
  return hold
}

// A host drops a member whose link dropped only after twice the takeover pause. If that member is
// next in line and takes over meanwhile, its snapshot reaches the others while they still count
// it as next in line. A member that comes back in time keeps its place and seat, as does a player
// that comes back on a new connection. A member that stepped away is held for awayHoldMs: a phone
// freezes a hidden page, its links drop, and it comes back when the player returns. A member that
// said goodbye is dropped at once.
const scheduleRemoval = <State, Move>(context: Context<State, Move>, peerId: string) => {
  if (context.saidBye.has(peerId)) {
    dropMember(context, peerId)
    return
  }

  const holdMs = context.away.has(peerId) ? context.awayHoldMs : context.takeoverDelayMs * 2
  const left = holdOf(context, peerId).since + holdMs - Date.now()

  if (left <= 0) {
    dropMember(context, peerId)
    return
  }

  cancelRemoval(context, peerId)
  context.removals.set(
    peerId,
    setTimeout(() => dropMember(context, peerId), left)
  )
}

// Every peer keeps track of whose connection each peer is and whether its page is hidden, so a
// member that takes over later knows who to add and who stepped away. The host adds the player to
// the room, or moves it to this connection, and broadcasts the room: a connection that joined gets
// the state at once, and everyone sees who stepped away or came back.
const receivePresence = <State, Move>(context: Context<State, Move>, data: unknown, sender: string) => {
  const presence = decodePresence(data)

  if (!presence) {
    return
  }

  context.players.set(sender, presence.playerId)

  if (presence.away) {
    context.away.add(sender)
  } else {
    context.away.delete(sender)
  }

  if (isHost(context)) {
    commit(context, joinPlayer(context.state, {playerId: presence.playerId, peerId: sender}))
  }
}

// Tells the others (or one peer that just joined) whose connection this is and whether its page is
// hidden. Sent while the page still runs: once a phone freezes it, nothing goes out.
const tellPresence = <State, Move>(context: Context<State, Move>, target?: string) =>
  context.presences
    .send(encode({playerId: context.playerId, away: context.selfAway}), target ? {target} : undefined)
    .catch(logError)

const receiveBye = <State, Move>(context: Context<State, Move>, sender: string) => {
  context.saidBye.add(sender)

  if (context.removals.has(sender)) {
    dropMember(context, sender)
  }
}

const applySnapshot = <State, Move>(context: Context<State, Move>, snapshot: RoomState<State>) => {
  // A host this tab had not followed yet may not have its pending intent: one that took over, one
  // its host passes it on to, or the one it finds after joining again
  const hostChanged = hostOf(context)?.peerId !== hostOfRoom(snapshot)?.peerId
  clearTimers(context)
  context.state = snapshot
  settlePending(context, hostChanged)
  publish(context)
}

const receiveSnapshot = <State, Move>(context: Context<State, Move>, data: unknown, sender: string) => {
  const snapshot = decodeSnapshot(context.rules, data)

  if (!snapshot) {
    return
  }

  const {state} = context
  const source = {selfId: context.selfId, departed: context.departed, sender}

  if (acceptsSnapshot(state, snapshot, source)) {
    const newHost = hostOfRoom(snapshot)?.peerId ?? sender

    // Its host stepped down for a host this tab has no link to: following it would leave this tab
    // with nobody to send to or hear from. Joining again finds the room as it reaches it now.
    if (newHost !== sender && newHost !== context.selfId && !(newHost in context.room.getPeers())) {
      joinAgain(context)
      return
    }

    const wasHost = isHost(context)
    applySnapshot(context, snapshot)

    // A host that steps down hands its guests to the new host
    if (wasHost) {
      context.snapshots.send(data as string).catch(logError)
    }
  } else if (state && winsTie(state, snapshot, source)) {
    commit(context, {...state, term: state.term + 1})
  }
}

// Only an intent that changes the game goes to everyone. A duplicate or a rejected one goes back to
// its sender alone, so it stops resending, and a member that sends nonsense makes no broadcasts.
// Only the connection that controls a player speaks for it: an older tab of the same player is ignored.
const receiveIntent = <State, Move>(context: Context<State, Move>, data: unknown, sender: string) => {
  if (!isHost(context)) {
    return
  }

  const {state} = context
  const member = memberByPeer(state, sender)
  const intent = member && decodeIntent(context.rules, data)

  if (!member || !intent) {
    return
  }

  const next = applyIntent(context.rules, state, member.playerId, intent)

  if (next.game !== state.game) {
    commit(context, next)
    return
  }

  context.state = next
  context.snapshots.send(encode(next), {target: sender}).catch(logError)
  publish(context)
}

// A guest that becomes a host applies its own unhandled intent to the room it now runs
const withPending = <State, Move>(context: Context<State, Move>, room: RoomState<State>): RoomState<State> => {
  const {pending} = context
  context.pending = null

  return pending ? applyIntent(context.rules, room, context.playerId, pending) : room
}

// The peers this tab is connected to and knows the players of, as members
const connectedMembers = <State, Move>(context: Context<State, Move>): Member[] =>
  Object.keys(context.room.getPeers()).flatMap(peerId => {
    const playerId = context.players.get(peerId)
    return playerId ? [{playerId, peerId}] : []
  })

// The new host starts from the last snapshot: with the peers it is connected to, and with its own
// unhandled intent applied. The old host stays a member with its seat, last in line, and is held
// like any member whose link dropped: for the usual wait, longer if it stepped away, and not at
// all if it said goodbye. So are the members this host lost meanwhile.
const takeOver = <State, Move>(context: Context<State, Move>) => {
  const {state, departed} = context
  const host = hostOf(context)

  if (!state || !host || !departed.includes(host.peerId) || successorOf(state, departed)?.peerId !== context.selfId) {
    return
  }

  const promoted = promote(state, context.selfId)
  const next = withPending(context, connectedMembers(context).reduce(joinPlayer, promoted))
  // This tab hosts from here on, so the holds it schedules show in the snapshot it sends
  context.state = next
  departed.filter(peerId => memberByPeer(next, peerId)).forEach(peerId => scheduleRemoval(context, peerId))
  commit(context, context.state)
}

const scheduleReclaim = <State, Move>(context: Context<State, Move>) => {
  clearTimeout(context.reclaim)
  context.reclaim = setTimeout(() => reclaimRoom(context), context.takeoverDelayMs * 2)
}

// Leaves the room and joins it again as a newcomer, with new links. As the same player, it gets
// its place and seat back if the host still has them, and it sends its pending intent again to
// the host it finds. With hostIfAlone (by default for a host), it hosts the room again with the
// game as it last saw it if nobody else is there (see reclaimRoom).
const joinAgain = <State, Move>(context: Context<State, Move>, hostIfAlone = isHost(context)) => {
  context.lastRoom = context.state
  context.room.leave().catch(logError)
  clearTimers(context)
  context.state = null
  context.players.clear()
  context.departed = []
  context.away.clear()
  context.unreachable.clear()
  context.saidBye.clear()
  context.hostLeft = false
  Object.assign(context, connect(context, () => context))

  if (hostIfAlone) {
    scheduleReclaim(context)
  }

  publish(context)
}

// A page that was hidden may have been frozen, as phones do, and its last snapshot may be old: the
// host may have gone on without it. It was hidden if it still is, or was shown again only recently.
const wasJustAway = <State, Move>(context: Context<State, Move>) =>
  context.selfAway || Date.now() - context.backAt < context.takeoverDelayMs * 12

// The links of this tab are what dropped, not the room, when the next member in line still
// hasn't taken over long after the host went quiet here: it would have by now, unless it still
// sees the host, or this tab lost it too. So this tab joins the room again.
const rejoinRoom = <State, Move>(context: Context<State, Move>) => {
  const host = hostOf(context)

  if (host && host.peerId !== context.selfId && context.departed.includes(host.peerId)) {
    joinAgain(context, false)
  }
}

// A guest that waits for the next member in line gives up after four times the takeover pause
const scheduleRejoin = <State, Move>(context: Context<State, Move>) => {
  clearTimeout(context.rejoin)
  context.rejoin = setTimeout(() => rejoinRoom(context), context.takeoverDelayMs * 4)
}

// When the host is gone, the next member that is still here takes over after a pause, or at once
// if the host said goodbye. Everyone else waits for that member's snapshot.
const scheduleTakeover = <State, Move>(context: Context<State, Move>) => {
  const {state, departed} = context
  const host = hostOf(context)

  if (!state || !host || !departed.includes(host.peerId)) {
    return
  }

  const successor = successorOf(state, departed)

  if (successor === null) {
    context.hostLeft = true
    close(context).catch(logError)
  } else if (successor.peerId !== context.selfId) {
    scheduleRejoin(context)
  } else if (wasJustAway(context)) {
    // Taking over from an old snapshot would undo what the host did meanwhile. Joining again
    // finds the host if it is still there, and hosts the game as it was if nobody is.
    joinAgain(context, true)
  } else if (context.saidBye.has(host.peerId)) {
    takeOver(context)
  } else {
    clearTimeout(context.takeover)
    context.takeover = setTimeout(() => takeOver(context), context.takeoverDelayMs)
  }
}

// A peer that joined says whose connection it is (see receivePresence); the host adds it then.
// A link that was held is forgotten once it has held for twice the takeover pause.
const peerJoined = <State, Move>(context: Context<State, Move>, peerId: string) => {
  const hold = context.holds.get(peerId)
  context.departed = context.departed.filter(id => id !== peerId)
  context.unreachable.delete(peerId)
  context.saidBye.delete(peerId)
  context.players.delete(peerId)
  cancelRemoval(context, peerId)

  if (hold) {
    clearTimeout(hold.settled)
    hold.settled = setTimeout(() => context.holds.delete(peerId), context.takeoverDelayMs * 2)
  }

  tellPresence(context, peerId)
  publish(context)
}

// Trystero reports a dropped link, which is not always a peer leaving the room. A host holds the
// member's place and tells the others, who see it as offline.
const peerLeft = <State, Move>(context: Context<State, Move>, peerId: string) => {
  context.departed = [...context.departed.filter(id => id !== peerId), peerId]

  if (isHost(context)) {
    scheduleRemoval(context, peerId)

    if (memberByPeer(context.state, peerId)) {
      commit(context, context.state)
    }

    return
  }

  scheduleTakeover(context)
  publish(context)
}

const peerUnreachable = <State, Move>(context: Context<State, Move>, peerId: string) => {
  if (!(peerId in context.room.getPeers())) {
    context.unreachable.add(peerId)
    publish(context)
  }
}

const send = <State, Move>(context: Context<State, Move>, intent: Intent<Move>) => {
  if (context.closed) {
    return
  }

  const numbered = {...intent, id: context.nextIntentId++}

  if (isHost(context)) {
    commit(context, applyIntent(context.rules, context.state, context.playerId, numbered))
    return
  }

  context.pending = numbered
  sendToHost(context, numbered)
}

type Connection<State, Move> = Pick<Context<State, Move>, 'room' | 'snapshots' | 'intents' | 'byes' | 'presences'>

// Joins the room and listens to it. Its events reach the session only while it is the session's
// room and the session is not closed.
const connect = <State, Move>(
  {transport, appId, code}: Pick<Context<State, Move>, 'transport' | 'appId' | 'code'>,
  getContext: () => Context<State, Move>
): Connection<State, Move> => {
  const whileCurrent =
    <Args extends unknown[]>(handler: (context: Context<State, Move>, ...args: Args) => void) =>
    (...args: Args) => {
      const context = getContext()

      if (!context.closed && context.room === room) {
        handler(context, ...args)
      }
    }
  const fromPeer = (handler: (context: Context<State, Move>, data: unknown, sender: string) => void) => {
    const guarded = whileCurrent(handler)
    return (data: unknown, {peerId}: {peerId: string}) => guarded(data, peerId)
  }

  const room = transport.join(appId, code, whileCurrent(peerUnreachable))
  const snapshots = room.makeAction('snapshot')
  const intents = room.makeAction('intent')
  const byes = room.makeAction('bye')
  const presences = room.makeAction('presence')
  snapshots.onMessage = fromPeer(receiveSnapshot)
  intents.onMessage = fromPeer(receiveIntent)
  byes.onMessage = fromPeer((context, _, sender) => receiveBye(context, sender))
  presences.onMessage = fromPeer(receivePresence)
  room.onPeerJoin = whileCurrent(peerJoined)
  room.onPeerLeave = whileCurrent(peerLeft)

  return {room, snapshots, intents, byes, presences}
}

// A tab that finds nobody hosts the room again: with the game as it last saw it, or a new one
// after a reload. Either is provisional, so it gives way to a room that went on elsewhere when
// they meet. Its pending intent goes in, as with a takeover.
const reclaimRoom = <State, Move>(context: Context<State, Move>) => {
  const {rules, lastRoom} = context

  if (context.state || Object.keys(context.room.getPeers()).length > 0) {
    return
  }

  commit(context, withPending(context, lastRoom ? hostAlone(rules, lastRoom, self(context)) : createRoomState(rules, self(context), true)))
}

// Only leave() says goodbye: a page that unloads just drops its links, and the host holds its
// player's place and seat, so a reloaded tab comes back to them. Trystero leaves the room on
// beforeunload, so a page that is still here a takeover pause later was not unloaded: the user
// stayed, or the next page is slow. A page back from the back-forward cache was gone meanwhile.
// Either way it joins again. A hidden page only tells the others: it keeps running, and stays in
// the room as it is.
const receivePageEvent = <State, Move>(context: Context<State, Move>, event: PageEvent) => {
  if (event === 'away' || event === 'back') {
    if (event === 'back' && context.selfAway) {
      context.backAt = Date.now()
    }

    context.selfAway = event === 'away'
    tellPresence(context)
    return
  }

  if (event === 'shown') {
    joinAgain(context)
    return
  }

  clearTimeout(context.revive)

  if (event === 'leaving') {
    context.revive = setTimeout(() => joinAgain(context), context.takeoverDelayMs)
  }
}

export const startSession = <State, Move>(
  options: SessionOptions<State, Move>,
  transport: Transport = trystero
): Session<Move> => {
  const {
    appId,
    code,
    playerId,
    isHost,
    rejoinAsHost,
    provisional = false,
    rules,
    onChange,
    takeoverDelayMs = defaultTakeoverDelayMs,
    awayHoldMs = defaultAwayHoldMs
  } = options
  const context: Context<State, Move> = {
    // Hooked before joining, so its events come ahead of Trystero's own
    stopPageEvents: transport.onPageEvent?.(event => receivePageEvent(context, event)) ?? (() => {}),
    selfId: transport.selfId,
    playerId,
    transport,
    appId,
    code,
    ...connect({transport, appId, code}, () => context),
    rules,
    onChange,
    takeoverDelayMs,
    awayHoldMs,
    state: isHost ? createRoomState(rules, {playerId, peerId: transport.selfId}, provisional) : null,
    players: new Map(),
    departed: [],
    away: new Set(),
    selfAway: false,
    backAt: -Infinity,
    lastRoom: null,
    unreachable: new Set(),
    removals: new Map(),
    holds: new Map(),
    saidBye: new Set(),
    pending: null,
    nextIntentId: 1,
    takeover: undefined,
    rejoin: undefined,
    reclaim: undefined,
    revive: undefined,
    hostLeft: false,
    closed: null
  }

  if (!isHost && rejoinAsHost) {
    scheduleReclaim(context)
  }

  publish(context)

  return {
    send: intent => send(context, intent),
    isSignalingOpen: () => transport.isSignalingOpen?.() ?? true,
    leave: () => {
      if (!context.closed) {
        context.byes.send('').catch(logError)
      }

      return close(context)
    }
  }
}
