type State = 'loading' | 'lobby' | 'starting' | 'entering' | 'hostRoom' | 'participantRoom' | 'roomOver' | 'startFailed'

type Event =
  | 'opensWithCode'
  | 'opensWithoutCode'
  | 'startPressed'
  | 'formCode'
  | 'formNotCode'
  | 'addressOtherCode'
  | 'addressSameCode'
  | 'addressNotCode'
  | 'leavePressed'
  | 'startingOrEnteringFails'
  | 'gameEnds'
  | 'codeTold'
  | 'copyPressed'
  | 'snapshotTaken'
  | 'snapshotWithOtherRole'
  | 'otherRoleFirstMatchReady'
  | 'otherRoleNextMatchReady'
  | 'otherRoleSeatFreeAfterWin'
  | 'otherRoleMatchWon'
  | 'cellClickMoves'
  | 'cellClickOther'
  | 'moveRefused'
  | 'firstMatchReady'
  | 'nextMatchReady'
  | 'seatFreedAfterWin'
  | 'startNextPressed'
  | 'cannotStart'
  | 'matchWon'
  | 'nextMatchStarts'
  | 'joinRequest'
  | 'requestAnswered'
  | 'requestEnded'

type Outcome = {
  readonly next: State
  readonly netcode?:
    | 'start a game'
    | 'enter the game of the code'
    | 'leave, then enter the game of the new code'
    | 'leave'
    | 'act'
    | 'start a match'
    | 'answer the request'
  readonly shows?: string
  readonly address?: "the code in the netcode's form, replacing the history entry" | 'no code'
}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

const notOpenYet = {impossible: 'the page has not opened yet'} as const
const alreadyOpen = {impossible: 'the page opened already; a reload or a return from the back/forward cache opens a new page'} as const
const noGame = {impossible: 'no game goes on, so the netcode tells the page nothing'} as const
const noRoomView = {impossible: 'the lobby has no leave button, copy button, board, next-match button or requests (2-1)'} as const
const noLobbyControls = {impossible: 'the room view has no button that starts a game and no form (2-3)'} as const
const afterEnd = {impossible: 'after starting or entering failed or the game ended, the netcode tells the page nothing more'} as const
const goneAfterEnd = {
  impossible: 'after the end the game no longer goes on, so the room view shows neither the button of 2-9 nor requests (2-10)'
} as const
const onlyToHost = {
  impossible: "the netcode tells this only to the host's page, and tells a page that returns by record as the host's a snapshot first"
} as const
const noRequestShown = {impossible: 'the page shows a request only when the netcode told it of one (2-10)'} as const
const keepsHost = {
  impossible:
    "a game keeps its host (netcode 4-7), so the netcode tells every snapshot of the host's page as the host's and every other one as not"
} as const
const noCode = {impossible: 'the page has no room code, so it shows no copy button (2-3) and no address names its game'} as const
const notPlaying = {impossible: 'the page plays only after starting completed with the room code (netcode 2-1 and 2-3)'} as const
const noSnapshotYet = {impossible: 'the page has taken no snapshot in the game, so nothing that one shows is there yet'} as const
const completed = {impossible: 'starting or entering completed, so it does not fail (netcode 2-1)'} as const
const onlyWhenStarting = {impossible: 'the netcode tells the room code only to a page that starts a game, once (netcode 2-3)'} as const
const cannotActYet = {impossible: 'the page cannot act, so it makes no move, before its first snapshot (netcode 8-1)'} as const

