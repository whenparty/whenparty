type State = 'opening' | 'open' | 'closed'

type Event =
  | 'a peer ID is added that the list lacks, while the list has fewer than 64 and an open signaling connection has that peer ID'
  | 'a peer ID is added that the list lacks, while the list has 64'
  | 'a peer ID is added that the list lacks and no open signaling connection has'
  | 'a peer ID is added that the list has'
  | 'a peer ID is removed that the list has'
  | 'a peer ID is removed that the list lacks'
  | 'the signaling connection of a peer ID on the list closes'
  | 'the signaling connection closes while a change that the page made awaits its answer'

type Outcome = {
  readonly state: State
  readonly change: 'applies' | 'fails' | 'none'
  readonly list: 'gains the peer ID' | 'loses the peer ID' | 'stays as it was' | 'is gone'
}

type Cell = { readonly ids: readonly string[]; readonly outcome: Outcome } | { readonly impossible: string }

const fails = (state: State): Outcome => ({ state, change: 'fails', list: 'stays as it was' })
const emptyWhileOpening = 'the list of an opening connection is empty (5-1), and no change to it applies (5-2)'
const listGone = 'the list of a closed connection is gone (5-1)'

export const table: { readonly [S in State]: { readonly [E in Event]: Cell } } = {
  opening: {
    'a peer ID is added that the list lacks, while the list has fewer than 64 and an open signaling connection has that peer ID':
      { ids: ['5-2'], outcome: fails('opening') },
    'a peer ID is added that the list lacks, while the list has 64': { impossible: emptyWhileOpening },
    'a peer ID is added that the list lacks and no open signaling connection has': { ids: ['5-2'], outcome: fails('opening') },
    'a peer ID is added that the list has': { impossible: emptyWhileOpening },
    'a peer ID is removed that the list has': { impossible: emptyWhileOpening },
    'a peer ID is removed that the list lacks': { ids: ['5-2'], outcome: fails('opening') },
    'the signaling connection of a peer ID on the list closes': { impossible: emptyWhileOpening },
    'the signaling connection closes while a change that the page made awaits its answer': {
      impossible: 'a change to the list of a connection that is not open fails at once (5-2)'
    }
  },
  open: {
    'a peer ID is added that the list lacks, while the list has fewer than 64 and an open signaling connection has that peer ID':
      { ids: ['5-1', '5-2'], outcome: { state: 'open', change: 'applies', list: 'gains the peer ID' } },
    'a peer ID is added that the list lacks, while the list has 64': { ids: ['5-2'], outcome: fails('open') },
    'a peer ID is added that the list lacks and no open signaling connection has': { ids: ['5-2'], outcome: fails('open') },
    'a peer ID is added that the list has': {
      ids: ['5-2'],
      outcome: { state: 'open', change: 'applies', list: 'stays as it was' }
    },
    'a peer ID is removed that the list has': {
      ids: ['5-1'],
      outcome: { state: 'open', change: 'applies', list: 'loses the peer ID' }
    },
    'a peer ID is removed that the list lacks': {
      ids: ['5-2'],
      outcome: { state: 'open', change: 'applies', list: 'stays as it was' }
    },
    'the signaling connection of a peer ID on the list closes': {
      ids: ['5-2'],
      outcome: { state: 'open', change: 'none', list: 'loses the peer ID' }
    },
    'the signaling connection closes while a change that the page made awaits its answer': {
      ids: ['5-1', '5-3'],
      outcome: { state: 'closed', change: 'fails', list: 'is gone' }
    }
  },
  closed: {
    'a peer ID is added that the list lacks, while the list has fewer than 64 and an open signaling connection has that peer ID':
      { ids: ['5-2'], outcome: fails('closed') },
    'a peer ID is added that the list lacks, while the list has 64': { impossible: listGone },
    'a peer ID is added that the list lacks and no open signaling connection has': { ids: ['5-2'], outcome: fails('closed') },
    'a peer ID is added that the list has': { impossible: listGone },
    'a peer ID is removed that the list has': { impossible: listGone },
    'a peer ID is removed that the list lacks': { ids: ['5-2'], outcome: fails('closed') },
    'the signaling connection of a peer ID on the list closes': { impossible: listGone },
    'the signaling connection closes while a change that the page made awaits its answer': {
      impossible: 'a connection closes once'
    }
  }
}
