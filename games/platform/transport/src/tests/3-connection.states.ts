type State = 'connecting' | 'channel' | 'open' | 'closed'

type Reason = 'offline' | 'peer offline' | 'no peer' | 'busy' | 'timeout' | 'no relay' | 'failed' | 'too small' | 'closed' | 'broken'

type Told =
  | 'nothing'
  | 'incoming, with the peer ID of the caller'
  | 'open, with the path and the round-trip time'
  | `closed: ${Reason}, with the moment the last message arrived on the channel, or the attempt started`

type Does = 'nothing' | 'asks for TURN credentials' | 'goes on with TURN' | 'goes on without TURN' | 'sends ready' | 'drops it'

type Outcome = {readonly state: State; readonly told: Told; readonly does: Does}

type Cell =
  {readonly ids: readonly string[]; readonly outcome: Outcome} | {readonly impossible: string} | {readonly elsewhere: '4-delivery.md'}

type StartEvent =
  | 'a module connects over an open signaling connection'
  | 'a module connects over a signaling connection that is not open'
  | 'a call arrives, and a module has set the handler of incoming peer connections'
  | 'a call arrives, and no module has set the handler of incoming peer connections'
  | 'a call arrives, and the handler of incoming peer connections throws'

type Event =
  | 'the module closes it'
  | 'the page unloads or enters the back/forward cache'
  | 'the page returns from the back/forward cache'
  | 'its own signaling connection closes'
  | 'the server says that the signaling connection of the other page closed'
  | 'the server rejects the call with no peer'
  | 'the server rejects the call with busy'
  | 'the server rejects the call with failed'
  | 'the server says that the attempt closed with failed'
  | 'TURN credentials arrive'
  | 'an empty answer about TURN credentials arrives'
  | 'the browser reports that coturn had no free allocation for the side'
  | 'a signal of the other side arrives, and the browser accepts it'
  | 'the browser rejects the description of the other side'
  | 'the browser rejects a candidate of the other side'
  | 'the channel opens, and the side can send the largest text'
  | 'the channel opens, and the side cannot send the largest text'
  | 'the ready of the other side arrives'
  | 'the browser reports that the connection failed or closed, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived'
  | 'the browser reports that the connection failed or closed, in any other case'
  | 'the channel closes without a closing message'
  | 'the browser fails to send'
  | 'the deadline passes, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived'
  | 'the deadline passes, in any other case'
  | 'the scripts resume after the deadline, with the ready of the other side waiting'
  | 'a closing message arrives'
  | 'a closing message with too small arrives'
  | 'a text arrives, and the module has a handler of texts'
  | 'a text arrives, and the module has no handler of texts'
  | 'a message that is neither a text nor one of the transport own, or a text over 65,536 bytes, arrives'
  | 'a check arrives'
  | 'a check arrives while the browser slows the timers of the page'
  | 'the answer to a check arrives'
  | 'the module handler of the open or closed notice throws'

const stay = (state: State): Outcome => ({state, told: 'nothing', does: 'nothing'})
const drop = (state: State): Outcome => ({state, told: 'nothing', does: 'drops it'})
const close = (reason: Reason): Outcome => ({
  state: 'closed',
  told: `closed: ${reason}, with the moment the last message arrived on the channel, or the attempt started`,
  does: 'nothing'
})
const closedWithoutNotice: Outcome = {state: 'closed', told: 'nothing', does: 'nothing'}
const inFour: Cell = {elsewhere: '4-delivery.md'}

const closedOnEntering = 'the page closed every peer connection when it entered the back/forward cache (3-12)'
const rejectedBeforeCallee = 'the server rejects a call before it passes the call on, so no channel opens for it (6-1, 6-2)'
const askedOnce = 'the page asks for credentials once per attempt and starts the browser connection only on the answer (3-4)'
const channelNotOpenHere = 'nothing arrives on a channel before it opens on this side'
const oneChannel = 'an attempt opens one channel, once (3-6)'
const descriptionsFirst = 'the channel opens only after the browser has set both descriptions'
const noNoticeYet = 'the module is told of a side only when it opens or closes (3-14)'

export const start: {readonly [E in StartEvent]: Cell} = {
  'a module connects over an open signaling connection': {
    ids: ['3-1', '3-4'],
    outcome: {state: 'connecting', told: 'nothing', does: 'asks for TURN credentials'}
  },
  'a module connects over a signaling connection that is not open': {ids: ['3-2', '3-14', '3-15'], outcome: close('offline')},
  'a call arrives, and a module has set the handler of incoming peer connections': {
    ids: ['3-3', '3-4'],
    outcome: {state: 'connecting', told: 'incoming, with the peer ID of the caller', does: 'asks for TURN credentials'}
  },
  'a call arrives, and no module has set the handler of incoming peer connections': {
    ids: ['3-3'],
    outcome: closedWithoutNotice
  },
  'a call arrives, and the handler of incoming peer connections throws': {ids: ['3-3'], outcome: closedWithoutNotice}
}