const loadingRow = {
  startPressed: notOpenYet,
  formCode: notOpenYet,
  formNotCode: notOpenYet,
  addressOtherCode: notOpenYet,
  addressSameCode: notOpenYet,
  addressNotCode: notOpenYet,
  leavePressed: notOpenYet,
  startingOrEnteringFails: notOpenYet,
  gameEnds: notOpenYet,
  codeTold: notOpenYet,
  copyPressed: notOpenYet,
  snapshotTaken: notOpenYet,
  snapshotWithOtherRole: notOpenYet,
  otherRoleFirstMatchReady: notOpenYet,
  otherRoleNextMatchReady: notOpenYet,
  otherRoleSeatFreeAfterWin: notOpenYet,
  otherRoleMatchWon: notOpenYet,
  cellClickMoves: notOpenYet,
  cellClickOther: notOpenYet,
  moveRefused: notOpenYet,
  firstMatchReady: notOpenYet,
  nextMatchReady: notOpenYet,
  seatFreedAfterWin: notOpenYet,
  startNextPressed: notOpenYet,
  cannotStart: notOpenYet,
  matchWon: notOpenYet,
  nextMatchStarts: notOpenYet,
  joinRequest: notOpenYet,
  requestAnswered: notOpenYet,
  requestEnded: notOpenYet
} as const

const toEntering = (ids: readonly string[], netcode: 'enter the game of the code' | 'leave, then enter the game of the new code') =>
  ({
    ids: [...ids, '2-13', '2-14'],
    outcome: {
      next: 'entering',
      netcode,
      shows: 'the room view with the new code and an empty board',
      address: "the code in the netcode's form, replacing the history entry"
    }
  }) as const

const endsWith = (next: 'roomOver' | 'startFailed') =>
  ({
    ids: ['2-11', '2-9', '2-10', '2-13'],
    outcome: {next, shows: 'the room view without "you host", the next-match button and requests'}
  }) as const

const playing = (state: 'hostRoom' | 'participantRoom') =>
  ({
    opensWithCode: alreadyOpen,
    opensWithoutCode: alreadyOpen,
    startPressed: noLobbyControls,
    formCode: noLobbyControls,
    formNotCode: noLobbyControls,
    addressOtherCode: toEntering(['2-5', '2-3'], 'leave, then enter the game of the new code'),
    addressSameCode: {ids: ['2-5', '2-14'], outcome: {next: state, address: "the code in the netcode's form, replacing the history entry"}},
    addressNotCode: {ids: ['2-5'], outcome: {next: 'lobby', netcode: 'leave', shows: 'the lobby'}},
    leavePressed: {ids: ['2-6'], outcome: {next: 'lobby', netcode: 'leave', shows: 'the lobby', address: 'no code'}},
    startingOrEnteringFails: completed,
    gameEnds: endsWith('roomOver'),
    copyPressed: {ids: ['2-3'], outcome: {next: state, shows: 'the invite link is being copied'}},
    snapshotTaken: {ids: ['2-3'], outcome: {next: state, shows: 'the board with the marks of that snapshot'}},
    snapshotWithOtherRole: keepsHost,
    otherRoleFirstMatchReady: keepsHost,
    otherRoleNextMatchReady: keepsHost,
    otherRoleSeatFreeAfterWin: keepsHost,
    otherRoleMatchWon: keepsHost,
    seatFreedAfterWin: {
      ids: ['2-9', '2-7'],
      outcome: {next: state, shows: 'the winning cells in their own colour, and no button that starts the next match'}
    },
    cellClickMoves: {ids: ['2-8'], outcome: {next: state, netcode: 'act'}},
    cellClickOther: {ids: ['2-8'], outcome: {next: state}},
    moveRefused: {ids: ['2-8'], outcome: {next: state}},
    matchWon: {ids: ['2-7'], outcome: {next: state, shows: 'the winning cells in their own colour'}}
  }) as const

