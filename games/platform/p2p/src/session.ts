import type {MessageAction} from '@trystero-p2p/ws-relay'
import type {GameRules, Intent} from './room-state.ts'
import {initialModel, invariantViolations, step, timersOf, viewOf} from './session-machine.ts'
import type {Action, Effect, Event, Model, SessionView} from './session-machine.ts'
import type {SessionRoom, Transport} from './transport.ts'
import {trystero} from './trystero-transport.ts'

export type {SessionView} from './session-machine.ts'

const logError = (error: unknown) => console.warn('p2p:', error)

export interface SessionOptions<State, Move> {
  appId: string
  code: string
  playerId: string
  isHost: boolean
  rejoinAsHost?: boolean
  rules: GameRules<State, Move>
  onChange: (view: SessionView<State>) => void
  seatHoldMs?: number
  restoreGraceMs?: number
}

export interface Session<Move> {
  send: (intent: Intent<Move>) => void
  isSignalingOpen: () => boolean
  leave: () => Promise<void>
}

const defaultSeatHoldMs = 120_000
const defaultRestoreGraceMs = 3_000
// Monotonic, in whole milliseconds: room time crosses the wire as a safe integer
const now = () => Math.floor(performance.now())

interface Connection {
  room: SessionRoom
  actions: Record<Action, MessageAction<string>>
}

const sameView = <State>(a: SessionView<State>, b: SessionView<State>) =>
  (Object.keys(a) as (keyof SessionView<State>)[]).every(key => a[key] === b[key])

export const startSession = <State, Move>(
  options: SessionOptions<State, Move>,
  transport: Transport = trystero,
  observe?: (model: Model<State, Move>, event: Event<Move>) => void
): Session<Move> => {
  const {appId, code, playerId, rules, onChange} = options
  const config = {
    self: {playerId, peerId: transport.selfId},
    rules,
    seatHoldMs: options.seatHoldMs ?? defaultSeatHoldMs,
    restoreGraceMs: options.restoreGraceMs ?? defaultRestoreGraceMs
  }
  const start = {isHost: options.isHost, rejoinAsHost: options.rejoinAsHost ?? false}
  let model = initialModel<State, Move>(config, start, now())
  let connection: Connection | null = null
  let closed: Promise<void> | null = null
  let view: SessionView<State> | null = null
  const timers = new Map<string, {at: number; handle: ReturnType<typeof setTimeout>}>()
  const queue: Event<Move>[] = []
  let running = false

  const dispatch = (event: Event<Move>) => {
    queue.push(event)

    if (running) {
      return
    }

    running = true

    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        const peers = new Set(Object.keys(connection?.room.getPeers() ?? {}))
        const result = step(model, next, {now: now(), peers})
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
          Math.max(0, at - now())
        )
        timers.set(key, {at, handle})
      }
    })
  }

  const publish = () => {
    if ((model.page.gone && model.phase.name !== 'closed') || (model.phase.name === 'closed' && !model.phase.hostLeft)) {
      return
    }

    const next = viewOf(model)

    if (!view || !sameView(view, next)) {
      view = next
      onChange(next)
    }
  }

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
        connection?.actions[effect.action].send(effect.data, effect.target ? {target: effect.target} : undefined).catch(logError)
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

  const stopPageEvents = transport.onPageEvent?.(event => dispatch({type: 'page', event})) ?? (() => {})
  connection = connect()
  syncTimers()
  publish()

  return {
    send: intent => dispatch({type: 'send', intent}),
    isSignalingOpen: () => transport.isSignalingOpen?.() ?? true,
    leave: () => {
      dispatch({type: 'leave'})
      return closed ?? Promise.resolve()
    }
  }
}
