type State = 'none' | 'awaiting' | 'awaitingAway' | 'over' | 'host' | 'judgeRunning' | 'judgeIdle'

type PageEvent =
  | 'actCanAct'
  | 'actCanActWriteFails'
  | 'actCannotAct'
  | 'actNumberExhausted'
  | 'actNotAnAction'
  | 'actTooLarge'
  | 'snapshotCovering'
  | 'snapshotNotCovering'
  | 'snapshotEqual'
  | 'snapshotDropped'
  | 'refusalSameNumber'
  | 'refusalOtherNumber'
  | 'hostAway'
  | 'gameEnds'
  | 'leave'
  | 'pageReloads'

type HostEvent =
  | 'arrivesOldNumber'
  | 'arrivesFromSpectator'
  | 'arrivesOtherMatchId'
  | 'arrivesNotAnAction'
  | 'arrivesStepNull'
  | 'arrivesStepFails'
  | 'arrivesAccepted'
  | 'arrivesOtherText'

type Event = PageEvent | HostEvent

type Outcome = {
  readonly next: State
  readonly sends?:
    | 'the action with its number and match ID'
    | 'the action again with its first number and match ID'
    | 'nothing'
    | "that participant the host's last snapshot"
  readonly writesNumber?: true
  readonly answer?: 'cannot act' | 'not an action' | 'too large'
  readonly told?: readonly ('refused with the number' | 'can act changed')[]
  readonly judged?: 'accepted' | 'refused' | 'not judged' | 'dropped' | 'at once, as 8-5 and 8-6 say'
}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

const hostSide = {impossible: "only the host's page judges actions"} as const
const pageSide = {impossible: "this happens only on a participant's page"} as const
const awaits = {impossible: 'a page cannot act while an action awaits an answer (8-1)'} as const
const noneAwaits = {impossible: 'no action awaits, so nothing can cover it or answer it'} as const
const afterEnd = {impossible: 'after the game ends for the page, the netcode tells it nothing more (2-7, 2-11)'} as const
const answerAfterResend = {
  impossible:
    'the host answers an action it gets, and the page sends it again only when the return completes (8-7); texts of an older connection change nothing (rooms 3-10)'
} as const
const hostNoSnapshots = {impossible: "the host's page takes only snapshots that it makes, and is never told host away"} as const
const noStepWithoutMatch = {impossible: 'without a running match no match ID matches, so step is not called'} as const

const hostEventsImpossible = {
  arrivesOldNumber: hostSide,
  arrivesFromSpectator: hostSide,
  arrivesOtherMatchId: hostSide,
  arrivesNotAnAction: hostSide,
  arrivesStepNull: hostSide,
  arrivesStepFails: hostSide,
  arrivesAccepted: hostSide,
  arrivesOtherText: hostSide
} as const

const pageEventsImpossible = {
  actCanAct: pageSide,
  actCanActWriteFails: pageSide,
  actCannotAct: pageSide,
  actNumberExhausted: pageSide,
  actNotAnAction: pageSide,
  actTooLarge: pageSide,
  snapshotCovering: pageSide,
  snapshotNotCovering: pageSide,
  snapshotEqual: pageSide,
  snapshotDropped: pageSide,
  refusalSameNumber: pageSide,
  refusalOtherNumber: pageSide,
  hostAway: pageSide,
  gameEnds: pageSide,
  leave: pageSide,
  pageReloads: pageSide
} as const

const cannotActAnswers = {
  actCannotAct: {ids: ['8-2'], outcome: {next: 'awaiting', sends: 'nothing', answer: 'cannot act'}},
  actNumberExhausted: {ids: ['8-1', '8-2'], outcome: {next: 'awaiting', sends: 'nothing', answer: 'cannot act'}},
  actNotAnAction: {ids: ['8-2'], outcome: {next: 'awaiting', sends: 'nothing', answer: 'cannot act'}},
  actTooLarge: {ids: ['8-2'], outcome: {next: 'awaiting', sends: 'nothing', answer: 'cannot act'}}
} as const

