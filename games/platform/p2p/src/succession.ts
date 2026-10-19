// Who hosts a room when its host leaves. Every peer works it out from the same last snapshot,
// so nobody has to vote. Pure functions; session.ts runs them.
import {removePeer, type GameRules, type RoomState} from './room-state.ts'

// The member that takes over when the host leaves: the first one after it whose link has not
// dropped as well. Null when nobody is left.
export const successorOf = (room: RoomState<unknown>, departed: readonly string[]): string | null =>
  room.members.slice(1).find(peerId => !departed.includes(peerId)) ?? null

// The room as its new host starts it: the new host is first, and a new term begins. The old host
// is gone (its seat freed as if it had left), or with keepOldHost (it stepped away and may come
// back) it stays a member with its seat, last in line.
export const promote = <State, Move>(
  rules: GameRules<State, Move>,
  room: RoomState<State>,
  oldHostId: string,
  newHostId: string,
  keepOldHost = false
): RoomState<State> => {
  if (newHostId === oldHostId || !room.members.includes(newHostId)) {
    return room
  }

  if (keepOldHost) {
    const others = room.members.filter(id => id !== newHostId && id !== oldHostId)
    return {...room, members: [newHostId, ...others, oldHostId], term: room.term + 1}
  }

  const left = removePeer(rules, room, oldHostId)

  return {...left, members: [newHostId, ...left.members.filter(id => id !== newHostId)], term: room.term + 1}
}

// The room as a member that found itself alone hosts it, with the game as it last saw it: everyone
// else is gone (their seats freed as if they had left). It is provisional, with the same term, so
// if the room went on elsewhere, that one keeps it when they meet.
export const hostAlone = <State, Move>(rules: GameRules<State, Move>, room: RoomState<State>, selfId: string): RoomState<State> => {
  const alone = room.members.filter(id => id !== selfId).reduce((left, peerId) => removePeer(rules, left, peerId), room)

  return {...alone, members: [selfId], provisional: true}
}

export interface SnapshotSource {
  selfId: string
  // Peers this peer has lost its link to, and not seen again
  departed: readonly string[]
  sender: string
}

// Whether to take a snapshot as the room's new state. It must come from the peer it names as
// host, or be passed on by this guest's own host as it steps down. A guest takes it from its host,
// or a newer term from the member next in line, even while the host still looks present: links
// drop at different times, and the successor may already have taken over. A guest never goes back
// to an older term. A host takes only a newer term, and steps down.
export const acceptsSnapshot = <State>(
  known: RoomState<State> | null,
  snapshot: RoomState<State>,
  {selfId, departed, sender}: SnapshotSource
): boolean => {
  if (!known) {
    return snapshot.members[0] === sender
  }

  // A host that steps down passes the new host's snapshot on to its guests, so they follow too
  if (snapshot.members[0] !== sender) {
    return sender === known.members[0] && snapshot.term > known.term
  }

  if (known.members[0] === selfId) {
    return snapshot.term > known.term
  }

  if (sender === known.members[0]) {
    return snapshot.term >= known.term
  }

  return snapshot.term > known.term && sender === successorOf(known, departed)
}

// Whether this host keeps the room against another host of the same term. That happens when a
// player starts a room under a code whose room it could not reach yet, when a member alone hosts
// the room again, or when links drop in different ways and two members take over at once. A
// provisional room gives way, so a room just started never replaces the game it stands in for.
// Between two rooms that are both provisional or both not (two halves of one room), the lower peer
// ID keeps it. Both hosts read these from values that don't change, so exactly one of them wins.
// Member counts would not do: each host reads its own as it is now, and the other's as it was
// sent. Nor would the rooms' creation times: a device whose clock runs behind would make a room
// just started the older one. The winner starts a newer term, and the other host steps down when
// that reaches it.
export const winsTie = <State>(known: RoomState<State>, snapshot: RoomState<State>, {selfId, sender}: SnapshotSource) => {
  if (known.members[0] !== selfId || snapshot.members[0] !== sender || snapshot.term !== known.term) {
    return false
  }

  return known.provisional !== snapshot.provisional ? snapshot.provisional : selfId < sender
}
