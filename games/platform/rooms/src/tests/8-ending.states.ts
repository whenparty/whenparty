type State = 'creating' | 'joiningWithoutToken' | 'participantEntering' | 'participantInRoom' | 'ownerWithToken' | 'done'

type Event = 'appLeaves' | 'failsWithReason' | 'roomEnds' | 'outdatedRefusal' | 'ownerSendsOutdated' | 'lateAnswerOrEvent'

type Effect =
  | 'withdrawsJoinRequestIfSignalingOpen'
  | 'tellsServerLeaveIfSignalingOpen'
  | 'tellsOwnerLeaveIfPeerConnectionOpen'
  | 'sendsRoomClosedToParticipants'
  | 'sendsOutdatedWithSideToParticipants'
  | 'appToldReasonOnce'
  | 'appToldOlderSide'
  | 'deletesRecord'
  | 'closesConnections'
  | 'letsLockGo'
  | 'ignoresIt'

type Outcome = {
  readonly next: State
  readonly reason?: 'outdated' | 'the reason of the failure or end'
  readonly effects: readonly Effect[]
}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

const nothingEnded = {impossible: 'nothing has ended, so no answer or event is late'} as const
const noRoomYet = {impossible: 'before the page is in a room, creating or joining fails instead'} as const
const roomEndsInstead = {impossible: 'a page in a room does not fail: the room ends for it'} as const
const participantOnly = {impossible: 'only a participant page in the room gets an end from the owner page'} as const
const noConnectionAfterEnd = {impossible: 'the page opens no connection after the end'} as const

const fails: Cell<Outcome> = {
  ids: ['8-4'],
  outcome: {next: 'done', reason: 'the reason of the failure or end', effects: ['appToldReasonOnce', 'closesConnections', 'letsLockGo']}
}
const ends: Cell<Outcome> = {
  ids: ['8-4'],
  outcome: {
    next: 'done',
    reason: 'the reason of the failure or end',
    effects: ['appToldReasonOnce', 'deletesRecord', 'closesConnections', 'letsLockGo']
  }
}
const outdatedFails: Cell<Outcome> = {
  ids: ['8-6', '8-4'],
  outcome: {next: 'done', reason: 'outdated', effects: ['appToldReasonOnce', 'appToldOlderSide', 'closesConnections', 'letsLockGo']}
}
const participantLeaves: Cell<Outcome> = {
  ids: ['8-1', '8-3'],
  outcome: {
    next: 'done',
    effects: ['tellsServerLeaveIfSignalingOpen', 'tellsOwnerLeaveIfPeerConnectionOpen', 'deletesRecord', 'closesConnections', 'letsLockGo']
  }
}

export const table: {readonly [S in State]: {readonly [E in Event]: Cell<Outcome>}} = {
  creating: {
    appLeaves: {ids: ['8-3'], outcome: {next: 'done', effects: ['closesConnections', 'letsLockGo']}},
    failsWithReason: fails,
    roomEnds: noRoomYet,
    outdatedRefusal: outdatedFails,
    ownerSendsOutdated: participantOnly,
    lateAnswerOrEvent: nothingEnded
  },
  joiningWithoutToken: {
    appLeaves: {ids: ['8-3'], outcome: {next: 'done', effects: ['withdrawsJoinRequestIfSignalingOpen', 'closesConnections', 'letsLockGo']}},
    failsWithReason: fails,
    roomEnds: noRoomYet,
    outdatedRefusal: outdatedFails,
    ownerSendsOutdated: participantOnly,
    lateAnswerOrEvent: nothingEnded
  },
  participantEntering: {
    appLeaves: participantLeaves,
    failsWithReason: fails,
    roomEnds: noRoomYet,
    outdatedRefusal: outdatedFails,
    ownerSendsOutdated: {impossible: 'the owner page sends an end only over a connection open for rooms, so the join has completed'},
    lateAnswerOrEvent: nothingEnded
  },
  participantInRoom: {
    appLeaves: participantLeaves,
    failsWithReason: roomEndsInstead,
    roomEnds: ends,
    outdatedRefusal: {
      ids: ['8-6', '8-4'],
      outcome: {
        next: 'done',
        reason: 'outdated',
        effects: ['appToldReasonOnce', 'appToldOlderSide', 'deletesRecord', 'closesConnections', 'letsLockGo']
      }
    },
    ownerSendsOutdated: {
      ids: ['8-6', '8-4'],
      outcome: {
        next: 'done',
        reason: 'outdated',
        effects: ['appToldReasonOnce', 'appToldOlderSide', 'deletesRecord', 'closesConnections', 'letsLockGo']
      }
    },
    lateAnswerOrEvent: nothingEnded
  },
  ownerWithToken: {
    appLeaves: {
      ids: ['8-2', '8-3'],
      outcome: {
        next: 'done',
        effects: ['tellsServerLeaveIfSignalingOpen', 'sendsRoomClosedToParticipants', 'deletesRecord', 'closesConnections', 'letsLockGo']
      }
    },
    failsWithReason: roomEndsInstead,
    roomEnds: ends,
    outdatedRefusal: {
      ids: ['8-6', '8-4'],
      outcome: {
        next: 'done',
        reason: 'outdated',
        effects: [
          'appToldReasonOnce',
          'appToldOlderSide',
          'sendsOutdatedWithSideToParticipants',
          'deletesRecord',
          'closesConnections',
          'letsLockGo'
        ]
      }
    },
    ownerSendsOutdated: participantOnly,
    lateAnswerOrEvent: nothingEnded
  },
  done: {
    appLeaves: {ids: ['8-5'], outcome: {next: 'done', effects: []}},
    failsWithReason: {ids: ['8-5'], outcome: {next: 'done', effects: ['ignoresIt']}},
    roomEnds: {ids: ['8-5'], outcome: {next: 'done', effects: ['ignoresIt']}},
    outdatedRefusal: noConnectionAfterEnd,
    ownerSendsOutdated: noConnectionAfterEnd,
    lateAnswerOrEvent: {ids: ['8-5'], outcome: {next: 'done', effects: ['ignoresIt']}}
  }
}
