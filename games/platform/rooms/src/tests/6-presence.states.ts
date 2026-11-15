type State = 'pending' | 'letInSent' | 'unknown' | 'lostNew' | 'open' | 'lostJoined' | 'removed'

type Event =
  | 'appLetsIn'
  | 'appRefuses'
  | 'appRefusesWithOtherData'
  | 'handlerThrowsOrRejects'
  | 'serverEndsRequest'
  | 'signalingClosesWhilePending'
  | 'serverNamesNewPeer'
  | 'serverNamesSamePeer'
  | 'incomingFromNamedPeer'
  | 'incomingFromOtherPeer'
  | 'firstVisibilityArrives'
  | 'laterVisibilityArrives'
  | 'openConnectionCloses'
  | 'attemptCloses'
  | 'lossPassesWaitingTime'
  | 'leaveArrivesOverPeer'
  | 'serverReportsLeft'
  | 'rosterLeavesOut'
  | 'rosterIncludes'

type Effect =
  | 'sendsLetIn'
  | 'sendsRefusal'
  | 'sendsRefusalWithoutData'
  | 'appToldRequestEnded'
  | 'startsLoss'
  | 'closesOtherPeerConnections'
  | 'keepsIncoming'
  | 'closesOlderFromSamePeer'
  | 'closesIncoming'
  | 'appToldJoined'
  | 'appToldBack'
  | 'appToldVisibility'
  | 'appToldLost'
  | 'appToldLeft'
  | 'closesConnections'
  | 'tellsServerLeave'
  | 'tellsServerLeaveAgain'

type Outcome = { readonly next: State; readonly effects: readonly Effect[] }

type Cell<O> = { readonly ids: readonly string[]; readonly outcome: O } | { readonly impossible: string }

const s = (next: State, ids: readonly string[], effects: readonly Effect[] = []): Cell<Outcome> => ({ ids, outcome: { next, effects } })

const namedAfterLetIn = { impossible: 'the server names a number only after it let the participant in' } as const
const noPeerYet = { impossible: 'the number has no peer ID before it is named' } as const
const noConnection = { impossible: 'the page keeps no peer connection for this number' } as const
const notLost = { impossible: 'the number is not lost' } as const
const membersOnly = { impossible: 'the server reports and lists only members' } as const
const requestsEndFirst = { impossible: 'pending requests end when the signaling connection closes, before any roster' } as const
const answered = { impossible: 'the handler of the request has already answered' } as const
const letInNotEnded = { impossible: 'the server ends only requests that it has not let in' } as const
const notPending = { impossible: 'no request for this number is pending' } as const
const visibilityFirst = { impossible: 'the participant page sends its visibility first, so the connection is open for rooms before a leave arrives' } as const
const firstAlready = { impossible: 'the first visibility opened this connection already' } as const
const opensFirst = { impossible: 'the first visibility over a connection opens it for rooms' } as const
const onlyTheOpenOne = { impossible: 'the page keeps only the connection that is open for rooms for this number' } as const
const closedByPage = { impossible: 'the page closed the connections of a removed number' } as const
const learnsFromRoster = { impossible: 'the page learns of a number that it does not know from a roster first' } as const

const nothing = (st: State): Cell<Outcome> => s(st, ['6-1'])

const beforeNaming = {
  serverNamesSamePeer: noPeerYet,
  incomingFromNamedPeer: noConnection,
  incomingFromOtherPeer: s('pending', ['6-3'], ['closesIncoming']),
  firstVisibilityArrives: noConnection,
  laterVisibilityArrives: noConnection,
  openConnectionCloses: noConnection,
  attemptCloses: noConnection,
  lossPassesWaitingTime: notLost,
  leaveArrivesOverPeer: noConnection,
  serverReportsLeft: membersOnly,
  rosterLeavesOut: requestsEndFirst,
  rosterIncludes: requestsEndFirst,
} as const

const named = (st: 'lostNew' | 'open' | 'lostJoined') => ({
  appLetsIn: nothing(st),
  appRefuses: nothing(st),
  appRefusesWithOtherData: nothing(st),
  handlerThrowsOrRejects: answered,
  serverEndsRequest: letInNotEnded,
  signalingClosesWhilePending: notPending,
  incomingFromOtherPeer: s(st, ['6-3'], ['closesIncoming']),
})

