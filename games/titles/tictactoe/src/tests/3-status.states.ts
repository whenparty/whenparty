type RowState = 'none' | 'creating' | 'waitingDecides' | 'waitingOffline' | 'entering' | 'playing' | 'hostAway' | 'over'

type NoteState = 'noCause' | 'causeHolds'

type Event =
  | 'startPressed'
  | 'opensWithCode'
  | 'formCode'
  | 'addressOtherCode'
  | 'addressSameCode'
  | 'leavePressed'
  | 'addressNotCode'
  | 'copyPressed'
  | 'copyEnds'
  | 'copyLimitPasses'
  | 'cellClicked'
  | 'startNextPressed'
  | 'requestAnswered'
  | 'codeTold'
  | 'waitingDecidesTold'
  | 'waitingOfflineTold'
  | 'enteringTold'
  | 'snapshotTaken'
  | 'hostAwayTold'
  | 'hostBackTold'
  | 'serverLostTold'
  | 'serverBackTold'
  | 'rulesErrorTold'
  | 'canActTold'
  | 'moveRefused'
  | 'joinRequestTold'
  | 'requestEndedTold'
  | 'cannotStartTold'
  | 'failsOrEnds'

type Row =
  | 'Creating a room…'
  | 'Waiting for the host of CODE to let you in…'
  | 'Waiting for the host of CODE to come back…'
  | 'Looking for room CODE…'
  | 'The connection to the host is lost. The game goes on when it is back.'
  | 'the row of the last snapshot that the page took'
  | 'the text of 4-1'

type RowOutcome = {readonly next: RowState; readonly row: Row}

type NoteOutcome = {readonly next: NoteState}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly table: '2-page.states.ts'} | {readonly impossible: string}

const lobbyByPage = {table: '2-page.states.ts'} as const
const noGame = {impossible: 'no game goes on, so the netcode tells the page nothing'} as const
const noRoomView = {impossible: 'the lobby has no copy button, board, next-match button or requests (2-1)'} as const
const noLobbyControls = {impossible: 'the room view has no button that starts a game and no form (2-3)'} as const
const afterEnd = {
  impossible: 'after starting or entering failed or the game ended, the netcode tells the page nothing more (netcode 2-1, 2-7)'
} as const
const onlyWhenStarting = {impossible: 'the netcode tells the room code only to a page that starts a game, once (netcode 2-3)'} as const
const onlyFirstEntry = {
  impossible: 'the netcode tells that the page waits for the host only on a first entry, before the join completes (netcode 3-2, 3-3)'
} as const
const onlyEntering = {
  impossible: 'the netcode tells entering only when entering starts or waiting for the host ends (netcode 2-6, 3-2)'
} as const
const onlyHostPlaying = {
  impossible:
    "the netcode tells the lost server and its return only to the host's page after its first snapshot, which it makes while it reacts to the rooms event that completes starting or recovery (netcode 2-9, 4-4, 9-8, 10-3, 10-4)"
} as const
const onlyHostPage = {impossible: "the netcode tells rules errors only to the host's page (netcode 1-4)"} as const
const onlyAfterSnapshot = {
  impossible: "the netcode tells host away only to a participant's page that has taken a snapshot (netcode 3-3, 3-6, 3-7)"
} as const
const backOnlyAfterAway = {impossible: 'the netcode tells host back only after host away (netcode 3-6)'} as const
const noConnectionYet = {
  impossible:
    'no connection to the host is open before the join completes, and waiting for the host ends when the host lets the page in (netcode 3-2, 3-3)'
} as const
const askedFirst = {
  impossible:
    'the host lets a page in only after the page was asked about, which the netcode tells as waiting for a host who decides (netcode 3-2)'
} as const
const noRepeatWaiting = {impossible: 'the netcode tells waiting again only when whether the host decides changes (netcode 3-2)'} as const
const noRepeatHostAway = {impossible: 'the netcode tells host away again only after host back (netcode 3-6)'} as const
const noRuleBeforeFirstSnapshot = {
  impossible:
    'the first change of a page that started the game is its own arrival, while no match runs, and no rule that can fail with rules error runs in it (netcode 1-4, 4-4, 5-4, 5-6, 7-1, 7-2)'
} as const
const alreadyOpen = {impossible: 'the page opened already; a reload or a return from the back/forward cache opens a new page'} as const
const noNextMatchButton = {
  impossible: "the button that starts the next match shows only on the host's page after a match started (2-9)"
} as const
const noRequestShown = {impossible: 'the page shows a request only when the netcode told it of one (2-10)'} as const
const cannotActYet = {
  impossible:
    'the page cannot act before its first snapshot, so the netcode tells it neither that it can act nor of a refused move (netcode 8-1)'
} as const
const noRequestBeforeMatch = {
  impossible: "the netcode tells join requests and their end only to the host's page after a match started (netcode 4-2, 4-3)"
} as const
const noStartYet = {
  impossible:
    "the host's page starts a match only after it took a snapshot (2-9), so the netcode tells cannot start only after that (netcode 5-2)"
} as const
const hostPageOnly = {
  impossible:
    "the netcode tells join requests, their end and cannot start, and the page shows the next-match button and requests, only on the host's page, while host away comes only to a participant's page (2-9, 2-10, netcode 3-6, 4-3, 5-2)"
} as const
const goneAfterEnd = {
  impossible: 'after the end the room view shows neither the button of 2-9 nor requests (2-10)'
} as const
const noLobbyAddress = {impossible: 'the lobby has no game whose code the address could name'} as const

