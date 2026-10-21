// Which snapshots a tab takes as the room's state. One decision for every phase, so that the rules
// about the creator's connections live in one place. STATES.md lists them; handover.test.ts checks each.
import {hostOf, type Member, type RoomState} from './room-state.ts'

export interface SnapshotSource {
  self: Member
  standing: 'waiting' | 'following' | 'hosting'
  // Waiting as the creator after a reload
  restoring: boolean
  hidden: boolean
  known: RoomState<unknown> | null
  sender: string
}

export type SnapshotDecision =
  | 'ignore'
  // Take the room over as its creator, on this connection
  | 'restore'
  // The retained room already gave up on its creator
  | 'expired'
  // Host the room this snapshot names this connection for
  | 'host'
  // A rival tab of the creator hosts the same term: start a newer one
  | 'outrank'
  | 'follow'

export const decideSnapshot = (
  snapshot: RoomState<unknown>,
  {self, standing, restoring, hidden, known, sender}: SnapshotSource
): SnapshotDecision => {
  const host = hostOf(snapshot)

  if (!host || (known && (snapshot.hostId !== known.hostId || snapshot.term < known.term))) {
    return 'ignore'
  }

  const toMe = host.peerId === self.peerId

  if (standing === 'waiting' && snapshot.hostId === self.playerId) {
    const fromMember = snapshot.members.some(member => member.peerId === sender)

    if ((!fromMember && !toMe) || (hidden && !restoring && !toMe)) {
      return 'ignore'
    }

    const until = snapshot.reservations[snapshot.hostId]
    return until !== undefined && until <= snapshot.clock ? 'expired' : 'restore'
  }

  const fromHost = sender === host.peerId
  const handedOver = known !== null && sender === hostOf(known)?.peerId && snapshot.term > known.term
  const newerToMe = known !== null && toMe && snapshot.term > known.term

  if (!fromHost && !handedOver && !newerToMe) {
    return 'ignore'
  }

  if (known && snapshot.term === known.term && host.peerId !== hostOf(known)?.peerId) {
    // Two tabs of the creator host the same term: the lower connection ID keeps the room
    if (standing !== 'hosting' || !fromHost) {
      return 'ignore'
    }

    if (sender > self.peerId) {
      return 'outrank'
    }
  }

  return toMe ? 'host' : 'follow'
}
