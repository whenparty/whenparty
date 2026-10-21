// Connects a game to its room over a Transport (Trystero in the browser, see
// trystero-transport.ts). The host runs the rules and broadcasts every new room state. Guests
// send their intents to the host and show what it broadcasts. When the host leaves, the next
// member takes over (see succession.ts). Nothing is stored on a server: the signaling server only
// helps browsers find each other.
//
// What a session does is decided in session-machine.ts, one event at a time. This file runs it:
// it feeds it the room's and the page's events, sends what it says to send, joins and leaves the
// room, keeps a real timer for each deadline the model waits for, and tells the page.
import type {MessageAction} from '@trystero-p2p/ws-relay'
import type {GameRules, Intent} from './room-state.ts'
import {initialModel, invariantViolations, step, timersOf, viewOf} from './session-machine.ts'
import type {Action, Effect, Event, Model, SessionView} from './session-machine.ts'
import type {SessionRoom, Transport} from './transport.ts'
import {trystero} from './trystero-transport.ts'

export type {SessionView} from './session-machine.ts'

const logError = (error: unknown) => console.warn('p2p:', error)

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
  // yet. Its room is fresh, and gives way to that room when they meet (see winsTie).
  provisional?: boolean
  rules: GameRules<State, Move>
  onChange: (view: SessionView<State>) => void
  // How long the next member waits before it takes over from a host whose link dropped.
  // A host that comes back within it keeps the room.
  takeoverDelayMs?: number
  // How long the room holds the place and seat of a member whose link dropped: it reloaded, its
  // network changed, a phone froze its hidden page. Default 1 minute. The game hears of it
  // (rules.onPresence) and decides whether the match waits.
  seatHoldMs?: number
}

export interface Session<Move> {
  send: (intent: Intent<Move>) => void
  // Whether this tab is connected to the signaling server right now. Without it, a guest can't
  // find its room.
  isSignalingOpen: () => boolean
  leave: () => Promise<void>
}

const defaultTakeoverDelayMs = 2500
const defaultSeatHoldMs = 60_000

interface Connection {
  room: SessionRoom
  actions: Record<Action, MessageAction<string>>
}

const sameView = <State>(a: SessionView<State>, b: SessionView<State>) =>
  (Object.keys(a) as (keyof SessionView<State>)[]).every(key => a[key] === b[key])

// observe sees the model after every event, for tests
export const startSession = <State, Move>(
  options: SessionOptions<State, Move>,
  transport: Transport = trystero,
  observe?: (model: Model<State, Move>, event: Event<Move>) => void
): Session<Move> => {
  const {appId, code, playerId, rules, onChange} = options
  const config = {
    self: {playerId, peerId: transport.selfId},
    rules,
    takeoverDelayMs: options.takeoverDelayMs ?? defaultTakeoverDelayMs,
    seatHoldMs: options.seatHoldMs ?? defaultSeatHoldMs
  }
  const start = {isHost: options.isHost, rejoinAsHost: options.rejoinAsHost ?? false, provisional: options.provisional ?? false}
  let model = initialModel<State, Move>(config, start, Date.now())
  // The room this session listens to. Null once it left it, until it joins again.
  let connection: Connection | null = null
  let closed: Promise<void> | null = null
  let view: SessionView<State> | null = null
  const timers = new Map<string, {at: number; handle: ReturnType<typeof setTimeout>}>()
  const queue: Event<Move>[] = []
  let running = false

  // Events are handled one at a time, in order, even when handling one causes another
  const dispatch = (event: Event<Move>) => {
    queue.push(event)

    if (running) {
      return
    }

    running = true

    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        const peers = new Set(Object.keys(connection?.room.getPeers() ?? {}))
        const signalingOpen = transport.isSignalingOpen?.() ?? true
        const result = step(model, next, {now: Date.now(), peers, signalingOpen})
        model = result.model
        result.effects.forEach(run)
        invariantViolations(model).forEach(problem => console.warn('p2p: broken invariant:', problem))
        observe?.(model, next)
      } catch (error) {
        logError(error)
      }
    }

    running = false
    syncTimers()
    publish()
  }

  // A real timer for each deadline the model waits for, and none for one it no longer does
  const syncTimers = () => {
    const wanted = timersOf(model)

    timers.forEach((timer, key) => {
      if (wanted.get(key) !== timer.at) {
        clearTimeout(timer.handle)
        timers.delete(key)
      }
    })

    wanted.forEach((at, key) => {
      if (!timers.has(key)) {
        const handle = setTimeout(
          () => {
            timers.delete(key)
            dispatch({type: 'deadline', key})
          },
          Math.max(0, at - Date.now())
        )
        timers.set(key, {at, handle})
      }
    })
  }

  // Tells the page when what it shows changed. A session that left on purpose says nothing more,
  // and neither does a page that went: it shows what it showed when it went, until it is back.
  const publish = () => {
    if (model.phase.name === 'detached' || (model.phase.name === 'closed' && !model.phase.hostLeft)) {
      return
    }

    const next = viewOf(model)

    if (!view || !sameView(view, next)) {
      view = next
      onChange(next)
    }
  }

  // Joins the room and listens to it. Its events reach the model only while it is the session's room.
  const connect = (): Connection => {
    const fromHere = (event: Event<Move>) => {
      if (connection === joined) {
        dispatch(event)
      }
    }
    const room = transport.join(appId, code, peerId => fromHere({type: 'unreachable', peerId}))
    const actions: Record<Action, MessageAction<string>> = {
      snapshot: room.makeAction('snapshot'),
      intent: room.makeAction('intent'),
      presence: room.makeAction('presence'),
      bye: room.makeAction('bye')
    }
    const joined: Connection = {room, actions}

    actions.snapshot.onMessage = (data, {peerId}) => fromHere({type: 'snapshot', data, sender: peerId})
    actions.intent.onMessage = (data, {peerId}) => fromHere({type: 'intent', data, sender: peerId})
    actions.presence.onMessage = (data, {peerId}) => fromHere({type: 'presence', data, sender: peerId})
    actions.bye.onMessage = (_, {peerId}) => fromHere({type: 'bye', sender: peerId})
    room.onPeerJoin = peerId => fromHere({type: 'peerJoined', peerId})
    room.onPeerLeave = peerId => fromHere({type: 'peerLeft', peerId})

    return joined
  }

  const leaveRoom = () => {
    const left = connection?.room.leave() ?? Promise.resolve()
    connection = null
    return left
  }

  const run = (effect: Effect) => {
    switch (effect.type) {
      case 'send':
        connection?.actions[effect.action]
          .send(effect.data, effect.target ? {target: effect.target} : undefined)
          .catch(logError)
        return
      case 'rejoin':
        leaveRoom().catch(logError)
        connection = connect()
        return
      case 'detach':
        leaveRoom().catch(logError)
        return
      case 'close':
        stopPageEvents()
        closed = leaveRoom()
        return
    }
  }

  // Hooked before joining, so its events come ahead of Trystero's own
  const stopPageEvents = transport.onPageEvent?.(event => dispatch({type: 'page', event})) ?? (() => {})
  connection = connect()
  syncTimers()
  publish()

  return {
    send: intent => dispatch({type: 'send', intent}),
    isSignalingOpen: () => transport.isSignalingOpen?.() ?? true,
    // Leaving again gives the same promise
    leave: () => {
      dispatch({type: 'leave'})
      return closed ?? Promise.resolve()
    }
  }
}