export const table: {readonly [S in State]: {readonly [E in Event]: Cell<Outcome>}} = {
  none: {
    actCanAct: {
      ids: ['8-3', '8-4', '8-1'],
      outcome: {next: 'awaiting', sends: 'the action with its number and match ID', writesNumber: true, told: ['can act changed']}
    },
    actCanActWriteFails: {
      ids: ['8-3', '8-4', '8-1'],
      outcome: {next: 'awaiting', sends: 'the action with its number and match ID', told: ['can act changed']}
    },
    actCannotAct: {ids: ['8-2'], outcome: {next: 'none', sends: 'nothing', answer: 'cannot act'}},
    actNumberExhausted: {ids: ['8-1', '8-2'], outcome: {next: 'none', sends: 'nothing', answer: 'cannot act'}},
    actNotAnAction: {ids: ['8-2'], outcome: {next: 'none', sends: 'nothing', answer: 'not an action'}},
    actTooLarge: {ids: ['8-2'], outcome: {next: 'none', sends: 'nothing', answer: 'too large'}},
    snapshotCovering: noneAwaits,
    snapshotNotCovering: {ids: ['8-1'], outcome: {next: 'none', told: ['can act changed']}},
    snapshotEqual: {ids: ['8-7'], outcome: {next: 'none', sends: 'nothing'}},
    snapshotDropped: {ids: ['8-1'], outcome: {next: 'none'}},
    refusalSameNumber: noneAwaits,
    refusalOtherNumber: {ids: ['8-4'], outcome: {next: 'none'}},
    hostAway: {ids: ['8-1'], outcome: {next: 'none', told: ['can act changed']}},
    gameEnds: {ids: ['8-1'], outcome: {next: 'over'}},
    leave: {ids: ['8-1'], outcome: {next: 'over'}},
    pageReloads: {ids: ['8-3'], outcome: {next: 'none'}},
    ...hostEventsImpossible
  },
  awaiting: {
    actCanAct: awaits,
    actCanActWriteFails: awaits,
    ...cannotActAnswers,
    snapshotCovering: {ids: ['8-4', '8-1'], outcome: {next: 'none', told: ['can act changed']}},
    snapshotNotCovering: {ids: ['8-4'], outcome: {next: 'awaiting'}},
    snapshotEqual: {ids: ['8-4'], outcome: {next: 'awaiting'}},
    snapshotDropped: {ids: ['8-4'], outcome: {next: 'awaiting'}},
    refusalSameNumber: {ids: ['8-4', '8-5', '8-1'], outcome: {next: 'none', told: ['refused with the number', 'can act changed']}},
    refusalOtherNumber: {ids: ['8-4'], outcome: {next: 'awaiting'}},
    hostAway: {ids: ['8-1'], outcome: {next: 'awaitingAway'}},
    gameEnds: {ids: ['8-1'], outcome: {next: 'over'}},
    leave: {ids: ['8-1'], outcome: {next: 'over'}},
    pageReloads: {ids: ['8-3'], outcome: {next: 'none'}},
    ...hostEventsImpossible
  },
  awaitingAway: {
    actCanAct: awaits,
    actCanActWriteFails: awaits,
    actCannotAct: {ids: ['8-2'], outcome: {next: 'awaitingAway', sends: 'nothing', answer: 'cannot act'}},
    actNumberExhausted: {ids: ['8-1', '8-2'], outcome: {next: 'awaitingAway', sends: 'nothing', answer: 'cannot act'}},
    actNotAnAction: {ids: ['8-2'], outcome: {next: 'awaitingAway', sends: 'nothing', answer: 'cannot act'}},
    actTooLarge: {ids: ['8-2'], outcome: {next: 'awaitingAway', sends: 'nothing', answer: 'cannot act'}},
    snapshotCovering: {ids: ['8-4', '8-1'], outcome: {next: 'none', told: ['can act changed']}},
    snapshotNotCovering: {ids: ['8-7'], outcome: {next: 'awaiting', sends: 'the action again with its first number and match ID'}},
    snapshotEqual: {ids: ['8-7'], outcome: {next: 'awaiting', sends: 'the action again with its first number and match ID'}},
    snapshotDropped: {ids: ['8-4'], outcome: {next: 'awaitingAway'}},
    refusalSameNumber: answerAfterResend,
    refusalOtherNumber: answerAfterResend,
    hostAway: {ids: ['8-1'], outcome: {next: 'awaitingAway'}},
    gameEnds: {ids: ['8-1'], outcome: {next: 'over'}},
    leave: {ids: ['8-1'], outcome: {next: 'over'}},
    pageReloads: {ids: ['8-3'], outcome: {next: 'none'}},
    ...hostEventsImpossible
  },
  over: {
    actCanAct: {impossible: 'a page cannot act after its game ended (8-1)'},
    actCanActWriteFails: {impossible: 'a page cannot act after its game ended (8-1)'},
    actCannotAct: {ids: ['8-2'], outcome: {next: 'over', sends: 'nothing', answer: 'cannot act'}},
    actNumberExhausted: {ids: ['8-2'], outcome: {next: 'over', sends: 'nothing', answer: 'cannot act'}},
    actNotAnAction: {ids: ['8-2'], outcome: {next: 'over', sends: 'nothing', answer: 'cannot act'}},
    actTooLarge: {ids: ['8-2'], outcome: {next: 'over', sends: 'nothing', answer: 'cannot act'}},
    snapshotCovering: afterEnd,
    snapshotNotCovering: afterEnd,
    snapshotEqual: afterEnd,
    snapshotDropped: afterEnd,
    refusalSameNumber: afterEnd,
    refusalOtherNumber: afterEnd,
    hostAway: afterEnd,
    gameEnds: {impossible: 'the netcode tells the end of a game once (2-7)'},
    leave: {impossible: 'after the game ends the person cannot leave it (2-1)'},
    pageReloads: {impossible: 'the game no longer goes on, so a new page does not return to it'},
    ...hostEventsImpossible
  },
  host: {
    actCanAct: {ids: ['8-3'], outcome: {next: 'host', sends: 'nothing', judged: 'at once, as 8-5 and 8-6 say'}},
    actCanActWriteFails: {impossible: "the host's page writes no action number (8-3)"},
    actCannotAct: {ids: ['8-2'], outcome: {next: 'host', sends: 'nothing', answer: 'cannot act'}},
    actNumberExhausted: {ids: ['8-1', '8-2'], outcome: {next: 'host', sends: 'nothing', answer: 'cannot act'}},
    actNotAnAction: {ids: ['8-2'], outcome: {next: 'host', sends: 'nothing', answer: 'not an action'}},
    actTooLarge: {ids: ['8-2'], outcome: {next: 'host', sends: 'nothing', answer: 'too large'}},
    snapshotCovering: hostNoSnapshots,
    snapshotNotCovering: hostNoSnapshots,
    snapshotEqual: hostNoSnapshots,
    snapshotDropped: hostNoSnapshots,
    refusalSameNumber: {ids: ['8-5'], outcome: {next: 'host', told: ['refused with the number']}},
    refusalOtherNumber: {impossible: 'the host refuses its own action only when it judges it'},
    hostAway: hostNoSnapshots,
    gameEnds: {ids: ['8-1'], outcome: {next: 'over'}},
    leave: {ids: ['8-1'], outcome: {next: 'over'}},
    pageReloads: {ids: ['8-3'], outcome: {next: 'host'}},
    ...hostEventsImpossible
  },
  judgeRunning: {
    ...pageEventsImpossible,
    arrivesOldNumber: {
      ids: ['8-6'],
      outcome: {next: 'judgeRunning', sends: "that participant the host's last snapshot", judged: 'not judged'}
    },
    arrivesFromSpectator: {ids: ['8-5'], outcome: {next: 'judgeRunning', told: ['refused with the number'], judged: 'refused'}},
    arrivesOtherMatchId: {ids: ['8-5'], outcome: {next: 'judgeRunning', told: ['refused with the number'], judged: 'refused'}},
    arrivesNotAnAction: {ids: ['8-5'], outcome: {next: 'judgeRunning', told: ['refused with the number'], judged: 'refused'}},
    arrivesStepNull: {ids: ['8-5'], outcome: {next: 'judgeRunning', told: ['refused with the number'], judged: 'refused'}},
    arrivesStepFails: {ids: ['8-5'], outcome: {next: 'judgeRunning', told: ['refused with the number'], judged: 'refused'}},
    arrivesAccepted: {ids: ['8-5'], outcome: {next: 'judgeRunning', judged: 'accepted'}},
    arrivesOtherText: {ids: ['8-8'], outcome: {next: 'judgeRunning', judged: 'dropped'}}
  },
  judgeIdle: {
    ...pageEventsImpossible,
    arrivesOldNumber: {
      ids: ['8-6'],
      outcome: {next: 'judgeIdle', sends: "that participant the host's last snapshot", judged: 'not judged'}
    },
    arrivesFromSpectator: {ids: ['8-5'], outcome: {next: 'judgeIdle', told: ['refused with the number'], judged: 'refused'}},
    arrivesOtherMatchId: {ids: ['8-5'], outcome: {next: 'judgeIdle', told: ['refused with the number'], judged: 'refused'}},
    arrivesNotAnAction: {ids: ['8-5'], outcome: {next: 'judgeIdle', told: ['refused with the number'], judged: 'refused'}},
    arrivesStepNull: noStepWithoutMatch,
    arrivesStepFails: noStepWithoutMatch,
    arrivesAccepted: noStepWithoutMatch,
    arrivesOtherText: {ids: ['8-8'], outcome: {next: 'judgeIdle', judged: 'dropped'}}
  }
}
