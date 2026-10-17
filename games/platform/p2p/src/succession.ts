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

// A snapshot a guest could not take yet, with who sent it
export interface EarlySnapshot<State> {
  snapshot: RoomState<State>
  sender: string
}

// Links drop at different times, so a guest can hear from the new host before it notices that the
// old one is gone: a newer term from the member next in line, while the host still looks present.
// The new host sends nothing more until something happens, so the guest keeps the newest such
// snapshot and takes it once it notices the host leave. Returns what to keep.
export const keepEarly = <State>(
  kept: EarlySnapshot<State> | null,
  known: RoomState<State> | null,
  snapshot: RoomState<State>,
  {selfId, departed, sender}: SnapshotSource
): EarlySnapshot<State> | null => {
  const host = known?.members[0]

  if (!known || !host || host === selfId || departed.includes(host)) {
    return kept
  }

  const isEarly = snapshot.members[0] === sender && snapshot.term > known.term && sender === successorOf(known, departed)

  if (!isEarly || (kept && kept.snapshot.term >= snapshot.term)) {
    return kept
  }

  return {snapshot, sender}
}

// The old host is back, so the room did not move on after all
export const earlyAfterJoin = <State>(
  kept: EarlySnapshot<State> | null,
  known: RoomState<State> | null,
  peerId: string
): EarlySnapshot<State> | null => (kept && known?.members[0] === peerId ? null : kept)
