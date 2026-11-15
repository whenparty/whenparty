type State = 'opening' | 'open' | 'closed'

type Event =
  | 'the page closes it'
  | 'the page unloads or enters the back/forward cache'
  | 'the page returns from the back/forward cache'
  | 'a module sends a module message'
  | 'a module sends a value that is not a module message'
  | 'the peer ID arrives'
  | 'the server refuses the versions'
  | 'a check arrives'
  | 'a check arrives while the browser slows the timers of the page'
  | 'a module message arrives'
  | 'a message of the transport for a peer connection or for the list of the connection arrives'
  | 'a module handler of a module message throws'
  | 'a module handler of a notice about the connection throws'
  | 'the browser reports that the WebSocket connection closed'
  | '10 seconds pass without a peer ID'
  | 'the scripts resume after 10 seconds without a peer ID, with the peer ID waiting'
  | '45 seconds pass with nothing arriving'
  | 'the scripts resume after 45 seconds with nothing handled, with messages waiting'

type Told =
  | 'nothing'
  | 'open, with the peer ID'
  | 'the module message'
  | 'closed: offline, with the moment the last message arrived, or the page began to open it'
  | 'closed: outdated, with the older side and the moment the last message arrived, or the page began to open it'

type Page =
  | 'nothing'
  | 'closes the WebSocket connection'
  | 'closes the WebSocket connection once the browser has sent what the page sent'
  | 'closes the WebSocket connection and drops what waits'
  | 'answers the check at once'
  | 'sends the message'
  | 'sending fails'
  | 'delivers it'
  | 'drops it'
  | 'counts it as delivered and goes on'

type Outcome = { readonly state: State; readonly told: Told; readonly page: Page }

type Cell = { readonly ids: readonly string[]; readonly outcome: Outcome } | { readonly impossible: string }

const unaddressable =
  'before it is open, the page sends only its versions and answers to checks (7-4), and nothing can address a connection without a peer ID (2-2, 6-1)'
const closedOnEntering = 'the page closed every connection when it entered the back/forward cache (1-8)'

const closedByPage: Outcome = {
  state: 'closed',
  told: 'nothing',
  page: 'closes the WebSocket connection once the browser has sent what the page sent'
}
const offlineByPage: Outcome = { state: 'closed', told: 'closed: offline, with the moment the last message arrived, or the page began to open it', page: 'closes the WebSocket connection' }
const stays = (state: State, page: Page): Outcome => ({ state, told: 'nothing', page })

