type State = 'opening' | 'open' | 'closed'

type StartEvent =
  | 'a WebSocket connection arrives from an allowed origin while fewer than 250 signaling connections are opening or open'
  | 'a WebSocket connection arrives with another origin or none'
  | 'a WebSocket connection arrives while 250 signaling connections are opening or open'

type Event =
  | 'the page names versions that the server accepts'
  | 'the page names versions that the server refuses'
  | '10 seconds pass since the server accepted the connection, and the page has named no versions'
  | 'a check is due, and the page answered one of the last two'
  | 'a check is due, and the page answered neither of the last two'
  | 'a message arrives while the connection has a message to spend'
  | 'a message arrives while the connection has no message to spend'
  | 'the page sends a WebSocket message over 65,536 bytes'
  | 'the page sends a module message that 1-10 does not allow'
  | 'the page sends a module message on a channel that it did not name'
  | 'the page sends a request for TURN credentials'
  | 'more than 262,144 bytes sent to the connection have not left the server'
  | 'the page closes the WebSocket connection or the network drops it'
  | 'the server restarts or is deployed'
  | 'the process of the server fails'

type Server =
  | 'accepts the connection'
  | 'refuses the connection'
  | 'accepts the versions'
  | 'refuses the versions, says which side is older and closes the connection'
  | 'sends a check'
  | 'reads it'
  | 'reads it once the connection regains a message to spend'
  | 'closes the connection'
  | 'tells the page nothing'
  | 'nothing'

type Outcome = {readonly state: State | 'refused'; readonly server: Server}

type Cell =
  | {readonly ids: readonly string[]; readonly outcome: Outcome}
  | {readonly impossible: string}
  | {readonly elsewhere: '2-server-parts.md' | '8-turn.md'}

const versionsOnce: Cell = {
  impossible:
    'the page names its versions once, when it opens the connection (1-2); naming them again is a message that the page part does not send, which closes the connection (7-4)'
}
const nothingAfterClosing: Cell = {impossible: 'the server sends, reads and keeps nothing for a closed connection (2-3, 7-2)'}
const checksOnlyOpen: Cell = {
  impossible:
    'the server sends checks only on an open connection (7-2), and an opening one opens as soon as its versions arrive (7-1) or closes at 10 seconds (7-9)'
}
const closes = (ids: readonly string[]): Cell => ({ids, outcome: {state: 'closed', server: 'closes the connection'}})

export const start: {readonly [E in StartEvent]: Cell} = {
  'a WebSocket connection arrives from an allowed origin while fewer than 250 signaling connections are opening or open': {
    ids: ['7-6', '7-8'],
    outcome: {state: 'opening', server: 'accepts the connection'}
  },
  'a WebSocket connection arrives with another origin or none': {
    ids: ['7-6'],
    outcome: {state: 'refused', server: 'refuses the connection'}
  },
  'a WebSocket connection arrives while 250 signaling connections are opening or open': {
    ids: ['7-8'],
    outcome: {state: 'refused', server: 'refuses the connection'}
  }
}

export const table: {readonly [S in State]: {readonly [E in Event]: Cell}} = {
  opening: {
    'the page names versions that the server accepts': {
      ids: ['7-1'],
      outcome: {state: 'open', server: 'accepts the versions'}
    },
    'the page names versions that the server refuses': {
      ids: ['7-1'],
      outcome: {state: 'closed', server: 'refuses the versions, says which side is older and closes the connection'}
    },
    '10 seconds pass since the server accepted the connection, and the page has named no versions': closes(['7-9']),
    'a check is due, and the page answered one of the last two': checksOnlyOpen,
    'a check is due, and the page answered neither of the last two': checksOnlyOpen,
    'a message arrives while the connection has a message to spend': {
      ids: ['7-3'],
      outcome: {state: 'opening', server: 'reads it'}
    },
    'a message arrives while the connection has no message to spend': {
      impossible:
        'before the versions, any message other than the versions closes the connection (7-4), so an opening connection spends at most one of its 200 messages (7-3)'
    },
    'the page sends a WebSocket message over 65,536 bytes': closes(['7-4']),
    'the page sends a module message that 1-10 does not allow': closes(['7-4']),
    'the page sends a module message on a channel that it did not name': closes(['7-4']),
    'the page sends a request for TURN credentials': closes(['7-4']),
    'more than 262,144 bytes sent to the connection have not left the server': closes(['7-5']),
    'the page closes the WebSocket connection or the network drops it': {elsewhere: '2-server-parts.md'},
    'the server restarts or is deployed': closes(['7-7']),
    'the process of the server fails': {
      ids: ['7-7'],
      outcome: {state: 'closed', server: 'tells the page nothing'}
    }
  },
  open: {
    'the page names versions that the server accepts': versionsOnce,
    'the page names versions that the server refuses': versionsOnce,
    '10 seconds pass since the server accepted the connection, and the page has named no versions': {
      impossible: 'an open connection has named its versions (7-1)'
    },
    'a check is due, and the page answered one of the last two': {
      ids: ['7-2'],
      outcome: {state: 'open', server: 'sends a check'}
    },
    'a check is due, and the page answered neither of the last two': closes(['7-2']),
    'a message arrives while the connection has a message to spend': {
      ids: ['7-3'],
      outcome: {state: 'open', server: 'reads it'}
    },
    'a message arrives while the connection has no message to spend': {
      ids: ['7-3'],
      outcome: {state: 'open', server: 'reads it once the connection regains a message to spend'}
    },
    'the page sends a WebSocket message over 65,536 bytes': closes(['7-4']),
    'the page sends a module message that 1-10 does not allow': closes(['7-4']),
    'the page sends a module message on a channel that it did not name': closes(['7-4']),
    'the page sends a request for TURN credentials': {elsewhere: '8-turn.md'},
    'more than 262,144 bytes sent to the connection have not left the server': closes(['7-5']),
    'the page closes the WebSocket connection or the network drops it': {elsewhere: '2-server-parts.md'},
    'the server restarts or is deployed': closes(['7-7']),
    'the process of the server fails': {
      ids: ['7-7'],
      outcome: {state: 'closed', server: 'tells the page nothing'}
    }
  },
  closed: {
    'the page names versions that the server accepts': nothingAfterClosing,
    'the page names versions that the server refuses': nothingAfterClosing,
    '10 seconds pass since the server accepted the connection, and the page has named no versions': nothingAfterClosing,
    'a check is due, and the page answered one of the last two': nothingAfterClosing,
    'a check is due, and the page answered neither of the last two': nothingAfterClosing,
    'a message arrives while the connection has a message to spend': nothingAfterClosing,
    'a message arrives while the connection has no message to spend': nothingAfterClosing,
    'the page sends a WebSocket message over 65,536 bytes': nothingAfterClosing,
    'the page sends a module message that 1-10 does not allow': nothingAfterClosing,
    'the page sends a module message on a channel that it did not name': nothingAfterClosing,
    'the page sends a request for TURN credentials': nothingAfterClosing,
    'more than 262,144 bytes sent to the connection have not left the server': nothingAfterClosing,
    'the page closes the WebSocket connection or the network drops it': {impossible: 'a connection closes once'},
    'the server restarts or is deployed': {ids: ['7-7'], outcome: {state: 'closed', server: 'nothing'}},
    'the process of the server fails': {ids: ['7-7'], outcome: {state: 'closed', server: 'nothing'}}
  }
}
