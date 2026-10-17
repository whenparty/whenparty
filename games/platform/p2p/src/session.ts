// Connects a game to its room over Trystero. The host runs the rules and broadcasts every new
// room state. Guests send their intents to the host and show what it broadcasts. When the host
// leaves, the next member takes over (see succession.ts). Nothing is stored on a server: the
// signaling server only helps browsers find each other.
import {joinRoom, selfId, type MessageAction} from '@trystero-p2p/ws-relay'
import {decodeIntent, decodeSnapshot, encode} from './protocol.ts'
import {addPeer, applyIntent, createRoomState, removePeer} from './room-state.ts'
import type {GameRules, Intent, NumberedIntent, RoomState} from './room-state.ts'
import {signalingUrlFor} from './signaling-url.ts'
import {acceptsSnapshot, promote, successorOf} from './succession.ts'

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
}

export interface SessionOptions<State, Move> {
  // One per game, so rooms with the same code in different games never meet
  appId: string
  code: string
  isHost: boolean
  rules: GameRules<State, Move>
  onChange: (view: SessionView<State>) => void
  // How long the next member waits before it takes over from a host whose link dropped.
  // A host that comes back within it keeps the room.
  takeoverDelayMs?: number
}

export interface Session<Move> {
  send: (intent: Intent<Move>) => void
  leave: () => Promise<void>
}

// The parts of a Trystero room a session uses
export interface SessionRoom {
  makeAction: (namespace: string) => MessageAction<string>
  onPeerJoin: ((peerId: string) => void) | null
  onPeerLeave: ((peerId: string) => void) | null
  getPeers: () => Record<string, unknown>
  leave: () => Promise<void>
}

// How a session reaches the other peers. Tests pass an in-memory one.
export interface Transport {
  selfId: string
  join: (appId: string, code: string) => SessionRoom
  // Calls back when the page unloads, and returns how to stop
  onUnload?: (callback: () => void) => () => void
}

// Mobile browsers often skip beforeunload (iOS Safari always does), but fire pagehide
const unloadEvents = ['beforeunload', 'pagehide']

// Calls back on every unload event of the page, until the returned function stops it
export const onPageUnload =
  (page: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>) =>
  (callback: () => void): (() => void) => {
    unloadEvents.forEach(event => page.addEventListener(event, callback))
    return () => unloadEvents.forEach(event => page.removeEventListener(event, callback))
  }

const trystero: Transport = {
  selfId,
  join: (appId, code) => joinRoom({appId, relayConfig: {urls: [signalingUrlFor(location.hostname)]}}, code),
  onUnload: onPageUnload(globalThis)
}

const defaultTakeoverDelayMs = 2500

// Everything a session tracks. The functions below change it in place.
interface Context<State, Move> {
  selfId: string
  room: SessionRoom
  rules: GameRules<State, Move>
  snapshots: MessageAction<string>
  intents: MessageAction<string>
  byes: MessageAction<string>
  onChange: (view: SessionView<State>) => void
  takeoverDelayMs: number
  state: RoomState<State> | null
  // Peers whose link dropped and that have not come back
  departed: string[]
  // A host's timers for dropping members whose link dropped (see scheduleRemoval)
  removals: Map<string, ReturnType<typeof setTimeout>>
  // Peers that said goodbye before leaving, so a host drops them at once
  saidBye: Set<string>
  // The last intent this guest sent, until a snapshot shows the host handled it
  pending: NumberedIntent<Move> | null
  nextIntentId: number
  takeover: ReturnType<typeof setTimeout> | undefined
  hostLeft: boolean
}

const logError = (error: unknown) => console.warn('p2p:', error)

const hostOf = <State, Move>(context: Context<State, Move>) => context.state?.members[0] ?? null