export const table: {readonly [S in State]: {readonly [E in Event]: Cell<Outcome>}} = {
  loading: {
    opensWithCode: {
      ids: ['2-4', '2-3', '2-14'],
      outcome: {
        next: 'entering',
        netcode: 'enter the game of the code',
        shows: 'the room view with the code and an empty board',
        address: "the code in the netcode's form, replacing the history entry"
      }
    },
    opensWithoutCode: {ids: ['2-1'], outcome: {next: 'lobby', shows: 'the lobby'}},
    ...loadingRow
  },
  lobby: {
    opensWithCode: alreadyOpen,
    opensWithoutCode: alreadyOpen,
    startPressed: {
      ids: ['2-3', '2-13'],
      outcome: {next: 'starting', netcode: 'start a game', shows: 'the room view with "you host" and an empty board'}
    },
    formCode: {
      ids: ['2-2', '2-3', '2-14'],
      outcome: {
        next: 'entering',
        netcode: 'enter the game of the code',
        shows: 'the room view with the code and an empty board',
        address: "the code in the netcode's form, replacing the history entry"
      }
    },
    formNotCode: {ids: ['2-2'], outcome: {next: 'lobby', shows: 'That is not a room code. Codes have 5 characters, like K7MXQ.'}},
    addressOtherCode: toEntering(['2-5', '2-3'], 'enter the game of the code'),
    addressSameCode: {impossible: 'the lobby has no game whose code the address could name'},
    addressNotCode: {ids: ['2-5'], outcome: {next: 'lobby', shows: 'the lobby'}},
    leavePressed: noRoomView,
    startingOrEnteringFails: noGame,
    gameEnds: noGame,
    codeTold: noGame,
    copyPressed: noRoomView,
    snapshotTaken: noGame,
    snapshotWithOtherRole: noGame,
    otherRoleFirstMatchReady: noGame,
    otherRoleNextMatchReady: noGame,
    otherRoleSeatFreeAfterWin: noGame,
    otherRoleMatchWon: noGame,
    cellClickMoves: noRoomView,
    cellClickOther: noRoomView,
    moveRefused: noGame,
    firstMatchReady: noGame,
    nextMatchReady: noGame,
    seatFreedAfterWin: noGame,
    startNextPressed: noRoomView,
    cannotStart: noGame,
    matchWon: noGame,
    nextMatchStarts: noGame,
    joinRequest: noGame,
    requestAnswered: noRoomView,
    requestEnded: noGame
  },
  starting: {
    opensWithCode: alreadyOpen,
    opensWithoutCode: alreadyOpen,
    startPressed: noLobbyControls,
    formCode: noLobbyControls,
    formNotCode: noLobbyControls,
    addressOtherCode: toEntering(['2-5', '2-3'], 'leave, then enter the game of the new code'),
    addressSameCode: noCode,
    addressNotCode: {ids: ['2-5'], outcome: {next: 'lobby', netcode: 'leave', shows: 'the lobby'}},
    leavePressed: {ids: ['2-6'], outcome: {next: 'lobby', netcode: 'leave', shows: 'the lobby', address: 'no code'}},
    startingOrEnteringFails: endsWith('startFailed'),
    gameEnds: notPlaying,
    codeTold: {
      ids: ['2-3', '2-14'],
      outcome: {
        next: 'hostRoom',
        shows: 'the code and the copy button',
        address: "the code in the netcode's form, replacing the history entry"
      }
    },
    copyPressed: noCode,
    snapshotTaken: notPlaying,
    snapshotWithOtherRole: notPlaying,
    otherRoleFirstMatchReady: notPlaying,
    otherRoleNextMatchReady: notPlaying,
    otherRoleSeatFreeAfterWin: notPlaying,
    otherRoleMatchWon: notPlaying,
    cellClickMoves: notPlaying,
    cellClickOther: {ids: ['2-8'], outcome: {next: 'starting'}},
    moveRefused: notPlaying,
    firstMatchReady: notPlaying,
    nextMatchReady: notPlaying,
    seatFreedAfterWin: notPlaying,
    startNextPressed: noSnapshotYet,
    cannotStart: notPlaying,
    matchWon: notPlaying,
    nextMatchStarts: notPlaying,
    joinRequest: notPlaying,
    requestAnswered: noRequestShown,
    requestEnded: notPlaying
  },
  entering: {
    opensWithCode: alreadyOpen,
    opensWithoutCode: alreadyOpen,
    startPressed: noLobbyControls,
    formCode: noLobbyControls,
    formNotCode: noLobbyControls,
    addressOtherCode: toEntering(['2-5', '2-3'], 'leave, then enter the game of the new code'),
    addressSameCode: {
      ids: ['2-5', '2-14'],
      outcome: {next: 'entering', address: "the code in the netcode's form, replacing the history entry"}
    },
    addressNotCode: {ids: ['2-5'], outcome: {next: 'lobby', netcode: 'leave', shows: 'the lobby'}},
    leavePressed: {ids: ['2-6'], outcome: {next: 'lobby', netcode: 'leave', shows: 'the lobby', address: 'no code'}},
    startingOrEnteringFails: endsWith('roomOver'),
    gameEnds: endsWith('roomOver'),
    codeTold: onlyWhenStarting,
    copyPressed: {ids: ['2-3'], outcome: {next: 'entering', shows: 'the invite link is being copied'}},
    snapshotTaken: {ids: ['2-3'], outcome: {next: 'participantRoom', shows: 'the board with the marks of that snapshot'}},
    snapshotWithOtherRole: {
      ids: ['2-13', '2-3'],
      outcome: {next: 'hostRoom', shows: '"you host" and the board with the marks of that snapshot'}
    },
    otherRoleFirstMatchReady: {ids: ['2-13', '2-9'], outcome: {next: 'hostRoom', netcode: 'start a match', shows: '"you host"'}},
    otherRoleNextMatchReady: {
      ids: ['2-13', '2-9'],
      outcome: {next: 'hostRoom', shows: '"you host" and the button that starts the next match'}
    },
    otherRoleMatchWon: {
      ids: ['2-13', '2-7', '2-9'],
      outcome: {next: 'hostRoom', shows: '"you host", the winning cells in their own colour and the button that starts the next match'}
    },
    otherRoleSeatFreeAfterWin: {
      ids: ['2-13', '2-7', '2-9'],
      outcome: {next: 'hostRoom', shows: '"you host", the winning cells in their own colour and no button that starts the next match'}
    },
    seatFreedAfterWin: {
      ids: ['2-7', '2-9'],
      outcome: {next: 'participantRoom', shows: 'the winning cells in their own colour, and no button that starts the next match'}
    },
    cellClickMoves: cannotActYet,
    cellClickOther: {ids: ['2-8'], outcome: {next: 'entering'}},
    moveRefused: cannotActYet,
    firstMatchReady: {ids: ['2-9'], outcome: {next: 'participantRoom', shows: 'no button that starts the next match'}},
    nextMatchReady: {ids: ['2-9'], outcome: {next: 'participantRoom', shows: 'no button that starts the next match'}},
    startNextPressed: {impossible: "only the host's page shows the button that starts the next match (2-9)"},
    cannotStart: {impossible: 'the netcode tells "cannot start" only after the host\'s page started a match'},
    matchWon: {ids: ['2-7'], outcome: {next: 'participantRoom', shows: 'the winning cells in their own colour'}},
    nextMatchStarts: noSnapshotYet,
    joinRequest: onlyToHost,
    requestAnswered: noRequestShown,
    requestEnded: onlyToHost
  },
  hostRoom: {
    ...playing('hostRoom'),
    codeTold: onlyWhenStarting,
    firstMatchReady: {
      ids: ['2-9'],
      outcome: {next: 'hostRoom', netcode: 'start a match', shows: 'no button that starts the next match'}
    },
    nextMatchReady: {ids: ['2-9'], outcome: {next: 'hostRoom', shows: 'the button that starts the next match'}},
    matchWon: {
      ids: ['2-7', '2-9'],
      outcome: {next: 'hostRoom', shows: 'the winning cells in their own colour and the button that starts the next match'}
    },
    startNextPressed: {ids: ['2-9'], outcome: {next: 'hostRoom', netcode: 'start a match'}},
    cannotStart: {ids: ['2-9'], outcome: {next: 'hostRoom'}},
    nextMatchStarts: {
      ids: ['2-7', '2-9'],
      outcome: {next: 'hostRoom', shows: 'no cell in the winning colour, and no button that starts the next match'}
    },
    joinRequest: {ids: ['2-10'], outcome: {next: 'hostRoom', shows: 'A player wants to join., with Let in and Refuse'}},
    requestAnswered: {ids: ['2-10'], outcome: {next: 'hostRoom', netcode: 'answer the request', shows: 'the request no more'}},
    requestEnded: {ids: ['2-10'], outcome: {next: 'hostRoom', shows: 'the request no more'}}
  },
  participantRoom: {
    ...playing('participantRoom'),
    codeTold: onlyWhenStarting,
    firstMatchReady: {ids: ['2-9'], outcome: {next: 'participantRoom', shows: 'no button that starts the next match'}},
    nextMatchReady: {ids: ['2-9'], outcome: {next: 'participantRoom', shows: 'no button that starts the next match'}},
    startNextPressed: {impossible: "only the host's page shows the button that starts the next match (2-9)"},
    cannotStart: {
      impossible: 'the page starts no match (2-9), and the netcode tells "cannot start" only after the host\'s page started one'
    },
    nextMatchStarts: {ids: ['2-7'], outcome: {next: 'participantRoom', shows: 'no cell in the winning colour'}},
    joinRequest: onlyToHost,
    requestAnswered: noRequestShown,
    requestEnded: onlyToHost
  },
  roomOver: {
    opensWithCode: alreadyOpen,
    opensWithoutCode: alreadyOpen,
    startPressed: noLobbyControls,
    formCode: noLobbyControls,
    formNotCode: noLobbyControls,
    addressOtherCode: toEntering(['2-11', '2-5', '2-3'], 'enter the game of the code'),
    addressSameCode: {
      ids: ['2-11', '2-5', '2-14'],
      outcome: {next: 'roomOver', address: "the code in the netcode's form, replacing the history entry"}
    },
    addressNotCode: {ids: ['2-11', '2-5'], outcome: {next: 'lobby', shows: 'the lobby'}},
    leavePressed: {ids: ['2-11', '2-6'], outcome: {next: 'lobby', shows: 'the lobby', address: 'no code'}},
    startingOrEnteringFails: afterEnd,
    gameEnds: afterEnd,
    codeTold: afterEnd,
    copyPressed: {ids: ['2-11', '2-3'], outcome: {next: 'roomOver', shows: 'the invite link is being copied'}},
    snapshotTaken: afterEnd,
    snapshotWithOtherRole: afterEnd,
    otherRoleFirstMatchReady: afterEnd,
    otherRoleNextMatchReady: afterEnd,
    otherRoleSeatFreeAfterWin: afterEnd,
    otherRoleMatchWon: afterEnd,
    cellClickMoves: {impossible: 'a page cannot act after its game ended or failed'},
    cellClickOther: {ids: ['2-8'], outcome: {next: 'roomOver'}},
    moveRefused: afterEnd,
    firstMatchReady: afterEnd,
    nextMatchReady: afterEnd,
    seatFreedAfterWin: afterEnd,
    startNextPressed: goneAfterEnd,
    cannotStart: afterEnd,
    matchWon: afterEnd,
    nextMatchStarts: afterEnd,
    joinRequest: afterEnd,
    requestAnswered: goneAfterEnd,
    requestEnded: afterEnd
  },
  startFailed: {
    opensWithCode: alreadyOpen,
    opensWithoutCode: alreadyOpen,
    startPressed: noLobbyControls,
    formCode: noLobbyControls,
    formNotCode: noLobbyControls,
    addressOtherCode: toEntering(['2-11', '2-5', '2-3'], 'enter the game of the code'),
    addressSameCode: noCode,
    addressNotCode: {ids: ['2-11', '2-5'], outcome: {next: 'lobby', shows: 'the lobby'}},
    leavePressed: {ids: ['2-11', '2-6'], outcome: {next: 'lobby', shows: 'the lobby', address: 'no code'}},
    startingOrEnteringFails: afterEnd,
    gameEnds: afterEnd,
    codeTold: afterEnd,
    copyPressed: noCode,
    snapshotTaken: afterEnd,
    snapshotWithOtherRole: afterEnd,
    otherRoleFirstMatchReady: afterEnd,
    otherRoleNextMatchReady: afterEnd,
    otherRoleSeatFreeAfterWin: afterEnd,
    otherRoleMatchWon: afterEnd,
    cellClickMoves: {impossible: 'a page cannot act after starting failed'},
    cellClickOther: {ids: ['2-8'], outcome: {next: 'startFailed'}},
    moveRefused: afterEnd,
    firstMatchReady: afterEnd,
    nextMatchReady: afterEnd,
    seatFreedAfterWin: afterEnd,
    startNextPressed: goneAfterEnd,
    cannotStart: afterEnd,
    matchWon: afterEnd,
    nextMatchStarts: afterEnd,
    joinRequest: afterEnd,
    requestAnswered: goneAfterEnd,
    requestEnded: afterEnd
  }
}

