type State = 'opening' | 'open' | 'closed'

type Event =
  | 'the server reads a module message from the connection'
  | 'a server part sends a module message to the peer ID of the connection, which has a channel of its module'
  | 'a server part sends a module message to the peer ID of the connection, which has no channel of its module'
  | 'a server part sends a value that is not a module message'
  | 'the connection closes with no message from it waiting unread'
  | 'the connection closes while messages from it wait unread'
  | 'a handler of a server part throws or its promise rejects'

type Effect =
  | 'the server part gets it with the peer ID'
  | 'the page gets it'
  | 'sending fails'
  | 'the server drops it, telling the server part nothing'
  | 'the server drops it'
  | 'each server part with a channel on it is told once, after every message that the server read from it'
  | 'each server part with a channel on it is told once, after every message that the server read from it, and the unread ones are lost'
  | 'no server part is told'
  | 'it counts as delivered, and the transport goes on'

type Outcome = { readonly state: State; readonly effect: Effect }

type Cell = { readonly ids: readonly string[]; readonly outcome: Outcome } | { readonly impossible: string }

const noPeerId =
  'a server part can address a connection only by its peer ID, which an opening connection does not have yet (1-3, 2-2)'

export const table: { readonly [S in State]: { readonly [E in Event]: Cell } } = {
  opening: {
    'the server reads a module message from the connection': {
      impossible: 'a module message before the peer ID is a message that the page part does not send, which closes the connection (7-4)'
    },
    'a server part sends a module message to the peer ID of the connection, which has a channel of its module': {
      impossible: noPeerId
    },
    'a server part sends a module message to the peer ID of the connection, which has no channel of its module': {
      impossible: noPeerId
    },
    'a server part sends a value that is not a module message': { impossible: noPeerId },
    'the connection closes with no message from it waiting unread': {
      ids: ['2-3'],
      outcome: { state: 'closed', effect: 'no server part is told' }
    },
    'the connection closes while messages from it wait unread': {
      ids: ['2-3'],
      outcome: { state: 'closed', effect: 'no server part is told' }
    },
    'a handler of a server part throws or its promise rejects': {
      impossible: 'the server passes server parts nothing about a connection without a peer ID (2-1, 2-3)'
    }
  },
  open: {
    'the server reads a module message from the connection': {
      ids: ['2-1'],
      outcome: { state: 'open', effect: 'the server part gets it with the peer ID' }
    },
    'a server part sends a module message to the peer ID of the connection, which has a channel of its module': {
      ids: ['2-2'],
      outcome: { state: 'open', effect: 'the page gets it' }
    },
    'a server part sends a module message to the peer ID of the connection, which has no channel of its module': {
      ids: ['2-2'],
      outcome: { state: 'open', effect: 'the server drops it, telling the server part nothing' }
    },
    'a server part sends a value that is not a module message': {
      ids: ['2-2'],
      outcome: { state: 'open', effect: 'sending fails' }
    },
    'the connection closes with no message from it waiting unread': {
      ids: ['2-3'],
      outcome: {
        state: 'closed',
        effect: 'each server part with a channel on it is told once, after every message that the server read from it'
      }
    },
    'the connection closes while messages from it wait unread': {
      ids: ['2-3'],
      outcome: {
        state: 'closed',
        effect:
          'each server part with a channel on it is told once, after every message that the server read from it, and the unread ones are lost'
      }
    },
    'a handler of a server part throws or its promise rejects': {
      ids: ['2-4'],
      outcome: { state: 'open', effect: 'it counts as delivered, and the transport goes on' }
    }
  },
  closed: {
    'the server reads a module message from the connection': {
      impossible: 'the server reads nothing from a closed connection, and what it did not read is lost (2-3)'
    },
    'a server part sends a module message to the peer ID of the connection, which has a channel of its module': {
      ids: ['2-2'],
      outcome: { state: 'closed', effect: 'the server drops it, telling the server part nothing' }
    },
    'a server part sends a module message to the peer ID of the connection, which has no channel of its module': {
      ids: ['2-2'],
      outcome: { state: 'closed', effect: 'the server drops it, telling the server part nothing' }
    },
    'a server part sends a value that is not a module message': {
      ids: ['2-2'],
      outcome: { state: 'closed', effect: 'sending fails' }
    },
    'the connection closes with no message from it waiting unread': { impossible: 'a connection closes once' },
    'the connection closes while messages from it wait unread': { impossible: 'a connection closes once' },
    'a handler of a server part throws or its promise rejects': {
      ids: ['2-4'],
      outcome: { state: 'closed', effect: 'it counts as delivered, and the transport goes on' }
    }
  }
}
