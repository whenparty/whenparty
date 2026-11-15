type State = 'connecting' | 'channel' | 'open' | 'closed, closing the channel' | 'closed'

type Event =
  | 'the module sends a text'
  | 'the module sends a value that is not a text'
  | 'a text arrives, and the module has a handler of texts'
  | 'a text arrives, and the module has no handler of texts'
  | 'the module handler of a text throws'
  | 'a message that is neither a text nor one of the transport own, or a text over 65,536 bytes, arrives'
  | 'the chosen pair of candidates changes'
  | 'the module handler of the path notice throws'
  | 'the side closes, not on a closing message, with its own signaling connection open and its channel not open'
  | 'the side closes, not on a closing message, with its own signaling connection open and its channel open'
  | 'the side closes, not on a closing message, with its own signaling connection not open and its channel not open'
  | 'the side closes, not on a closing message, with its own signaling connection not open and its channel open'
  | 'a closing message arrives'
  | 'a closing message with too small arrives'
  | 'its channel closes, or 1 second passes, after the side closed'
  | 'a check arrives'
  | 'a check arrives while the browser slows the timers of the page'
  | 'the answer to a check arrives'
  | 'the ready of the other side arrives'
  | '15 seconds pass with nothing arriving'
  | 'the scripts resume after 15 seconds with nothing handled, with checks waiting'
  | '5 seconds pass since the side last sent a check'
  | 'the browser reports that the connection failed or closed, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived'
  | 'the browser reports that the connection failed or closed, in any other case'
  | 'the channel closes without a closing message'
  | 'the browser fails to send'
  | 'the browser reports that the connection is disconnected'

type Reason = 'none' | 'its own' | 'closed' | 'too small' | 'broken'

type Told = 'nothing' | 'the text' | 'the path and the round-trip time'

type Sends =
  | 'nothing'
  | 'the text'
  | 'a check'
  | 'the answer to the check at once'
  | 'a closing message through the server'
  | 'a closing message through the server and on the channel'
  | 'a closing message on the channel'

type Then =
  | 'nothing'
  | 'sending fails'
  | 'drops it'
  | 'counts it as delivered and goes on'
  | 'goes on'
  | 'closes the browser connection at once'
  | 'closes the channel, then the browser connection when the channel has closed or 1 second has passed'
  | 'closes the browser connection'

type Outcome = {
  readonly state: State
  readonly reason: Reason
  readonly told: Told
  readonly sends: Sends
  readonly then: Then
}

type Cell =
  | { readonly ids: readonly string[]; readonly outcome: Outcome }
  | { readonly impossible: string }
  | { readonly elsewhere: '3-connection.md' }

const outcome = (state: State, then: Then, sends: Sends = 'nothing', told: Told = 'nothing'): Outcome => ({
  state,
  reason: 'none',
  told,
  sends,
  then
})
const closesNow = (reason: Reason, sends: Sends): Outcome => ({
  state: 'closed',
  reason,
  told: 'nothing',
  sends,
  then: 'closes the browser connection at once'
})
const closesChannelFirst = (reason: Reason, sends: Sends): Outcome => ({
  state: 'closed, closing the channel',
  reason,
  told: 'nothing',
  sends,
  then: 'closes the channel, then the browser connection when the channel has closed or 1 second has passed'
})

const inThree: Cell = { elsewhere: '3-connection.md' }
const channelNotOpenHere: Cell = { impossible: 'nothing arrives on a channel before it opens on this side' }
const textsOnlyOpen: Cell = { impossible: 'texts reach the module only while its side is open (4-2)' }
const pathOnlyOpen: Cell = { impossible: 'only an open side tells the module of a new path (4-6)' }
const channelOpen: Cell = { impossible: 'the channel of a side in this state is open (3-6)' }
const channelNotOpen: Cell = { impossible: 'the channel of a side in this state is not open (3-6)' }
const closesOnce: Cell = { impossible: 'a side closes once (3-11)' }
const notClosing: Cell = { impossible: 'the side is not closing its channel' }
const deadlineFirst: Cell = { impossible: 'the deadline, at most 15 seconds after the attempt began, passes first (3-5)' }
const onlyWhileOpen: Cell = { impossible: 'a side counts silence and sends checks only while open (4-8)' }

