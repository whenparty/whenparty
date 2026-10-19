// Connects a game to its room over a Transport (Trystero in the browser, see
// trystero-transport.ts). The host runs the rules and broadcasts every new room state. Guests
// send their intents to the host and show what it broadcasts. When the host leaves, the next
// member takes over (see succession.ts). Nothing is stored on a server: the signaling server only
// helps browsers find each other.
import type {MessageAction} from '@trystero-p2p/ws-relay'
import {decodeIntent, decodeSnapshot, encode} from './protocol.ts'
import {addPeer, applyIntent, createRoomState, removePeer} from './room-state.ts'
import type {GameRules, Intent, NumberedIntent, RoomState} from './room-state.ts'
import {acceptsSnapshot, hostAlone, promote, successorOf, winsTie} from './succession.ts'
import type {PageEvent, SessionRoom, Transport} from './transport.ts'
import {trystero} from './trystero-transport.ts'

const logError = (error: unknown) => console.warn('p2p:', error)

export interface SessionView<State> {
  selfId: string
  // This tab hosts the room right now. That changes when a host leaves.
  isHost: boolean
  // The latest room state, or null until a guest hears from a host
  room: RoomState<State> | null
  // The host is gone and the next member takes over after a pause
  switchingHost: boolean
  // The host is gone and nobody can take over. The session has left the room.
  hostLeft: boolean
  // The signaling server found a peer in this room, but this tab could not connect to it, and has
  // not since. Usually a network that blocks direct connections: there is no TURN server yet.
  unreachable: boolean
}

export interface SessionOptions<State, Move> {
  // One per game, so rooms with the same code in different games never meet
  appId: string
  code: string
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
  transport: Transport
  appId: string
  code: string
  room: SessionRoom
  rules: GameRules<State, Move>
  snapshots: MessageAction<string>
  intents: MessageAction<string>
  byes: MessageAction<string>
  aways: MessageAction<string>
  onChange: (view: SessionView<State>) => void
  takeoverDelayMs: number
  awayHoldMs: number
  state: RoomState<State> | null
  // Peers whose link dropped and that have not come back
  departed: string[]
  // Peers whose page is hidden, as they said last (see receiveAway)
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
  // This tab said goodbye since it last joined, so it does not say it twice
  saidGoodbye: boolean
  hostLeft: boolean
  // Stops listening to the page's lifecycle events
  stopPageEvents: () => void
  // The leave that closed this session for good (see close)
  closed: Promise<void> | null
}

const hostOf = <State, Move>(context: Context<State, Move>) => context.state?.members[0] ?? null

type Hosting<State, Move> = Context<State, Move> & {state: RoomState<State>}

// Whether this tab hosts the room right now
const isHost = <State, Move>(context: Context<State, Move>): context is Hosting<State, Move> =>
  hostOf(context) === context.selfId

const publish = <State, Move>(context: Context<State, Move>) => {
  const host = hostOf(context)

  context.onChange({
    selfId: context.selfId,
    isHost: host === context.selfId,
    room: context.state,
    switchingHost: host !== null && context.departed.includes(host),
    hostLeft: context.hostLeft,
    unreachable: context.unreachable.size > 0
  })
}

// The host broadcasts every new state, even when nothing changed: it puts a guest with a stale view right again
const commit = <State, Move>(context: Context<State, Move>, next: RoomState<State>) => {
  context.state = next
  context.snapshots.send(encode(next)).catch(logError)
  publish(context)
}

const sendToHost = <State, Move>(context: Context<State, Move>, intent: NumberedIntent<Move>) => {
  const host = hostOf(context)

  if (host && host !== context.selfId) {
    context.intents.send(encode(intent), {target: host}).catch(logError)
  }
}

// A guest's last intent may have died with the old host. A new host that has not handled it gets it once more.
const settlePending = <State, Move>(context: Context<State, Move>, hostChanged: boolean) => {
  const {pending, state} = context

  if (!pending || !state) {
    return
  }

  if ((state.handled[context.selfId] ?? 0) >= pending.id) {
    context.pending = null
  } else if (hostChanged) {
    sendToHost(context, pending)
  }
}

const clearRemovals = <State, Move>(context: Context<State, Move>) => {
  context.removals.forEach(timer => clearTimeout(timer))
  context.removals.clear()
}