type CopyState = 'copyInviteLink' | 'copied' | 'copyFailed'

type CopyEvent =
  'pressed' | 'copySucceeds' | 'copyRefused' | 'limitPasses' | 'pageRunsAgainAfterLimit' | 'snapshotTaken' | 'gameEnds' | 'otherGameOrLobby'

type CopyOutcome = {
  readonly next: CopyState
  readonly limit?: '2 seconds from this end'
}

const noLimit = {impossible: 'no copy ended in the last 2 seconds, so no limit runs (2-12)'} as const

const ends = {
  pressed: {ids: ['2-12'], outcome: {next: 'copyInviteLink'}},
  copySucceeds: {ids: ['2-12'], outcome: {next: 'copied', limit: '2 seconds from this end'}},
  copyRefused: {ids: ['2-12'], outcome: {next: 'copyFailed', limit: '2 seconds from this end'}},
  limitPasses: {ids: ['2-12'], outcome: {next: 'copyInviteLink'}},
  pageRunsAgainAfterLimit: {ids: ['2-12'], outcome: {next: 'copyInviteLink'}}
} as const

export const copyButton: {readonly [S in CopyState]: {readonly [E in CopyEvent]: Cell<CopyOutcome>}} = {
  copyInviteLink: {
    ...ends,
    limitPasses: noLimit,
    pageRunsAgainAfterLimit: noLimit,
    snapshotTaken: {ids: ['2-12'], outcome: {next: 'copyInviteLink'}},
    gameEnds: {ids: ['2-12'], outcome: {next: 'copyInviteLink'}},
    otherGameOrLobby: {ids: ['2-12'], outcome: {next: 'copyInviteLink'}}
  },
  copied: {
    ...ends,
    pressed: {ids: ['2-12'], outcome: {next: 'copied'}},
    snapshotTaken: {ids: ['2-12'], outcome: {next: 'copied'}},
    gameEnds: {ids: ['2-12'], outcome: {next: 'copied'}},
    otherGameOrLobby: {ids: ['2-12'], outcome: {next: 'copied'}}
  },
  copyFailed: {
    ...ends,
    pressed: {ids: ['2-12'], outcome: {next: 'copyFailed'}},
    snapshotTaken: {ids: ['2-12'], outcome: {next: 'copyFailed'}},
    gameEnds: {ids: ['2-12'], outcome: {next: 'copyFailed'}},
    otherGameOrLobby: {ids: ['2-12'], outcome: {next: 'copyFailed'}}
  }
}