export const table: { readonly [S in State]: { readonly [E in Event]: Cell } } = {
  connecting: {
    'the module sends a text': { ids: ['4-1'], outcome: outcome('connecting', 'sending fails') },
    'the module sends a value that is not a text': { ids: ['4-1'], outcome: outcome('connecting', 'sending fails') },
    'a text arrives, and the module has a handler of texts': channelNotOpenHere,
    'a text arrives, and the module has no handler of texts': channelNotOpenHere,
    'the module handler of a text throws': textsOnlyOpen,
    'a message that is neither a text nor one of the transport own, or a text over 65,536 bytes, arrives': channelNotOpenHere,
    'the chosen pair of candidates changes': { ids: ['4-6'], outcome: outcome('connecting', 'nothing') },
    'the module handler of the path notice throws': pathOnlyOpen,
    'the side closes, not on a closing message, with its own signaling connection open and its channel not open': {
      ids: ['4-4', '4-5'],
      outcome: closesNow('its own', 'a closing message through the server')
    },
    'the side closes, not on a closing message, with its own signaling connection open and its channel open': {
      ids: ['4-4', '4-5'],
      outcome: closesChannelFirst('its own', 'a closing message through the server and on the channel')
    },
    'the side closes, not on a closing message, with its own signaling connection not open and its channel not open': {
      ids: ['4-4', '4-5'],
      outcome: closesNow('its own', 'nothing')
    },
    'the side closes, not on a closing message, with its own signaling connection not open and its channel open': {
      ids: ['4-4', '4-5'],
      outcome: closesChannelFirst('its own', 'a closing message on the channel')
    },
    'a closing message arrives': { ids: ['4-4', '4-5', '4-7'], outcome: closesNow('closed', 'nothing') },
    'a closing message with too small arrives': { ids: ['4-4', '4-5', '4-7'], outcome: closesNow('too small', 'nothing') },
    'its channel closes, or 1 second passes, after the side closed': notClosing,
    'a check arrives': channelNotOpenHere,
    'a check arrives while the browser slows the timers of the page': channelNotOpenHere,
    'the answer to a check arrives': channelNotOpenHere,
    'the ready of the other side arrives': channelNotOpenHere,
    '15 seconds pass with nothing arriving': deadlineFirst,
    'the scripts resume after 15 seconds with nothing handled, with checks waiting': channelNotOpenHere,
    '5 seconds pass since the side last sent a check': onlyWhileOpen,
    'the browser reports that the connection failed or closed, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
      inThree,
    'the browser reports that the connection failed or closed, in any other case': inThree,
    'the channel closes without a closing message': { impossible: 'the channel has not opened on this side' },
    'the browser fails to send': { impossible: 'the side sends nothing on the browser connection before its channel opens' },
    'the browser reports that the connection is disconnected': { ids: ['4-8'], outcome: outcome('connecting', 'nothing') }
  },
  channel: {
    'the module sends a text': { ids: ['4-1'], outcome: outcome('channel', 'sending fails') },
    'the module sends a value that is not a text': { ids: ['4-1'], outcome: outcome('channel', 'sending fails') },
    'a text arrives, and the module has a handler of texts': { ids: ['4-2'], outcome: outcome('channel', 'drops it') },
    'a text arrives, and the module has no handler of texts': { ids: ['4-2'], outcome: outcome('channel', 'drops it') },
    'the module handler of a text throws': textsOnlyOpen,
    'a message that is neither a text nor one of the transport own, or a text over 65,536 bytes, arrives': {
      ids: ['4-2'],
      outcome: outcome('channel', 'drops it')
    },
    'the chosen pair of candidates changes': { ids: ['4-6'], outcome: outcome('channel', 'nothing') },
    'the module handler of the path notice throws': pathOnlyOpen,
    'the side closes, not on a closing message, with its own signaling connection open and its channel not open': channelOpen,
    'the side closes, not on a closing message, with its own signaling connection open and its channel open': {
      ids: ['4-4', '4-5'],
      outcome: closesChannelFirst('its own', 'a closing message through the server and on the channel')
    },
    'the side closes, not on a closing message, with its own signaling connection not open and its channel not open':
      channelOpen,
    'the side closes, not on a closing message, with its own signaling connection not open and its channel open': {
      ids: ['4-4', '4-5'],
      outcome: closesChannelFirst('its own', 'a closing message on the channel')
    },
    'a closing message arrives': { ids: ['4-4', '4-5', '4-7'], outcome: closesChannelFirst('closed', 'nothing') },
    'a closing message with too small arrives': {
      ids: ['4-4', '4-5', '4-7'],
      outcome: closesChannelFirst('too small', 'nothing')
    },
    'its channel closes, or 1 second passes, after the side closed': notClosing,
    'a check arrives': { ids: ['4-9'], outcome: outcome('channel', 'drops it') },
    'a check arrives while the browser slows the timers of the page': { ids: ['4-9'], outcome: outcome('channel', 'drops it') },
    'the answer to a check arrives': { ids: ['4-9'], outcome: outcome('channel', 'drops it') },
    'the ready of the other side arrives': inThree,
    '15 seconds pass with nothing arriving': deadlineFirst,
    'the scripts resume after 15 seconds with nothing handled, with checks waiting': deadlineFirst,
    '5 seconds pass since the side last sent a check': onlyWhileOpen,
    'the browser reports that the connection failed or closed, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
      inThree,
    'the browser reports that the connection failed or closed, in any other case': inThree,
    'the channel closes without a closing message': inThree,
    'the browser fails to send': inThree,
    'the browser reports that the connection is disconnected': { ids: ['4-8'], outcome: outcome('channel', 'nothing') }
  },
  open: {
    'the module sends a text': { ids: ['4-1', '4-2'], outcome: outcome('open', 'nothing', 'the text') },
    'the module sends a value that is not a text': { ids: ['4-1'], outcome: outcome('open', 'sending fails') },
    'a text arrives, and the module has a handler of texts': {
      ids: ['4-2'],
      outcome: outcome('open', 'nothing', 'nothing', 'the text')
    },
    'a text arrives, and the module has no handler of texts': {
      ids: ['4-2'],
      outcome: outcome('open', 'counts it as delivered and goes on')
    },
    'the module handler of a text throws': { ids: ['4-2'], outcome: outcome('open', 'counts it as delivered and goes on') },
    'a message that is neither a text nor one of the transport own, or a text over 65,536 bytes, arrives': {
      ids: ['4-2'],
      outcome: outcome('open', 'drops it')
    },
    'the chosen pair of candidates changes': {
      ids: ['4-6'],
      outcome: outcome('open', 'nothing', 'nothing', 'the path and the round-trip time')
    },
    'the module handler of the path notice throws': { ids: ['4-6'], outcome: outcome('open', 'goes on') },
    'the side closes, not on a closing message, with its own signaling connection open and its channel not open': channelOpen,
    'the side closes, not on a closing message, with its own signaling connection open and its channel open': {
      ids: ['4-4', '4-5'],
      outcome: closesChannelFirst('its own', 'a closing message on the channel')
    },
    'the side closes, not on a closing message, with its own signaling connection not open and its channel not open':
      channelOpen,
    'the side closes, not on a closing message, with its own signaling connection not open and its channel open': {
      ids: ['4-4', '4-5'],
      outcome: closesChannelFirst('its own', 'a closing message on the channel')
    },
    'a closing message arrives': { ids: ['4-4', '4-5', '4-7'], outcome: closesChannelFirst('closed', 'nothing') },
    'a closing message with too small arrives': {
      ids: ['4-4', '4-5', '4-7'],
      outcome: closesChannelFirst('too small', 'nothing')
    },
    'its channel closes, or 1 second passes, after the side closed': notClosing,
    'a check arrives': { ids: ['4-8'], outcome: outcome('open', 'nothing', 'the answer to the check at once') },
    'a check arrives while the browser slows the timers of the page': {
      ids: ['4-8'],
      outcome: outcome('open', 'nothing', 'the answer to the check at once')
    },
    'the answer to a check arrives': { ids: ['4-8'], outcome: outcome('open', 'nothing') },
    'the ready of the other side arrives': { ids: ['4-9'], outcome: outcome('open', 'drops it') },
    '15 seconds pass with nothing arriving': {
      ids: ['4-4', '4-5', '4-8'],
      outcome: closesChannelFirst('broken', 'a closing message on the channel')
    },
    'the scripts resume after 15 seconds with nothing handled, with checks waiting': {
      ids: ['4-4', '4-5', '4-8'],
      outcome: closesChannelFirst('broken', 'a closing message on the channel')
    },
    '5 seconds pass since the side last sent a check': { ids: ['4-8'], outcome: outcome('open', 'nothing', 'a check') },
    'the browser reports that the connection failed or closed, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
      { ids: ['4-4', '4-5', '4-8'], outcome: closesChannelFirst('broken', 'a closing message on the channel') },
    'the browser reports that the connection failed or closed, in any other case': {
      ids: ['4-4', '4-5', '4-8'],
      outcome: closesChannelFirst('broken', 'a closing message on the channel')
    },
    'the channel closes without a closing message': { ids: ['4-5', '4-8'], outcome: closesNow('broken', 'nothing') },
    'the browser fails to send': {
      ids: ['4-4', '4-5', '4-8'],
      outcome: closesChannelFirst('broken', 'a closing message on the channel')
    },
    'the browser reports that the connection is disconnected': { ids: ['4-8'], outcome: outcome('open', 'nothing') }
  },
  'closed, closing the channel': {
    'the module sends a text': { ids: ['4-1'], outcome: outcome('closed, closing the channel', 'sending fails') },
    'the module sends a value that is not a text': {
      ids: ['4-1'],
      outcome: outcome('closed, closing the channel', 'sending fails')
    },
    'a text arrives, and the module has a handler of texts': inThree,
    'a text arrives, and the module has no handler of texts': inThree,
    'the module handler of a text throws': textsOnlyOpen,
    'a message that is neither a text nor one of the transport own, or a text over 65,536 bytes, arrives': inThree,
    'the chosen pair of candidates changes': { ids: ['4-6'], outcome: outcome('closed, closing the channel', 'nothing') },
    'the module handler of the path notice throws': pathOnlyOpen,
    'the side closes, not on a closing message, with its own signaling connection open and its channel not open': closesOnce,
    'the side closes, not on a closing message, with its own signaling connection open and its channel open': closesOnce,
    'the side closes, not on a closing message, with its own signaling connection not open and its channel not open':
      closesOnce,
    'the side closes, not on a closing message, with its own signaling connection not open and its channel open': closesOnce,
    'a closing message arrives': inThree,
    'a closing message with too small arrives': inThree,
    'its channel closes, or 1 second passes, after the side closed': {
      ids: ['4-5'],
      outcome: outcome('closed', 'closes the browser connection')
    },
    'a check arrives': inThree,
    'a check arrives while the browser slows the timers of the page': inThree,
    'the answer to a check arrives': inThree,
    'the ready of the other side arrives': inThree,
    '15 seconds pass with nothing arriving': onlyWhileOpen,
    'the scripts resume after 15 seconds with nothing handled, with checks waiting': {
      impossible: 'for a closed side, the checks that wait are checks that arrive, which 3-connection.md covers'
    },
    '5 seconds pass since the side last sent a check': onlyWhileOpen,
    'the browser reports that the connection failed or closed, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
      inThree,
    'the browser reports that the connection failed or closed, in any other case': inThree,
    'the channel closes without a closing message': {
      impossible: 'while the side closes its channel, the channel closing is the end of its wait, another event of this table'
    },
    'the browser fails to send': inThree,
    'the browser reports that the connection is disconnected': {
      ids: ['4-8'],
      outcome: outcome('closed, closing the channel', 'nothing')
    }
  },
  closed: {
    'the module sends a text': { ids: ['4-1'], outcome: outcome('closed', 'sending fails') },
    'the module sends a value that is not a text': { ids: ['4-1'], outcome: outcome('closed', 'sending fails') },
    'a text arrives, and the module has a handler of texts': inThree,
    'a text arrives, and the module has no handler of texts': inThree,
    'the module handler of a text throws': textsOnlyOpen,
    'a message that is neither a text nor one of the transport own, or a text over 65,536 bytes, arrives': inThree,
    'the chosen pair of candidates changes': { ids: ['4-6'], outcome: outcome('closed', 'nothing') },
    'the module handler of the path notice throws': pathOnlyOpen,
    'the side closes, not on a closing message, with its own signaling connection open and its channel not open': closesOnce,
    'the side closes, not on a closing message, with its own signaling connection open and its channel open': closesOnce,
    'the side closes, not on a closing message, with its own signaling connection not open and its channel not open':
      closesOnce,
    'the side closes, not on a closing message, with its own signaling connection not open and its channel open': closesOnce,
    'a closing message arrives': inThree,
    'a closing message with too small arrives': inThree,
    'its channel closes, or 1 second passes, after the side closed': {
      impossible: 'the side has closed its browser connection already'
    },
    'a check arrives': inThree,
    'a check arrives while the browser slows the timers of the page': inThree,
    'the answer to a check arrives': inThree,
    'the ready of the other side arrives': inThree,
    '15 seconds pass with nothing arriving': onlyWhileOpen,
    'the scripts resume after 15 seconds with nothing handled, with checks waiting': {
      impossible: 'for a closed side, the checks that wait are checks that arrive, which 3-connection.md covers'
    },
    '5 seconds pass since the side last sent a check': onlyWhileOpen,
    'the browser reports that the connection failed or closed, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
      inThree,
    'the browser reports that the connection failed or closed, in any other case': inThree,
    'the channel closes without a closing message': inThree,
    'the browser fails to send': inThree,
    'the browser reports that the connection is disconnected': { ids: ['4-8'], outcome: outcome('closed', 'nothing') }
  }
}