export const secondIncomingHandler: {
  readonly event: 'a module sets the handler of incoming peer connections of a signaling connection that has one'
  readonly ids: readonly string[]
  readonly outcome: 'setting the handler fails'
} = {
  event: 'a module sets the handler of incoming peer connections of a signaling connection that has one',
  ids: ['3-3'],
  outcome: 'setting the handler fails'
}

export const table: {readonly [S in State]: {readonly [E in Event]: Cell}} = {
  connecting: {
    'the module closes it': {ids: ['3-12', '3-14'], outcome: closedWithoutNotice},
    'the page unloads or enters the back/forward cache': {ids: ['3-12', '3-14'], outcome: closedWithoutNotice},
    'the page returns from the back/forward cache': {impossible: closedOnEntering},
    'its own signaling connection closes': {ids: ['3-8', '3-14', '3-15'], outcome: close('offline')},
    'the server says that the signaling connection of the other page closed': {
      ids: ['3-8', '3-14', '3-15'],
      outcome: close('peer offline')
    },
    'the server rejects the call with no peer': {ids: ['3-2', '3-14', '3-15'], outcome: close('no peer')},
    'the server rejects the call with busy': {ids: ['3-2', '3-14', '3-15'], outcome: close('busy')},
    'the server rejects the call with failed': {ids: ['3-2', '3-14', '3-15'], outcome: close('failed')},
    'the server says that the attempt closed with failed': {ids: ['3-10', '3-14', '3-15'], outcome: close('failed')},
    'TURN credentials arrive': {
      ids: ['3-4'],
      outcome: {state: 'connecting', told: 'nothing', does: 'goes on with TURN'}
    },
    'an empty answer about TURN credentials arrives': {
      ids: ['3-4'],
      outcome: {state: 'connecting', told: 'nothing', does: 'goes on without TURN'}
    },
    'the browser reports that coturn had no free allocation for the side': {ids: ['3-9'], outcome: stay('connecting')},
    'a signal of the other side arrives, and the browser accepts it': {ids: ['3-10'], outcome: stay('connecting')},
    'the browser rejects the description of the other side': {ids: ['3-10', '3-14', '3-15'], outcome: close('failed')},
    'the browser rejects a candidate of the other side': {ids: ['3-10', '3-14', '3-15'], outcome: close('failed')},
    'the channel opens, and the side can send the largest text': {
      ids: ['3-6'],
      outcome: {state: 'channel', told: 'nothing', does: 'sends ready'}
    },
    'the channel opens, and the side cannot send the largest text': {
      ids: ['3-6', '3-14', '3-15'],
      outcome: close('too small')
    },
    'the ready of the other side arrives': {impossible: channelNotOpenHere},
    'the browser reports that the connection failed or closed, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
      {ids: ['3-9', '3-14', '3-15'], outcome: close('no relay')},
    'the browser reports that the connection failed or closed, in any other case': {
      ids: ['3-9', '3-14', '3-15'],
      outcome: close('timeout')
    },
    'the channel closes without a closing message': {impossible: 'the channel has not opened on this side'},
    'the browser fails to send': {impossible: 'the side sends nothing on the browser connection before its channel opens'},
    'the deadline passes, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
      {ids: ['3-5', '3-9', '3-14', '3-15'], outcome: close('no relay')},
    'the deadline passes, in any other case': {ids: ['3-5', '3-9', '3-14', '3-15'], outcome: close('timeout')},
    'the scripts resume after the deadline, with the ready of the other side waiting': {impossible: channelNotOpenHere},
    'a closing message arrives': inFour,
    'a closing message with too small arrives': inFour,
    'a text arrives, and the module has a handler of texts': {impossible: channelNotOpenHere},
    'a text arrives, and the module has no handler of texts': {impossible: channelNotOpenHere},
    'a message that is neither a text nor one of the transport own, or a text over 65,536 bytes, arrives': {
      impossible: channelNotOpenHere
    },
    'a check arrives': {impossible: channelNotOpenHere},
    'a check arrives while the browser slows the timers of the page': {impossible: channelNotOpenHere},
    'the answer to a check arrives': {impossible: channelNotOpenHere},
    'the module handler of the open or closed notice throws': {impossible: noNoticeYet}
  },
  channel: {
    'the module closes it': {ids: ['3-12', '3-14'], outcome: closedWithoutNotice},
    'the page unloads or enters the back/forward cache': {ids: ['3-12', '3-14'], outcome: closedWithoutNotice},
    'the page returns from the back/forward cache': {impossible: closedOnEntering},
    'its own signaling connection closes': {ids: ['3-8'], outcome: stay('channel')},
    'the server says that the signaling connection of the other page closed': {ids: ['3-8'], outcome: drop('channel')},
    'the server rejects the call with no peer': {impossible: rejectedBeforeCallee},
    'the server rejects the call with busy': {impossible: rejectedBeforeCallee},
    'the server rejects the call with failed': {impossible: rejectedBeforeCallee},
    'the server says that the attempt closed with failed': {ids: ['3-10', '3-14', '3-15'], outcome: close('failed')},
    'TURN credentials arrive': {impossible: askedOnce},
    'an empty answer about TURN credentials arrives': {impossible: askedOnce},
    'the browser reports that coturn had no free allocation for the side': {ids: ['3-9'], outcome: stay('channel')},
    'a signal of the other side arrives, and the browser accepts it': {ids: ['3-10'], outcome: stay('channel')},
    'the browser rejects the description of the other side': {impossible: descriptionsFirst},
    'the browser rejects a candidate of the other side': {ids: ['3-10', '3-14', '3-15'], outcome: close('failed')},
    'the channel opens, and the side can send the largest text': {impossible: oneChannel},
    'the channel opens, and the side cannot send the largest text': {impossible: oneChannel},
    'the ready of the other side arrives': {
      ids: ['3-7', '3-14'],
      outcome: {state: 'open', told: 'open, with the path and the round-trip time', does: 'nothing'}
    },
    'the browser reports that the connection failed or closed, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
      {ids: ['3-9', '3-14', '3-15'], outcome: close('timeout')},
    'the browser reports that the connection failed or closed, in any other case': {
      ids: ['3-9', '3-14', '3-15'],
      outcome: close('timeout')
    },
    'the channel closes without a closing message': {ids: ['3-9', '3-14', '3-15'], outcome: close('timeout')},
    'the browser fails to send': {ids: ['3-9', '3-14', '3-15'], outcome: close('timeout')},
    'the deadline passes, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
      {ids: ['3-5', '3-9', '3-14', '3-15'], outcome: close('timeout')},
    'the deadline passes, in any other case': {ids: ['3-5', '3-9', '3-14', '3-15'], outcome: close('timeout')},
    'the scripts resume after the deadline, with the ready of the other side waiting': {
      ids: ['3-5', '3-9', '3-14', '3-15'],
      outcome: close('timeout')
    },
    'a closing message arrives': inFour,
    'a closing message with too small arrives': inFour,
    'a text arrives, and the module has a handler of texts': inFour,
    'a text arrives, and the module has no handler of texts': inFour,
    'a message that is neither a text nor one of the transport own, or a text over 65,536 bytes, arrives': inFour,
    'a check arrives': inFour,
    'a check arrives while the browser slows the timers of the page': inFour,
    'the answer to a check arrives': inFour,
    'the module handler of the open or closed notice throws': {impossible: noNoticeYet}
  },
  open: {
    'the module closes it': {ids: ['3-12', '3-14'], outcome: closedWithoutNotice},
    'the page unloads or enters the back/forward cache': {ids: ['3-12', '3-14'], outcome: closedWithoutNotice},
    'the page returns from the back/forward cache': {impossible: closedOnEntering},
    'its own signaling connection closes': {ids: ['3-8'], outcome: stay('open')},
    'the server says that the signaling connection of the other page closed': {ids: ['3-8'], outcome: drop('open')},
    'the server rejects the call with no peer': {impossible: rejectedBeforeCallee},
    'the server rejects the call with busy': {impossible: rejectedBeforeCallee},
    'the server rejects the call with failed': {impossible: rejectedBeforeCallee},
    'the server says that the attempt closed with failed': {ids: ['3-10'], outcome: drop('open')},
    'TURN credentials arrive': {impossible: askedOnce},
    'an empty answer about TURN credentials arrives': {impossible: askedOnce},
    'the browser reports that coturn had no free allocation for the side': {ids: ['3-9'], outcome: stay('open')},
    'a signal of the other side arrives, and the browser accepts it': {ids: ['3-10'], outcome: stay('open')},
    'the browser rejects the description of the other side': {impossible: descriptionsFirst},
    'the browser rejects a candidate of the other side': {ids: ['3-10'], outcome: drop('open')},
    'the channel opens, and the side can send the largest text': {impossible: oneChannel},
    'the channel opens, and the side cannot send the largest text': {impossible: oneChannel},
    'the ready of the other side arrives': inFour,
    'the browser reports that the connection failed or closed, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
      inFour,
    'the browser reports that the connection failed or closed, in any other case': inFour,
    'the channel closes without a closing message': inFour,
    'the browser fails to send': inFour,
    'the deadline passes, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
      {ids: ['3-5'], outcome: stay('open')},
    'the deadline passes, in any other case': {ids: ['3-5'], outcome: stay('open')},
    'the scripts resume after the deadline, with the ready of the other side waiting': {
      impossible: 'a side is open only once it has handled the ready of the other side (3-7)'
    },
    'a closing message arrives': inFour,
    'a closing message with too small arrives': inFour,
    'a text arrives, and the module has a handler of texts': inFour,
    'a text arrives, and the module has no handler of texts': inFour,
    'a message that is neither a text nor one of the transport own, or a text over 65,536 bytes, arrives': inFour,
    'a check arrives': inFour,
    'a check arrives while the browser slows the timers of the page': inFour,
    'the answer to a check arrives': inFour,
    'the module handler of the open or closed notice throws': {ids: ['3-14'], outcome: stay('open')}
  },
  closed: {
    'the module closes it': {ids: ['3-12'], outcome: stay('closed')},
    'the page unloads or enters the back/forward cache': {ids: ['3-12'], outcome: stay('closed')},
    'the page returns from the back/forward cache': {ids: ['3-11'], outcome: stay('closed')},
    'its own signaling connection closes': {ids: ['3-11'], outcome: stay('closed')},
    'the server says that the signaling connection of the other page closed': {ids: ['3-11'], outcome: drop('closed')},
    'the server rejects the call with no peer': {ids: ['3-11'], outcome: drop('closed')},
    'the server rejects the call with busy': {ids: ['3-11'], outcome: drop('closed')},
    'the server rejects the call with failed': {ids: ['3-11'], outcome: drop('closed')},
    'the server says that the attempt closed with failed': {ids: ['3-11'], outcome: drop('closed')},
    'TURN credentials arrive': {ids: ['3-11'], outcome: drop('closed')},
    'an empty answer about TURN credentials arrives': {ids: ['3-11'], outcome: drop('closed')},
    'the browser reports that coturn had no free allocation for the side': {ids: ['3-11'], outcome: stay('closed')},
    'a signal of the other side arrives, and the browser accepts it': {ids: ['3-11'], outcome: drop('closed')},
    'the browser rejects the description of the other side': {ids: ['3-11'], outcome: stay('closed')},
    'the browser rejects a candidate of the other side': {ids: ['3-11'], outcome: stay('closed')},
    'the channel opens, and the side can send the largest text': {ids: ['3-11'], outcome: stay('closed')},
    'the channel opens, and the side cannot send the largest text': {ids: ['3-11'], outcome: stay('closed')},
    'the ready of the other side arrives': {ids: ['3-11'], outcome: drop('closed')},
    'the browser reports that the connection failed or closed, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
      {ids: ['3-11'], outcome: stay('closed')},
    'the browser reports that the connection failed or closed, in any other case': {ids: ['3-11'], outcome: stay('closed')},
    'the channel closes without a closing message': {ids: ['3-11'], outcome: stay('closed')},
    'the browser fails to send': {ids: ['3-11'], outcome: stay('closed')},
    'the deadline passes, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
      {ids: ['3-11'], outcome: stay('closed')},
    'the deadline passes, in any other case': {ids: ['3-11'], outcome: stay('closed')},
    'the scripts resume after the deadline, with the ready of the other side waiting': {
      ids: ['3-11'],
      outcome: drop('closed')
    },
    'a closing message arrives': {ids: ['3-11'], outcome: drop('closed')},
    'a closing message with too small arrives': {ids: ['3-11'], outcome: drop('closed')},
    'a text arrives, and the module has a handler of texts': {ids: ['3-11'], outcome: drop('closed')},
    'a text arrives, and the module has no handler of texts': {ids: ['3-11'], outcome: drop('closed')},
    'a message that is neither a text nor one of the transport own, or a text over 65,536 bytes, arrives': {
      ids: ['3-11'],
      outcome: drop('closed')
    },
    'a check arrives': {ids: ['3-11'], outcome: drop('closed')},
    'a check arrives while the browser slows the timers of the page': {ids: ['3-11'], outcome: drop('closed')},
    'the answer to a check arrives': {ids: ['3-11'], outcome: drop('closed')},
    'the module handler of the open or closed notice throws': {ids: ['3-14'], outcome: stay('closed')}
  }
}