const clearTimers = <State, Move>(context: Context<State, Move>) => {
  clearTimeout(context.takeover)
  clearTimeout(context.rejoin)
  clearTimeout(context.reclaim)
  clearTimeout(context.revive)
  clearRemovals(context)
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

const dropMember = <State, Move>(context: Context<State, Move>, peerId: string) => {
  cancelRemoval(context, peerId)

  if (isHost(context)) {
    commit(context, removePeer(context.rules, context.state, peerId))
  }
}

// A host drops a member whose link dropped only after twice the takeover pause. If that member is
// next in line and takes over meanwhile, its snapshot reaches the others while they still count
// it as next in line. A member that comes back in time keeps its place and seat. A member that
// stepped away is held for awayHoldMs: a phone freezes a hidden page, its links drop, and it comes
// back when the player returns. A member that said goodbye is dropped at once, so a reloaded tab
// finds its seat free.
const scheduleRemoval = <State, Move>(context: Context<State, Move>, peerId: string) => {
  if (context.saidBye.has(peerId)) {
    dropMember(context, peerId)
    return
  }

  const holdMs = context.away.has(peerId) ? context.awayHoldMs : context.takeoverDelayMs * 2
  cancelRemoval(context, peerId)
  context.removals.set(
    peerId,
    setTimeout(() => dropMember(context, peerId), holdMs)
  )
}

// Every peer keeps track, so a member that takes over later knows who stepped away
const receiveAway = <State, Move>(context: Context<State, Move>, data: unknown, sender: string) => {
  if (data === 'away') {
    context.away.add(sender)
  } else {
    context.away.delete(sender)
  }
}

// Tells the others (or one peer that just joined) whether this tab's page is hidden. Sent while the
// page still runs: once a phone freezes it, nothing goes out.
const tellAway = <State, Move>(context: Context<State, Move>, target?: string) =>
  context.aways.send(context.selfAway ? 'away' : 'back', target ? {target} : undefined).catch(logError)

const receiveBye = <State, Move>(context: Context<State, Move>, sender: string) => {
  context.saidBye.add(sender)

  if (context.removals.has(sender)) {
    dropMember(context, sender)
  }
}

const sayGoodbye = <State, Move>(context: Context<State, Move>) => {
  if (!context.saidGoodbye) {
    context.saidGoodbye = true
    context.byes.send('').catch(logError)
  }
}

const applySnapshot = <State, Move>(context: Context<State, Move>, snapshot: RoomState<State>) => {
  // A host this tab had not followed yet may not have its pending intent: one that took over, one
  // its host passes it on to, or the one it finds after joining again
  const hostChanged = hostOf(context) !== snapshot.members[0]
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
    const newHost = snapshot.members[0] ?? sender

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
const receiveIntent = <State, Move>(context: Context<State, Move>, data: unknown, sender: string) => {
  if (!isHost(context) || !context.state.members.includes(sender)) {
    return
  }

  const {state} = context
  const intent = decodeIntent(context.rules, data)

  if (!intent) {
    return
  }

  const next = applyIntent(context.rules, state, sender, intent)

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

  return pending ? applyIntent(context.rules, room, context.selfId, pending) : room
}

// The new host starts from the last snapshot: without the old host, with the peers it is
// connected to, and with its own unhandled intent applied. An old host that stepped away stays a
// member with its seat, last in line, and is dropped only after awayHoldMs, like any member that
// stepped away. Members it lost meanwhile are dropped later, like any member whose link dropped.
const takeOver = <State, Move>(context: Context<State, Move>) => {
  const {state, rules, departed} = context
  const host = hostOf(context)

  if (!state || !host || !departed.includes(host) || successorOf(state, departed) !== context.selfId) {
    return
  }

  const promoted = promote(rules, state, host, context.selfId, context.away.has(host))
  const next = withPending(context, Object.keys(context.room.getPeers()).reduce(addPeer, promoted))
  commit(context, next)
  departed.filter(peerId => next.members.includes(peerId)).forEach(peerId => scheduleRemoval(context, peerId))
}

const scheduleReclaim = <State, Move>(context: Context<State, Move>) => {
  clearTimeout(context.reclaim)
  context.reclaim = setTimeout(() => reclaimRoom(context), context.takeoverDelayMs * 2)
}

// Leaves the room and joins it again as a newcomer, with new links. With the same peer ID, it
// keeps its place and seat if the host still has them, and it sends its pending intent again to the
// host it finds. With hostIfAlone (by default for a host), it hosts the room again with the game as
// it last saw it if nobody else is there (see reclaimRoom).
const joinAgain = <State, Move>(context: Context<State, Move>, hostIfAlone = isHost(context)) => {
  context.lastRoom = context.state
  context.room.leave().catch(logError)
  clearTimers(context)
  context.state = null
  context.departed = []
  context.away.clear()
  context.unreachable.clear()
  context.saidBye.clear()
  context.saidGoodbye = false
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

  if (host && host !== context.selfId && context.departed.includes(host)) {
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

  if (!state || !host || !departed.includes(host)) {
    return
  }

  const successor = successorOf(state, departed)

  if (successor === null) {
    context.hostLeft = true
    close(context).catch(logError)
  } else if (successor !== context.selfId) {
    scheduleRejoin(context)
  } else if (wasJustAway(context)) {
    // Taking over from an old snapshot would undo what the host did meanwhile. Joining again
    // finds the host if it is still there, and hosts the game as it was if nobody is.
    joinAgain(context, true)
  } else if (context.saidBye.has(host)) {
    takeOver(context)
  } else {
    clearTimeout(context.takeover)
    context.takeover = setTimeout(() => takeOver(context), context.takeoverDelayMs)
  }
}

const peerJoined = <State, Move>(context: Context<State, Move>, peerId: string) => {
  context.departed = context.departed.filter(id => id !== peerId)
  context.unreachable.delete(peerId)
  context.saidBye.delete(peerId)
  cancelRemoval(context, peerId)
  // A page that came back may have said so while its links were down
  tellAway(context, peerId)

  if (isHost(context)) {
    commit(context, addPeer(context.state, peerId))
  } else {
    publish(context)
  }
}

// Trystero reports a dropped link, which is not always a peer leaving the room
const peerLeft = <State, Move>(context: Context<State, Move>, peerId: string) => {
  context.departed = [...context.departed.filter(id => id !== peerId), peerId]

  if (isHost(context)) {
    scheduleRemoval(context, peerId)
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
    commit(context, applyIntent(context.rules, context.state, context.selfId, numbered))
    return
  }

  context.pending = numbered
  sendToHost(context, numbered)
}

type Connection<State, Move> = Pick<Context<State, Move>, 'room' | 'snapshots' | 'intents' | 'byes' | 'aways'>

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
  const aways = room.makeAction('away')
  snapshots.onMessage = fromPeer(receiveSnapshot)
  intents.onMessage = fromPeer(receiveIntent)
  byes.onMessage = fromPeer((context, _, sender) => receiveBye(context, sender))
  aways.onMessage = fromPeer(receiveAway)
  room.onPeerJoin = whileCurrent(peerJoined)
  room.onPeerLeave = whileCurrent(peerLeft)

  return {room, snapshots, intents, byes, aways}
}

// A tab that finds nobody hosts the room again: with the game as it last saw it, or a new one
// after a reload. Either is provisional, so it gives way to a room that went on
// elsewhere when they meet. Its pending intent goes in, as with a takeover.
const reclaimRoom = <State, Move>(context: Context<State, Move>) => {
  const {rules, selfId, lastRoom} = context

  if (context.state || Object.keys(context.room.getPeers()).length > 0) {
    return
  }

  commit(context, withPending(context, lastRoom ? hostAlone(rules, lastRoom, selfId) : createRoomState(rules, selfId, true)))
}

// The goodbye goes out once, whichever of beforeunload, pagehide and leave() comes first.
// Trystero leaves the room on beforeunload too, and the others hand the room over at once. A page
// that is still here a takeover pause later was not unloaded: the user stayed, or the next page is
// slow. A page back from the back-forward cache was gone meanwhile. Either way it joins again.
// A hidden page only tells the others: it keeps running, and stays in the room as it is.
const receivePageEvent = <State, Move>(context: Context<State, Move>, event: PageEvent) => {
  if (event === 'away' || event === 'back') {
    if (event === 'back' && context.selfAway) {
      context.backAt = Date.now()
    }

    context.selfAway = event === 'away'
    tellAway(context)
    return
  }

  if (event === 'shown') {
    joinAgain(context)
    return
  }

  sayGoodbye(context)
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
    isHost,
    rejoinAsHost,
    provisional = false,
    rules,
    onChange,
    takeoverDelayMs = defaultTakeoverDelayMs,
    awayHoldMs = defaultAwayHoldMs
  } = options
  const context: Context<State, Move> = {
    // Hooked before joining, so the goodbye goes out ahead of Trystero's own leave message
    stopPageEvents: transport.onPageEvent?.(event => receivePageEvent(context, event)) ?? (() => {}),
    selfId: transport.selfId,
    transport,
    appId,
    code,
    ...connect({transport, appId, code}, () => context),
    rules,
    onChange,
    takeoverDelayMs,
    awayHoldMs,
    state: isHost ? createRoomState(rules, transport.selfId, provisional) : null,
    departed: [],
    away: new Set(),
    selfAway: false,
    backAt: -Infinity,
    lastRoom: null,
    unreachable: new Set(),
    removals: new Map(),
    saidBye: new Set(),
    pending: null,
    nextIntentId: 1,
    takeover: undefined,
    rejoin: undefined,
    reclaim: undefined,
    revive: undefined,
    saidGoodbye: false,
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
      sayGoodbye(context)
      return close(context)
    }
  }
}