export const table: { readonly [S in State]: { readonly [E in Event]: Cell } } = {
  opening: {
    'the page closes it': { ids: ['1-8', '1-16'], outcome: closedByPage },
    'the page unloads or enters the back/forward cache': { ids: ['1-8', '1-16'], outcome: closedByPage },
    'the page returns from the back/forward cache': { impossible: closedOnEntering },
    'a module sends a module message': { ids: ['1-10'], outcome: stays('opening', 'sending fails') },
    'a module sends a value that is not a module message': { ids: ['1-10'], outcome: stays('opening', 'sending fails') },
    'the peer ID arrives': {
      ids: ['1-3'],
      outcome: { state: 'open', told: 'open, with the peer ID', page: 'nothing' }
    },
    'the server refuses the versions': {
      ids: ['1-2', '1-9', '1-15'],
      outcome: { state: 'closed', told: 'closed: outdated, with the older side and the moment the last message arrived, or the page began to open it', page: 'nothing' }
    },
    'a check arrives': { ids: ['1-6'], outcome: stays('opening', 'answers the check at once') },
    'a check arrives while the browser slows the timers of the page': {
      ids: ['1-6'],
      outcome: stays('opening', 'answers the check at once')
    },
    'a module message arrives': { impossible: unaddressable },
    'a message of the transport for a peer connection or for the list of the connection arrives': {
      impossible: unaddressable
    },
    'a module handler of a module message throws': { impossible: 'no module message arrives before the connection is open (1-11)' },
    'a module handler of a notice about the connection throws': {
      impossible: 'the first notice about the connection is that it is open (1-3)'
    },
    'the browser reports that the WebSocket connection closed': {
      ids: ['1-5', '1-9', '1-15'],
      outcome: { state: 'closed', told: 'closed: offline, with the moment the last message arrived, or the page began to open it', page: 'nothing' }
    },
    '10 seconds pass without a peer ID': { ids: ['1-4', '1-9', '1-15'], outcome: offlineByPage },
    'the scripts resume after 10 seconds without a peer ID, with the peer ID waiting': {
      ids: ['1-4', '1-7', '1-9', '1-15'],
      outcome: { state: 'closed', told: 'closed: offline, with the moment the last message arrived, or the page began to open it', page: 'closes the WebSocket connection and drops what waits' }
    },
    '45 seconds pass with nothing arriving': { impossible: 'an opening connection closes after 10 seconds (1-4)' },
    'the scripts resume after 45 seconds with nothing handled, with messages waiting': {
      impossible: 'an opening connection closes after 10 seconds, which the page checks first (1-4, 1-7)'
    }
  },
  open: {
    'the page closes it': { ids: ['1-8', '1-16'], outcome: closedByPage },
    'the page unloads or enters the back/forward cache': { ids: ['1-8', '1-16'], outcome: closedByPage },
    'the page returns from the back/forward cache': { impossible: closedOnEntering },
    'a module sends a module message': { ids: ['1-10', '1-11'], outcome: stays('open', 'sends the message') },
    'a module sends a value that is not a module message': { ids: ['1-10'], outcome: stays('open', 'sending fails') },
    'the peer ID arrives': { impossible: 'the server gives each connection one peer ID (1-3)' },
    'the server refuses the versions': {
      impossible: 'the server refuses the versions instead of giving a peer ID, not after it (1-2, 1-3)'
    },
    'a check arrives': { ids: ['1-6'], outcome: stays('open', 'answers the check at once') },
    'a check arrives while the browser slows the timers of the page': {
      ids: ['1-6'],
      outcome: stays('open', 'answers the check at once')
    },
    'a module message arrives': {
      ids: ['1-11'],
      outcome: { state: 'open', told: 'the module message', page: 'nothing' }
    },
    'a message of the transport for a peer connection or for the list of the connection arrives': {
      ids: ['1-11'],
      outcome: stays('open', 'delivers it')
    },
    'a module handler of a module message throws': {
      ids: ['1-12'],
      outcome: stays('open', 'counts it as delivered and goes on')
    },
    'a module handler of a notice about the connection throws': {
      ids: ['1-12'],
      outcome: stays('open', 'counts it as delivered and goes on')
    },
    'the browser reports that the WebSocket connection closed': {
      ids: ['1-5', '1-9', '1-15'],
      outcome: { state: 'closed', told: 'closed: offline, with the moment the last message arrived, or the page began to open it', page: 'nothing' }
    },
    '10 seconds pass without a peer ID': { impossible: 'an open connection has its peer ID (1-3)' },
    'the scripts resume after 10 seconds without a peer ID, with the peer ID waiting': {
      impossible: 'an open connection has its peer ID (1-3)'
    },
    '45 seconds pass with nothing arriving': { ids: ['1-6', '1-9', '1-15'], outcome: offlineByPage },
    'the scripts resume after 45 seconds with nothing handled, with messages waiting': {
      ids: ['1-6', '1-7', '1-9', '1-15'],
      outcome: { state: 'closed', told: 'closed: offline, with the moment the last message arrived, or the page began to open it', page: 'closes the WebSocket connection and drops what waits' }
    }
  },
  closed: {
    'the page closes it': { ids: ['1-8'], outcome: stays('closed', 'nothing') },
    'the page unloads or enters the back/forward cache': { ids: ['1-8'], outcome: stays('closed', 'nothing') },
    'the page returns from the back/forward cache': { ids: ['1-14'], outcome: stays('closed', 'nothing') },
    'a module sends a module message': { ids: ['1-10'], outcome: stays('closed', 'sending fails') },
    'a module sends a value that is not a module message': { ids: ['1-10'], outcome: stays('closed', 'sending fails') },
    'the peer ID arrives': { ids: ['1-9', '1-14'], outcome: stays('closed', 'drops it') },
    'the server refuses the versions': { ids: ['1-9'], outcome: stays('closed', 'drops it') },
    'a check arrives': { ids: ['1-9'], outcome: stays('closed', 'drops it') },
    'a check arrives while the browser slows the timers of the page': { ids: ['1-9'], outcome: stays('closed', 'drops it') },
    'a module message arrives': { ids: ['1-9'], outcome: stays('closed', 'drops it') },
    'a message of the transport for a peer connection or for the list of the connection arrives': {
      ids: ['1-9'],
      outcome: stays('closed', 'drops it')
    },
    'a module handler of a module message throws': {
      impossible: 'the transport delivers nothing from a closed connection (1-9)'
    },
    'a module handler of a notice about the connection throws': {
      ids: ['1-12'],
      outcome: stays('closed', 'counts it as delivered and goes on')
    },
    'the browser reports that the WebSocket connection closed': { ids: ['1-9'], outcome: stays('closed', 'nothing') },
    '10 seconds pass without a peer ID': { ids: ['1-9', '1-14'], outcome: stays('closed', 'nothing') },
    'the scripts resume after 10 seconds without a peer ID, with the peer ID waiting': {
      ids: ['1-9', '1-14'],
      outcome: stays('closed', 'drops it')
    },
    '45 seconds pass with nothing arriving': { ids: ['1-9', '1-14'], outcome: stays('closed', 'nothing') },
    'the scripts resume after 45 seconds with nothing handled, with messages waiting': {
      ids: ['1-9', '1-14'],
      outcome: stays('closed', 'drops it')
    }
  }
}
