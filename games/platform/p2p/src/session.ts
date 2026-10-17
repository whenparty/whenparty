// Connects a game to its room over Trystero. The host runs the rules and broadcasts every
// new room state. Guests send their intents to the host and show what it broadcasts.
// Nothing is stored on a server: the signaling server only helps browsers find each other.
import {joinRoom, selfId, type Room} from '@trystero-p2p/ws-relay'
import {decodeIntent, decodeSnapshot, encode} from './protocol.ts'
import {signalingUrlFor} from './signaling-url.ts'
import {addPeer, applyIntent, createRoomState, removePeer} from './room-state.ts'
import type {GameRules, Intent, RoomState} from './room-state.ts'

export interface SessionView<State> {
  selfId: string
  isHost: boolean
  // The latest room state, or null until a guest hears from the host
  room: RoomState<State> | null
  // The host is gone, and with it the game. The session has left the room.
  hostLeft: boolean
}

export interface SessionOptions<State, Move> {
  // One per game, so rooms with the same code in different games never meet
  appId: string
  code: string
  isHost: boolean
  rules: GameRules<State, Move>
  onChange: (view: SessionView<State>) => void
}

export interface Session<Move> {
  send: (intent: Intent<Move>) => void
  leave: () => Promise<void>
}

type Update<State> = (patch: Partial<SessionView<State>>) => void
type Send<Move> = (intent: Intent<Move>) => void

const logError = (error: unknown) => console.warn('p2p:', error)

const runHost = <State, Move>(room: Room, rules: GameRules<State, Move>, update: Update<State>): Send<Move> => {
  const snapshots = room.makeAction<string>('snapshot')
  let state = createRoomState(rules, selfId)

  // Broadcast even when nothing changed: it puts a guest with a stale view right again
  const commit = (next: RoomState<State>) => {
    state = next
    snapshots.send(encode(state)).catch(logError)
    update({room: state})
  }

  room.makeAction<string>('intent', {
    onMessage: (data, {peerId}) => {
      const intent = decodeIntent(rules, data)

      if (intent) {
        commit(applyIntent(rules, state, peerId, intent))
      }
    }
  })
  room.onPeerJoin = peerId => commit(addPeer(state, peerId))
  room.onPeerLeave = peerId => commit(removePeer(state, peerId))
  update({room: state})

  return intent => commit(applyIntent(rules, state, selfId, intent))
}

const runGuest = <State, Move>(room: Room, rules: GameRules<State, Move>, update: Update<State>): Send<Move> => {
  const intents = room.makeAction<string>('intent')
  // The first peer that sends a valid snapshot is the host. Only the host sends them.
  let hostId: string | null = null

  room.makeAction<string>('snapshot', {
    onMessage: (data, {peerId}) => {
      const snapshot = hostId === null || peerId === hostId ? decodeSnapshot(rules, data) : null

      if (snapshot) {
        hostId = peerId
        update({room: snapshot})
      }
    }
  })
  room.onPeerLeave = peerId => {
    if (peerId === hostId) {
      update({hostLeft: true})
      room.leave().catch(logError)
    }
  }

  return intent => {
    if (hostId) {
      intents.send(encode(intent), {target: hostId}).catch(logError)
    }
  }
}

export const startSession = <State, Move>(options: SessionOptions<State, Move>): Session<Move> => {
  const {appId, code, isHost, rules, onChange} = options
  const room = joinRoom({appId, relayConfig: {urls: [signalingUrlFor(location.hostname)]}}, code)
  let view: SessionView<State> = {selfId, isHost, room: null, hostLeft: false}

  const update: Update<State> = patch => {
    view = {...view, ...patch}
    onChange(view)
  }

  const send = isHost ? runHost(room, rules, update) : runGuest(room, rules, update)

  return {send, leave: () => room.leave()}
}