const staysIn = <S extends RowState, R extends Row>(next: S, row: R) => ({ids: ['3-1'], outcome: {next, row}}) as const
const toEntering = staysIn('entering', 'Looking for room CODE…')
const toOver = staysIn('over', 'the text of 4-1')
const rowOfSnapshot = staysIn('playing', 'the row of the last snapshot that the page took')

const roomControlsIn = <S extends RowState, R extends Row>(next: S, row: R) => {
  const stays = staysIn(next, row)
  return {
    addressSameCode: stays,
    copyPressed: stays,
    copyEnds: stays,
    copyLimitPasses: stays,
    cellClicked: stays
  } as const
}

const beforeFirstSnapshot = {
  startNextPressed: noNextMatchButton,
  requestAnswered: noRequestShown,
  canActTold: cannotActYet,
  moveRefused: cannotActYet,
  joinRequestTold: noRequestBeforeMatch,
  requestEndedTold: noRequestBeforeMatch,
  cannotStartTold: noStartYet
} as const

const inRoomView = {
  startPressed: noLobbyControls,
  opensWithCode: alreadyOpen,
  formCode: noLobbyControls,
  addressOtherCode: toEntering,
  leavePressed: lobbyByPage,
  addressNotCode: lobbyByPage
} as const

export const rows: {readonly [S in RowState]: {readonly [E in Event]: Cell<RowOutcome>}} = {
  none: {
    startPressed: staysIn('creating', 'Creating a room…'),
    opensWithCode: toEntering,
    formCode: toEntering,
    addressOtherCode: toEntering,
    addressSameCode: noLobbyAddress,
    leavePressed: noRoomView,
    addressNotCode: lobbyByPage,
    copyPressed: noRoomView,
    copyEnds: lobbyByPage,
    copyLimitPasses: lobbyByPage,
    cellClicked: noRoomView,
    startNextPressed: noRoomView,
    requestAnswered: noRoomView,
    codeTold: noGame,
    waitingDecidesTold: noGame,
    waitingOfflineTold: noGame,
    enteringTold: noGame,
    snapshotTaken: noGame,
    hostAwayTold: noGame,
    hostBackTold: noGame,
    serverLostTold: noGame,
    serverBackTold: noGame,
    rulesErrorTold: noGame,
    canActTold: noGame,
    moveRefused: noGame,
    joinRequestTold: noGame,
    requestEndedTold: noGame,
    cannotStartTold: noGame,
    failsOrEnds: noGame
  },
  creating: {
    ...inRoomView,
    ...roomControlsIn('creating', 'Creating a room…'),
    ...beforeFirstSnapshot,
    codeTold: staysIn('creating', 'Creating a room…'),
    waitingDecidesTold: onlyFirstEntry,
    waitingOfflineTold: onlyFirstEntry,
    enteringTold: onlyEntering,
    snapshotTaken: rowOfSnapshot,
    hostAwayTold: onlyAfterSnapshot,
    hostBackTold: backOnlyAfterAway,
    serverLostTold: onlyHostPlaying,
    serverBackTold: onlyHostPlaying,
    rulesErrorTold: noRuleBeforeFirstSnapshot,
    failsOrEnds: toOver
  },
  waitingDecides: {
    ...inRoomView,
    ...roomControlsIn('waitingDecides', 'Waiting for the host of CODE to let you in…'),
    ...beforeFirstSnapshot,
    codeTold: onlyWhenStarting,
    waitingDecidesTold: noRepeatWaiting,
    waitingOfflineTold: staysIn('waitingOffline', 'Waiting for the host of CODE to come back…'),
    enteringTold: toEntering,
    snapshotTaken: noConnectionYet,
    hostAwayTold: onlyAfterSnapshot,
    hostBackTold: backOnlyAfterAway,
    serverLostTold: onlyHostPlaying,
    serverBackTold: onlyHostPlaying,
    rulesErrorTold: onlyHostPage,
    failsOrEnds: toOver
  },
  waitingOffline: {
    ...inRoomView,
    ...roomControlsIn('waitingOffline', 'Waiting for the host of CODE to come back…'),
    ...beforeFirstSnapshot,
    codeTold: onlyWhenStarting,
    waitingDecidesTold: staysIn('waitingDecides', 'Waiting for the host of CODE to let you in…'),
    waitingOfflineTold: noRepeatWaiting,
    enteringTold: askedFirst,
    snapshotTaken: noConnectionYet,
    hostAwayTold: onlyAfterSnapshot,
    hostBackTold: backOnlyAfterAway,
    serverLostTold: onlyHostPlaying,
    serverBackTold: onlyHostPlaying,
    rulesErrorTold: onlyHostPage,
    failsOrEnds: toOver
  },
  entering: {
    ...inRoomView,
    ...roomControlsIn('entering', 'Looking for room CODE…'),
    ...beforeFirstSnapshot,
    codeTold: onlyWhenStarting,
    waitingDecidesTold: staysIn('waitingDecides', 'Waiting for the host of CODE to let you in…'),
    waitingOfflineTold: staysIn('waitingOffline', 'Waiting for the host of CODE to come back…'),
    enteringTold: toEntering,
    snapshotTaken: rowOfSnapshot,
    hostAwayTold: onlyAfterSnapshot,
    hostBackTold: backOnlyAfterAway,
    serverLostTold: onlyHostPlaying,
    serverBackTold: onlyHostPlaying,
    rulesErrorTold: toEntering,
    failsOrEnds: toOver
  },
  playing: {
    ...inRoomView,
    ...roomControlsIn('playing', 'the row of the last snapshot that the page took'),
    startNextPressed: rowOfSnapshot,
    requestAnswered: rowOfSnapshot,
    canActTold: rowOfSnapshot,
    moveRefused: rowOfSnapshot,
    joinRequestTold: rowOfSnapshot,
    requestEndedTold: rowOfSnapshot,
    cannotStartTold: rowOfSnapshot,
    codeTold: onlyWhenStarting,
    waitingDecidesTold: onlyFirstEntry,
    waitingOfflineTold: onlyFirstEntry,
    enteringTold: onlyEntering,
    snapshotTaken: rowOfSnapshot,
    hostAwayTold: staysIn('hostAway', 'The connection to the host is lost. The game goes on when it is back.'),
    hostBackTold: backOnlyAfterAway,
    serverLostTold: rowOfSnapshot,
    serverBackTold: rowOfSnapshot,
    rulesErrorTold: rowOfSnapshot,
    failsOrEnds: toOver
  },
  hostAway: {
    ...inRoomView,
    ...roomControlsIn('hostAway', 'The connection to the host is lost. The game goes on when it is back.'),
    startNextPressed: hostPageOnly,
    requestAnswered: hostPageOnly,
    canActTold: staysIn('hostAway', 'The connection to the host is lost. The game goes on when it is back.'),
    moveRefused: staysIn('hostAway', 'The connection to the host is lost. The game goes on when it is back.'),
    joinRequestTold: hostPageOnly,
    requestEndedTold: hostPageOnly,
    cannotStartTold: hostPageOnly,
    codeTold: onlyWhenStarting,
    waitingDecidesTold: onlyFirstEntry,
    waitingOfflineTold: onlyFirstEntry,
    enteringTold: onlyEntering,
    snapshotTaken: staysIn('hostAway', 'The connection to the host is lost. The game goes on when it is back.'),
    hostAwayTold: noRepeatHostAway,
    hostBackTold: rowOfSnapshot,
    serverLostTold: onlyHostPlaying,
    serverBackTold: onlyHostPlaying,
    rulesErrorTold: onlyHostPage,
    failsOrEnds: toOver
  },
  over: {
    ...inRoomView,
    addressSameCode: toOver,
    copyPressed: toOver,
    copyEnds: toOver,
    copyLimitPasses: toOver,
    cellClicked: toOver,
    startNextPressed: goneAfterEnd,
    requestAnswered: goneAfterEnd,
    codeTold: afterEnd,
    waitingDecidesTold: afterEnd,
    waitingOfflineTold: afterEnd,
    enteringTold: afterEnd,
    snapshotTaken: afterEnd,
    hostAwayTold: afterEnd,
    hostBackTold: afterEnd,
    serverLostTold: afterEnd,
    serverBackTold: afterEnd,
    rulesErrorTold: afterEnd,
    canActTold: afterEnd,
    moveRefused: afterEnd,
    joinRequestTold: afterEnd,
    requestEndedTold: afterEnd,
    cannotStartTold: afterEnd,
    failsOrEnds: afterEnd
  }
}

