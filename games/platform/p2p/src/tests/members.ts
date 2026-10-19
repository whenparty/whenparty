import type {Member} from '../room-state.ts'

// A member whose connection is named after its player, unless the test says otherwise
export const tab = (peerId: string, playerId = peerId): Member => ({playerId, peerId})

export const playersOf = (members: Member[]): string[] => members.map(member => member.playerId)