export const table: { readonly [S in State]: { readonly [E in Event]: Cell<Outcome> } } = {
  pending: {
    ...beforeNaming,
    appLetsIn: s('letInSent', ['6-1'], ['sendsLetIn']),
    appRefuses: s('unknown', ['6-1'], ['sendsRefusal']),
    appRefusesWithOtherData: s('unknown', ['6-1'], ['sendsRefusalWithoutData']),
    handlerThrowsOrRejects: s('unknown', ['6-1'], ['sendsRefusal']),
    serverEndsRequest: s('unknown', ['6-2'], ['appToldRequestEnded']),
    signalingClosesWhilePending: s('unknown', ['6-2'], ['appToldRequestEnded']),
    serverNamesNewPeer: namedAfterLetIn,
  },
  letInSent: {
    ...beforeNaming,
    appLetsIn: nothing('letInSent'),
    appRefuses: nothing('letInSent'),
    appRefusesWithOtherData: nothing('letInSent'),
    handlerThrowsOrRejects: answered,
    serverEndsRequest: s('unknown', ['6-2'], ['appToldRequestEnded']),
    signalingClosesWhilePending: s('unknown', ['6-2'], ['appToldRequestEnded']),
    serverNamesNewPeer: s('lostNew', ['6-3', '6-4'], ['startsLoss']),
    incomingFromOtherPeer: s('letInSent', ['6-3'], ['closesIncoming']),
  },
  unknown: {
    appLetsIn: nothing('unknown'),
    appRefuses: nothing('unknown'),
    appRefusesWithOtherData: nothing('unknown'),
    handlerThrowsOrRejects: nothing('unknown'),
    serverEndsRequest: s('unknown', ['6-2']),
    signalingClosesWhilePending: notPending,
    serverNamesNewPeer: learnsFromRoster,
    serverNamesSamePeer: learnsFromRoster,
    incomingFromNamedPeer: noConnection,
    incomingFromOtherPeer: s('unknown', ['6-3'], ['closesIncoming']),
    firstVisibilityArrives: noConnection,
    laterVisibilityArrives: noConnection,
    openConnectionCloses: noConnection,
    attemptCloses: noConnection,
    lossPassesWaitingTime: notLost,
    leaveArrivesOverPeer: noConnection,
    serverReportsLeft: learnsFromRoster,
    rosterLeavesOut: s('unknown', ['6-9']),
    rosterIncludes: s('lostNew', ['6-9'], ['startsLoss']),
  },
  lostNew: {
    ...named('lostNew'),
    serverNamesNewPeer: s('lostNew', ['6-3', '6-4'], ['closesOtherPeerConnections']),
    serverNamesSamePeer: s('lostNew', ['6-3', '6-4']),
    incomingFromNamedPeer: s('lostNew', ['6-3'], ['keepsIncoming', 'closesOlderFromSamePeer']),
    firstVisibilityArrives: s('open', ['6-4', '6-5'], ['appToldJoined']),
    laterVisibilityArrives: opensFirst,
    openConnectionCloses: noConnection,
    attemptCloses: s('lostNew', ['6-4']),
    lossPassesWaitingTime: s('removed', ['6-7', '6-5'], ['closesConnections', 'tellsServerLeave']),
    leaveArrivesOverPeer: visibilityFirst,
    serverReportsLeft: s('removed', ['6-7', '6-5'], ['closesConnections']),
    rosterLeavesOut: s('removed', ['6-9', '6-7', '6-5'], ['closesConnections']),
    rosterIncludes: s('lostNew', ['6-9']),
  },
  open: {
    ...named('open'),
    serverNamesNewPeer: s('lostJoined', ['6-3', '6-4', '6-5'], ['closesOtherPeerConnections', 'appToldLost', 'startsLoss']),
    serverNamesSamePeer: s('open', ['6-3']),
    incomingFromNamedPeer: s('lostJoined', ['6-3', '6-4', '6-5'], ['keepsIncoming', 'closesOlderFromSamePeer', 'appToldLost', 'startsLoss']),
    firstVisibilityArrives: firstAlready,
    laterVisibilityArrives: s('open', ['6-5'], ['appToldVisibility']),
    openConnectionCloses: s('lostJoined', ['6-4', '6-5'], ['appToldLost', 'startsLoss']),
    attemptCloses: onlyTheOpenOne,
    lossPassesWaitingTime: notLost,
    leaveArrivesOverPeer: s('removed', ['6-7', '6-5'], ['closesConnections', 'appToldLeft', 'tellsServerLeave']),
    serverReportsLeft: s('removed', ['6-7', '6-5'], ['closesConnections', 'appToldLeft']),
    rosterLeavesOut: s('removed', ['6-9', '6-7', '6-5'], ['closesConnections', 'appToldLeft']),
    rosterIncludes: s('open', ['6-9']),
  },
  lostJoined: {
    ...named('lostJoined'),
    serverNamesNewPeer: s('lostJoined', ['6-3', '6-4'], ['closesOtherPeerConnections']),
    serverNamesSamePeer: s('lostJoined', ['6-3', '6-4']),
    incomingFromNamedPeer: s('lostJoined', ['6-3'], ['keepsIncoming', 'closesOlderFromSamePeer']),
    firstVisibilityArrives: s('open', ['6-4', '6-5'], ['appToldBack']),
    laterVisibilityArrives: opensFirst,
    openConnectionCloses: noConnection,
    attemptCloses: s('lostJoined', ['6-4']),
    lossPassesWaitingTime: s('removed', ['6-7', '6-5'], ['closesConnections', 'appToldLeft', 'tellsServerLeave']),
    leaveArrivesOverPeer: visibilityFirst,
    serverReportsLeft: s('removed', ['6-7', '6-5'], ['closesConnections', 'appToldLeft']),
    rosterLeavesOut: s('removed', ['6-9', '6-7', '6-5'], ['closesConnections', 'appToldLeft']),
    rosterIncludes: s('lostJoined', ['6-9']),
  },
  removed: {
    appLetsIn: nothing('removed'),
    appRefuses: nothing('removed'),
    appRefusesWithOtherData: nothing('removed'),
    handlerThrowsOrRejects: answered,
    serverEndsRequest: letInNotEnded,
    signalingClosesWhilePending: notPending,
    serverNamesNewPeer: s('removed', ['6-8'], ['closesConnections', 'tellsServerLeaveAgain']),
    serverNamesSamePeer: s('removed', ['6-8'], ['closesConnections', 'tellsServerLeaveAgain']),
    incomingFromNamedPeer: s('removed', ['6-8'], ['closesIncoming']),
    incomingFromOtherPeer: s('removed', ['6-3'], ['closesIncoming']),
    firstVisibilityArrives: closedByPage,
    laterVisibilityArrives: closedByPage,
    openConnectionCloses: closedByPage,
    attemptCloses: closedByPage,
    lossPassesWaitingTime: { impossible: 'a removed number is not lost' },
    leaveArrivesOverPeer: closedByPage,
    serverReportsLeft: s('removed', ['6-5']),
    rosterLeavesOut: s('removed', ['6-5']),
    rosterIncludes: s('removed', ['6-8'], ['closesConnections', 'tellsServerLeaveAgain']),
  },
}