const noCause = {ids: ['3-1'], outcome: {next: 'noCause'}} as const
const causeHolds = {ids: ['3-1'], outcome: {next: 'causeHolds'}} as const
const causeAfterCode = {
  impossible:
    "the netcode tells the room code once, when starting completes, and a cause of a note only after it: the lost server while the host's page plays, and a rules error in a change (netcode 1-4, 2-1, 2-3, 2-9, 9-4)"
} as const
const causeAfterEntering = {
  impossible:
    "the netcode tells entering only when entering starts or waiting for the host ends (netcode 2-6, 3-2), before the host's page makes any change or plays, so before it tells the cause of a note (netcode 1-4, 2-9)"
} as const
const causeOnHostOnly = {
  impossible:
    "the netcode tells the causes of the notes only to the host's page (netcode 1-4, 2-9), and waiting for the host, host away and host back only to a participant's page (netcode 3-2, 3-6)"
} as const

const whileNoCause = {
  startPressed: noCause,
  opensWithCode: noCause,
  formCode: noCause,
  addressOtherCode: noCause,
  addressSameCode: noCause,
  leavePressed: noCause,
  addressNotCode: noCause,
  copyPressed: noCause,
  copyEnds: noCause,
  copyLimitPasses: noCause,
  cellClicked: noCause,
  startNextPressed: noCause,
  requestAnswered: noCause,
  codeTold: noCause,
  waitingDecidesTold: noCause,
  waitingOfflineTold: noCause,
  enteringTold: noCause,
  snapshotTaken: noCause,
  hostAwayTold: noCause,
  hostBackTold: noCause,
  canActTold: noCause,
  moveRefused: noCause,
  joinRequestTold: noCause,
  requestEndedTold: noCause,
  cannotStartTold: noCause,
  failsOrEnds: noCause
} as const

