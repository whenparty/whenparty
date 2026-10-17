// Who hosts a room when its host leaves. Every peer works it out from the same last snapshot,
// so nobody has to vote. Pure functions; session.ts runs them.
import {removePeer, type GameRules, type RoomState} from './room-state.ts'

// The member that takes over when the host leaves: the first one after it whose link has not
// dropped as well. Null when nobody is left.
export const successorOf = (room: RoomState<unknown>, departed: readonly string[]): string | null =>
  room.members.slice(1).find(peerId => !departed.includes(peerId)) ?? null

// The room as its new host starts it: the old host is gone (its seat freed as if it had left),
// the new host is first, and a new term begins
export const promote = <State, Move>(
  rules: GameRules<State, Move>,
  room: RoomState<State>,
  oldHostId: string,
  newHostId: string
): RoomState<State> => {
  if (newHostId === oldHostId || !room.members.includes(newHostId)) {
    return room
  }

  const left = removePeer(rules, room, oldHostId)

  return {...left, members: [newHostId, ...left.members.filter(id => id !== newHostId)], term: room.term + 1}
}

export interface SnapshotSource {
  selfId: string
  // Peers this peer has lost its link to, and not seen again
  departed: readonly string[]
  sender: string
}

// Whether to take a snapshot as the room's new state. It must come from the peer it names as
// host. A guest takes it from its host, or from the successor once the host is gone, and never
// from an older term. A host takes it only from a newer term, and steps down.
export const acceptsSnapshot = <State>(
  known: RoomState<State> | null,
  snapshot: RoomState<State>,
  {selfId, departed, sender}: SnapshotSource
): boolean => {
  if (snapshot.members[0] !== sender) {
    return false
  }

  if (!known) {
    return true
  }

  const host = known.members[0] ?? null

  if (host === selfId) {
    return snapshot.term > known.term
  }

  if (snapshot.term < known.term) {
    return false
  }

  const successor = host !== null && departed.includes(host) ? successorOf(known, departed) : null

  return sender === host || sender === successor
}
