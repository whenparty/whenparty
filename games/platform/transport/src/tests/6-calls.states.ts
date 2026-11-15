type State = 'none' | 'live'

type Event =
  | 'a call with the identifier arrives, and its remaining time is not a whole number of milliseconds from 1 to 15,000'
  | 'a call with the identifier arrives, and its description is over 16,384 bytes'
  | 'a call with the identifier arrives for a peer ID that no open signaling connection has, that is the caller own, or whose list lacks the caller'
  | 'a call with the identifier arrives while the callee is the callee of 12 live records, or of 2 with this caller, or the caller is the caller of 64'
  | 'a call with the identifier arrives, and no other reason of 6-1 applies to it'
  | 'a signal within the limits of 6-5 arrives from one of the two pages'
  | 'a signal beyond the limits of 6-5 arrives from one of the two pages'
  | 'a signal or closing message with the identifier arrives from another page'
  | 'a closing message arrives from one of the two pages'
  | 'the deadline of the record passes'
  | 'the signaling connection of one of the two pages closes'

type Effect =
  | 'the caller gets failed, and the callee is told nothing'
  | 'the caller gets no peer, and the callee is told nothing'
  | 'the caller gets busy, and the callee is told nothing'
  | 'the callee gets the call with the caller description at once'
  | 'the other page gets it, in the order it arrived'
  | 'the server drops it, and both pages get failed'
  | 'the server drops it'
  | 'the other page gets peer offline'
  | 'nothing'

type Outcome = { readonly state: State; readonly effect: Effect }

type Cell = { readonly ids: readonly string[]; readonly outcome: Outcome } | { readonly impossible: string }

const takenIdentifier: Cell = {
  ids: ['6-1'],
  outcome: { state: 'live', effect: 'the caller gets failed, and the callee is told nothing' }
}
const dropped: Cell = { ids: ['6-3'], outcome: { state: 'none', effect: 'the server drops it' } }

export const table: { readonly [S in State]: { readonly [E in Event]: Cell } } = {
  none: {
    'a call with the identifier arrives, and its remaining time is not a whole number of milliseconds from 1 to 15,000': {
      ids: ['6-1'],
      outcome: { state: 'none', effect: 'the caller gets failed, and the callee is told nothing' }
    },
    'a call with the identifier arrives, and its description is over 16,384 bytes': {
      ids: ['6-1'],
      outcome: { state: 'none', effect: 'the caller gets failed, and the callee is told nothing' }
    },
    'a call with the identifier arrives for a peer ID that no open signaling connection has, that is the caller own, or whose list lacks the caller':
      { ids: ['6-1'], outcome: { state: 'none', effect: 'the caller gets no peer, and the callee is told nothing' } },
    'a call with the identifier arrives while the callee is the callee of 12 live records, or of 2 with this caller, or the caller is the caller of 64':
      { ids: ['6-1'], outcome: { state: 'none', effect: 'the caller gets busy, and the callee is told nothing' } },
    'a call with the identifier arrives, and no other reason of 6-1 applies to it': {
      ids: ['6-1', '6-2'],
      outcome: { state: 'live', effect: 'the callee gets the call with the caller description at once' }
    },
    'a signal within the limits of 6-5 arrives from one of the two pages': dropped,
    'a signal beyond the limits of 6-5 arrives from one of the two pages': dropped,
    'a signal or closing message with the identifier arrives from another page': dropped,
    'a closing message arrives from one of the two pages': dropped,
    'the deadline of the record passes': { impossible: 'only a live record has a deadline (6-2)' },
    'the signaling connection of one of the two pages closes': {
      ids: ['6-6'],
      outcome: { state: 'none', effect: 'nothing' }
    }
  },
  live: {
    'a call with the identifier arrives, and its remaining time is not a whole number of milliseconds from 1 to 15,000':
      takenIdentifier,
    'a call with the identifier arrives, and its description is over 16,384 bytes': takenIdentifier,
    'a call with the identifier arrives for a peer ID that no open signaling connection has, that is the caller own, or whose list lacks the caller':
      takenIdentifier,
    'a call with the identifier arrives while the callee is the callee of 12 live records, or of 2 with this caller, or the caller is the caller of 64':
      takenIdentifier,
    'a call with the identifier arrives, and no other reason of 6-1 applies to it': takenIdentifier,
    'a signal within the limits of 6-5 arrives from one of the two pages': {
      ids: ['6-3', '6-5'],
      outcome: { state: 'live', effect: 'the other page gets it, in the order it arrived' }
    },
    'a signal beyond the limits of 6-5 arrives from one of the two pages': {
      ids: ['6-5'],
      outcome: { state: 'none', effect: 'the server drops it, and both pages get failed' }
    },
    'a signal or closing message with the identifier arrives from another page': {
      ids: ['6-3'],
      outcome: { state: 'live', effect: 'the server drops it' }
    },
    'a closing message arrives from one of the two pages': {
      ids: ['6-3', '6-6'],
      outcome: { state: 'none', effect: 'the other page gets it, in the order it arrived' }
    },
    'the deadline of the record passes': {
      ids: ['6-6'],
      outcome: { state: 'none', effect: 'nothing' }
    },
    'the signaling connection of one of the two pages closes': {
      ids: ['6-6'],
      outcome: { state: 'none', effect: 'the other page gets peer offline' }
    }
  }
}