const publish = <State, Move>(context: Context<State, Move>) => {
  const host = hostOf(context)

  context.onChange({
    selfId: context.selfId,
    isHost: host === context.selfId,
    room: context.state,
    switchingHost: host !== null && context.departed.includes(host),
    hostLeft: context.hostLeft
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

const dropMember = <State, Move>(context: Context<State, Move>, peerId: string) => {
  clearTimeout(context.removals.get(peerId))
  context.removals.delete(peerId)

  if (context.state && hostOf(context) === context.selfId) {
    commit(context, removePeer(context.rules, context.state, peerId))
  }
}

// A host drops a member whose link dropped only after twice the takeover pause. If that member is
// next in line and takes over meanwhile, its snapshot reaches the others while they still count
// it as next in line. A member that comes back in time keeps its place and seat. A member that
// said goodbye is dropped at once, so a reloaded tab finds its seat free.
const scheduleRemoval = <State, Move>(context: Context<State, Move>, peerId: string) => {
  if (context.saidBye.has(peerId)) {
    dropMember(context, peerId)
    return
  }

  clearTimeout(context.removals.get(peerId))
  context.removals.set(
    peerId,
    setTimeout(() => dropMember(context, peerId), context.takeoverDelayMs * 2)
  )
}

const receiveBye = <State, Move>(context: Context<State, Move>, sender: string) => {
  context.saidBye.add(sender)

  if (context.removals.has(sender)) {
    dropMember(context, sender)
  }
}

const sayBye = <State, Move>(context: Context<State, Move>) => context.byes.send('').catch(logError)

const applySnapshot = <State, Move>(context: Context<State, Move>, snapshot: RoomState<State>, sender: string) => {
  const hostChanged = context.state !== null && hostOf(context) !== sender
  clearTimeout(context.takeover)
  clearRemovals(context)
  context.state = snapshot
  settlePending(context, hostChanged)
  publish(context)
}

const receiveSnapshot = <State, Move>(context: Context<State, Move>, data: unknown, sender: string) => {
  const snapshot = decodeSnapshot(context.rules, data)
  const source = {selfId: context.selfId, departed: context.departed, sender}

  if (snapshot && acceptsSnapshot(context.state, snapshot, source)) {
    applySnapshot(context, snapshot, sender)
  }
}

const receiveIntent = <State, Move>(context: Context<State, Move>, data: unknown, sender: string) => {
  const {state} = context
  const intent = state?.members[0] === context.selfId ? decodeIntent(context.rules, data) : null

  if (state && intent) {
    commit(context, applyIntent(context.rules, state, sender, intent))
  }
}

// The new host starts from the last snapshot: without the old host, with the peers it is
// connected to, and with its own unhandled intent applied. Members it lost meanwhile are dropped
// later, like any member whose link dropped.
const takeOver = <State, Move>(context: Context<State, Move>) => {
  const {state, rules, departed} = context
  const host = hostOf(context)

  if (!state || !host || !departed.includes(host) || successorOf(state, departed) !== context.selfId) {
    return
  }

  let next = promote(rules, state, host, context.selfId)
  next = Object.keys(context.room.getPeers()).reduce((room, peerId) => addPeer(room, peerId), next)
  next = context.pending ? applyIntent(rules, next, context.selfId, context.pending) : next
  context.pending = null
  commit(context, next)
  departed.filter(peerId => next.members.includes(peerId)).forEach(peerId => scheduleRemoval(context, peerId))
}

// When the host is gone, the next member that is still here takes over after a pause. Everyone
// else waits for that member's snapshot.
const scheduleTakeover = <State, Move>(context: Context<State, Move>) => {
  const {state, departed} = context
  const host = hostOf(context)

  if (!state || !host || !departed.includes(host)) {
    return
  }

  const successor = successorOf(state, departed)

  if (successor === null) {
    context.hostLeft = true
    context.room.leave().catch(logError)
  } else if (successor === context.selfId) {
    clearTimeout(context.takeover)
    context.takeover = setTimeout(() => takeOver(context), context.takeoverDelayMs)
  }
}

const peerJoined = <State, Move>(context: Context<State, Move>, peerId: string) => {
  context.departed = context.departed.filter(id => id !== peerId)
  context.saidBye.delete(peerId)
  clearTimeout(context.removals.get(peerId))
  context.removals.delete(peerId)

  if (context.state && hostOf(context) === context.selfId) {
    commit(context, addPeer(context.state, peerId))
  } else {
    publish(context)
  }
}

// Trystero reports a dropped link, which is not always a peer leaving the room
const peerLeft = <State, Move>(context: Context<State, Move>, peerId: string) => {
  context.departed = [...context.departed.filter(id => id !== peerId), peerId]

  if (context.state && hostOf(context) === context.selfId) {
    scheduleRemoval(context, peerId)
    return
  }

  scheduleTakeover(context)
  publish(context)
}

const send = <State, Move>(context: Context<State, Move>, intent: Intent<Move>) => {
  const numbered = {...intent, id: context.nextIntentId++}

  if (context.state && hostOf(context) === context.selfId) {
    commit(context, applyIntent(context.rules, context.state, context.selfId, numbered))
    return
  }

  context.pending = numbered
  sendToHost(context, numbered)
}

const createContext = <State, Move>(options: SessionOptions<State, Move>, transport: Transport): Context<State, Move> => {
  const {appId, code, isHost, rules, onChange, takeoverDelayMs = defaultTakeoverDelayMs} = options
  const room = transport.join(appId, code)

  return {
    selfId: transport.selfId,
    room,
    rules,
    snapshots: room.makeAction('snapshot'),
    intents: room.makeAction('intent'),
    byes: room.makeAction('bye'),
    onChange,
    takeoverDelayMs,
    state: isHost ? createRoomState(rules, transport.selfId) : null,
    departed: [],
    removals: new Map(),
    saidBye: new Set(),
    pending: null,
    nextIntentId: 1,
    takeover: undefined,
    hostLeft: false
  }
}

export const startSession = <State, Move>(
  options: SessionOptions<State, Move>,
  transport: Transport = trystero
): Session<Move> => {
  // Hooked before joining, so the goodbye goes out ahead of Trystero's own leave message. It goes
  // out once, whichever of the unload events and leave() comes first.
  let saidGoodbye = false
  let sayGoodbye = () => {}
  const stopUnload = transport.onUnload?.(() => sayGoodbye())
  const context = createContext(options, transport)
  sayGoodbye = () => {
    if (!saidGoodbye) {
      saidGoodbye = true
      void sayBye(context)
    }
  }

  context.snapshots.onMessage = (data, {peerId}) => receiveSnapshot(context, data, peerId)
  context.intents.onMessage = (data, {peerId}) => receiveIntent(context, data, peerId)
  context.byes.onMessage = (_, {peerId}) => receiveBye(context, peerId)
  context.room.onPeerJoin = peerId => peerJoined(context, peerId)
  context.room.onPeerLeave = peerId => peerLeft(context, peerId)
  publish(context)

  return {
    send: intent => send(context, intent),
    leave: () => {
      stopUnload?.()
      clearTimeout(context.takeover)
      clearRemovals(context)
      sayGoodbye()
      return context.room.leave()
    }
  }
}