const whileCauseHolds = {
  startPressed: noLobbyControls,
  opensWithCode: alreadyOpen,
  formCode: noLobbyControls,
  addressOtherCode: noCause,
  addressSameCode: causeHolds,
  leavePressed: noCause,
  addressNotCode: noCause,
  copyPressed: causeHolds,
  copyEnds: causeHolds,
  copyLimitPasses: causeHolds,
  cellClicked: causeHolds,
  startNextPressed: causeHolds,
  requestAnswered: causeHolds,
  codeTold: causeAfterCode,
  waitingDecidesTold: causeOnHostOnly,
  waitingOfflineTold: causeOnHostOnly,
  enteringTold: causeAfterEntering,
  snapshotTaken: causeHolds,
  hostAwayTold: causeOnHostOnly,
  hostBackTold: causeOnHostOnly,
  canActTold: causeHolds,
  moveRefused: causeHolds,
  joinRequestTold: causeHolds,
  requestEndedTold: causeHolds,
  cannotStartTold: causeHolds,
  failsOrEnds: noCause
} as const

export const serverLostNote: {readonly [S in NoteState]: {readonly [E in Event]: Cell<NoteOutcome>}} = {
  noCause: {
    ...whileNoCause,
    serverLostTold: causeHolds,
    serverBackTold: {
      impossible: 'the netcode tells that the server is back only after it told that the server is lost (netcode 2-9, rooms 4-4, 4-5)'
    },
    rulesErrorTold: noCause
  },
  causeHolds: {
    ...whileCauseHolds,
    serverLostTold: {
      impossible: 'the netcode tells that the server is lost again only after it told that it is back (netcode 2-9, rooms 4-4, 4-5)'
    },
    serverBackTold: noCause,
    rulesErrorTold: causeHolds
  }
}

export const rulesErrorNote: {readonly [S in NoteState]: {readonly [E in Event]: Cell<NoteOutcome>}} = {
  noCause: {
    ...whileNoCause,
    serverLostTold: noCause,
    serverBackTold: noCause,
    rulesErrorTold: causeHolds
  },
  causeHolds: {
    ...whileCauseHolds,
    serverLostTold: causeHolds,
    serverBackTold: causeHolds,
    rulesErrorTold: causeHolds
  }
}
