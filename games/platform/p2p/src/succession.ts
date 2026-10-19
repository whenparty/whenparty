// Who hosts a room when its host leaves. Every peer works it out from the same last snapshot,
// so nobody has to vote. Pure functions; session.ts runs them.
import {dropPlayer, hostOf, joinPlayer, memberByPeer, type GameRules, type Member, type RoomState} from './room-state.ts'

// The member that takes over when the host leaves: the first one after it whose connection has
// not dropped as well. Null when nobody is left.
export const successorOf = (room: RoomState<unknown>, departed: readonly string[]): Member | null =>
  room.members.slice(1).find(member => !departed.includes(member.peerId)) ?? null

// The room as its new host (the member on the given connection) starts it: the new host is first,
// and a new term begins. The old host is gone (its seat freed as if it had left), or with
// keepOldHost (it stepped away and may come back) it stays a member with its seat, last in line.
export const promote = <State, Move>(
  rules: GameRules<State, Move>,
  room: RoomState<State>,
  newHostPeerId: string,
  keepOldHost = false
): RoomState<State> => {
  const oldHost = hostOf(room)
  const newHost = memberByPeer(room, newHostPeerId)

  if (!oldHost || !newHost || newHost === oldHost) {
    return room
  }

  if (keepOldHost) {
    const others = room.members.filter(member => member !== newHost && member !== oldHost)
    return {...room, members: [newHost, ...others, oldHost], term: room.term + 1}
  }

  const left = dropPlayer(rules, room, oldHost.playerId)

  return {...left, members: [newHost, ...left.members.filter(member => member !== newHost)], term: room.term + 1}
}

// The room as a member that found itself alone hosts it, with the game as it last saw it: everyone
// else is gone (their seats freed as if they had left). It is provisional, with the same term, so
// if the room went on elsewhere, that one keeps it when they meet.
export const hostAlone = <State, Move>(rules: GameRules<State, Move>, room: RoomState<State>, self: Member): RoomState<State> => {
  const joined = joinPlayer(room, self)
  const alone = joined.members
    .filter(member => member.playerId !== self.playerId)
    .reduce((left, member) => dropPlayer(rules, left, member.playerId), joined)

  return {...alone, members: [self], term: room.term, provisional: true}
}

export interface SnapshotSource {
  selfId: string
  // Peers this peer has lost its link to, and not seen again
  departed: readonly string[]
  sender: string
}

// Whether to take a snapshot as the room's new state. It must come from the connection it names
// as host, or be passed on by this guest's own host as it steps down. A guest takes it from its
// host, or a newer term from the member next in line, even while the host still looks present:
// links drop at different times, and the successor may already have taken over. A guest never
// goes back to an older term. A host takes only a newer term, and steps down. A tab with no room
// yet takes a snapshot from the host it names, or one that names this tab as host: its player's
// old tab hands the room to it.
export const acceptsSnapshot = <State>(
  known: RoomState<State> | null,
  snapshot: RoomState<State>,
  {selfId, departed, sender}: SnapshotSource
): boolean => {
  const host = hostOf(snapshot)?.peerId

  if (!known) {
    return host === sender || host === selfId
  }

  const knownHost = hostOf(known)?.peerId

  // A host that steps down passes the new host's snapshot on to its guests, so they follow too
  if (host !== sender) {
    return sender === knownHost && snapshot.term > known.term
  }

  if (knownHost === selfId) {
    return snapshot.term > known.term
  }

  if (sender === knownHost) {
    return snapshot.term >= known.term
  }

  return snapshot.term > known.term && sender === successorOf(known, departed)?.peerId
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
  if (hostOf(known)?.peerId !== selfId || hostOf(snapshot)?.peerId !== sender || snapshot.term !== known.term) {
    return false
  }

  return known.provisional !== snapshot.provisional ? snapshot.provisional : selfId < sender
}
