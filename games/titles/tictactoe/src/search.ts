// What the page tells a guest that has not found its room yet, and when it offers to start the
// room. Pure, so it can be tested without a page.
import type {SessionView} from '@whenparty/p2p'

// looking: not long enough to tell yet. unreachable: the room is there, but this network can't
// connect to it. offline: no signaling server. nobody: nobody hosts the code.
export type Search = 'looking' | 'unreachable' | 'offline' | 'nobody'

export interface SearchState {
  view: SessionView<unknown> | null
  // The hint time has passed since the tab last had no room
  hostIsLate: boolean
  signalingOpen: boolean
}

export const searchOf = ({view, hostIsLate, signalingOpen}: SearchState): Search => {
  if (view?.unreachable) {
    return 'unreachable'
  }

  if (!hostIsLate) {
    return 'looking'
  }

  return signalingOpen ? 'nobody' : 'offline'
}

export const lostRoom = (previous: SessionView<unknown> | null, next: SessionView<unknown>): boolean =>
  Boolean(previous?.room) && !next.room
