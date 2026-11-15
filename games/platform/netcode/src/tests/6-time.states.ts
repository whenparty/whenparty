type State =
  'hostRecovering' | 'hostCounting' | 'hostHeld' | 'participantNone' | 'participantCounting' | 'participantHeld' | 'participantStopped'

type Event =
  | 'clockAdvances'
  | 'clockJumpsBack'
  | 'clockReachesHeldTime'
  | 'clockJumpsForward'
  | 'fiveSecondsSinceWrite'
  | 'scriptsNotRunningNormally'
  | 'pageHidden'
  | 'recoveryEnds'
  | 'snapshotTaken'
  | 'hostAway'
  | 'hostBackWithEqualSnapshot'

type Outcome = {
  readonly next: State
  readonly roomTime:
    | 'grows with the clock'
    | 'stays'
    | 'jumps with the clock'
    | 'none'
    | "the larger of the record's and the snapshot's"
    | "the snapshot's"
    | 'goes on from where it stood'
  readonly writes?: 'now' | 'no later than 5 seconds is not promised'
}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

const participantOnly = {impossible: "the netcode tells this only to a participant's page"} as const
const hostOnly = {impossible: "only the host's page recovers"} as const
const notHeld = {impossible: 'the clock reaches a held time only after it jumped back'} as const
const hostGetsNoSnapshots = {impossible: "only participants' pages get snapshots from the host"} as const
const noHostAwayBeforeSnapshot = {impossible: 'the netcode tells no host away or host back before the first snapshot'} as const
const participantWritesNoTime = {impossible: "a participant's page writes no room time, so it sets no timer for it"} as const
const hostBackOnlyAfterAway = {impossible: 'the netcode tells host back only after host away'} as const

export const table: {readonly [S in State]: {readonly [E in Event]: Cell<Outcome>}} = {
  hostRecovering: {
    clockAdvances: {ids: ['6-3'], outcome: {next: 'hostRecovering', roomTime: 'none'}},
    clockJumpsBack: {ids: ['6-3'], outcome: {next: 'hostRecovering', roomTime: 'none'}},
    clockReachesHeldTime: {ids: ['6-3'], outcome: {next: 'hostRecovering', roomTime: 'none'}},
    clockJumpsForward: {ids: ['6-3'], outcome: {next: 'hostRecovering', roomTime: 'none'}},
    fiveSecondsSinceWrite: {ids: ['6-2', '6-3'], outcome: {next: 'hostRecovering', roomTime: 'none'}},
    scriptsNotRunningNormally: {ids: ['6-2', '6-3'], outcome: {next: 'hostRecovering', roomTime: 'none'}},
    pageHidden: {ids: ['6-2', '6-3'], outcome: {next: 'hostRecovering', roomTime: 'none'}},
    recoveryEnds: {ids: ['6-3'], outcome: {next: 'hostCounting', roomTime: "the larger of the record's and the snapshot's"}},
    snapshotTaken: hostGetsNoSnapshots,
    hostAway: participantOnly,
    hostBackWithEqualSnapshot: participantOnly
  },
  hostCounting: {
    clockAdvances: {ids: ['6-1'], outcome: {next: 'hostCounting', roomTime: 'grows with the clock'}},
    clockJumpsBack: {ids: ['6-1'], outcome: {next: 'hostHeld', roomTime: 'stays'}},
    clockReachesHeldTime: notHeld,
    clockJumpsForward: {ids: ['6-1'], outcome: {next: 'hostCounting', roomTime: 'jumps with the clock'}},
    fiveSecondsSinceWrite: {ids: ['6-2'], outcome: {next: 'hostCounting', roomTime: 'grows with the clock', writes: 'now'}},
    scriptsNotRunningNormally: {
      ids: ['6-2'],
      outcome: {next: 'hostCounting', roomTime: 'grows with the clock', writes: 'no later than 5 seconds is not promised'}
    },
    pageHidden: {ids: ['6-2'], outcome: {next: 'hostCounting', roomTime: 'grows with the clock', writes: 'now'}},
    recoveryEnds: hostOnly,
    snapshotTaken: hostGetsNoSnapshots,
    hostAway: participantOnly,
    hostBackWithEqualSnapshot: participantOnly
  },
  hostHeld: {
    clockAdvances: {ids: ['6-1'], outcome: {next: 'hostHeld', roomTime: 'stays'}},
    clockJumpsBack: {ids: ['6-1'], outcome: {next: 'hostHeld', roomTime: 'stays'}},
    clockReachesHeldTime: {ids: ['6-1'], outcome: {next: 'hostCounting', roomTime: 'grows with the clock'}},
    clockJumpsForward: {ids: ['6-1'], outcome: {next: 'hostCounting', roomTime: 'jumps with the clock'}},
    fiveSecondsSinceWrite: {ids: ['6-2'], outcome: {next: 'hostHeld', roomTime: 'stays', writes: 'now'}},
    scriptsNotRunningNormally: {
      ids: ['6-2'],
      outcome: {next: 'hostHeld', roomTime: 'stays', writes: 'no later than 5 seconds is not promised'}
    },
    pageHidden: {ids: ['6-2'], outcome: {next: 'hostHeld', roomTime: 'stays', writes: 'now'}},
    recoveryEnds: hostOnly,
    snapshotTaken: hostGetsNoSnapshots,
    hostAway: participantOnly,
    hostBackWithEqualSnapshot: participantOnly
  },
  participantNone: {
    clockAdvances: {ids: ['6-4'], outcome: {next: 'participantNone', roomTime: 'none'}},
    clockJumpsBack: {ids: ['6-4'], outcome: {next: 'participantNone', roomTime: 'none'}},
    clockReachesHeldTime: notHeld,
    clockJumpsForward: {ids: ['6-4'], outcome: {next: 'participantNone', roomTime: 'none'}},
    fiveSecondsSinceWrite: {ids: ['6-4'], outcome: {next: 'participantNone', roomTime: 'none'}},
    scriptsNotRunningNormally: participantWritesNoTime,
    pageHidden: {ids: ['6-4'], outcome: {next: 'participantNone', roomTime: 'none'}},
    recoveryEnds: hostOnly,
    snapshotTaken: {ids: ['6-4'], outcome: {next: 'participantCounting', roomTime: "the snapshot's"}},
    hostAway: noHostAwayBeforeSnapshot,
    hostBackWithEqualSnapshot: noHostAwayBeforeSnapshot
  },
  participantCounting: {
    clockAdvances: {ids: ['6-4', '6-1'], outcome: {next: 'participantCounting', roomTime: 'grows with the clock'}},
    clockJumpsBack: {ids: ['6-4', '6-1'], outcome: {next: 'participantHeld', roomTime: 'stays'}},
    clockReachesHeldTime: notHeld,
    clockJumpsForward: {ids: ['6-4', '6-1'], outcome: {next: 'participantCounting', roomTime: 'jumps with the clock'}},
    fiveSecondsSinceWrite: {ids: ['6-4'], outcome: {next: 'participantCounting', roomTime: 'grows with the clock'}},
    scriptsNotRunningNormally: participantWritesNoTime,
    pageHidden: {ids: ['6-4'], outcome: {next: 'participantCounting', roomTime: 'grows with the clock'}},
    recoveryEnds: hostOnly,
    snapshotTaken: {ids: ['6-4'], outcome: {next: 'participantCounting', roomTime: "the snapshot's"}},
    hostAway: {ids: ['6-4'], outcome: {next: 'participantStopped', roomTime: 'stays'}},
    hostBackWithEqualSnapshot: hostBackOnlyAfterAway
  },
  participantHeld: {
    clockAdvances: {ids: ['6-4', '6-1'], outcome: {next: 'participantHeld', roomTime: 'stays'}},
    clockJumpsBack: {ids: ['6-4', '6-1'], outcome: {next: 'participantHeld', roomTime: 'stays'}},
    clockReachesHeldTime: {ids: ['6-4', '6-1'], outcome: {next: 'participantCounting', roomTime: 'grows with the clock'}},
    clockJumpsForward: {ids: ['6-4', '6-1'], outcome: {next: 'participantCounting', roomTime: 'jumps with the clock'}},
    fiveSecondsSinceWrite: {ids: ['6-4'], outcome: {next: 'participantHeld', roomTime: 'stays'}},
    scriptsNotRunningNormally: participantWritesNoTime,
    pageHidden: {ids: ['6-4'], outcome: {next: 'participantHeld', roomTime: 'stays'}},
    recoveryEnds: hostOnly,
    snapshotTaken: {ids: ['6-4'], outcome: {next: 'participantCounting', roomTime: "the snapshot's"}},
    hostAway: {ids: ['6-4'], outcome: {next: 'participantStopped', roomTime: 'stays'}},
    hostBackWithEqualSnapshot: hostBackOnlyAfterAway
  },
  participantStopped: {
    clockAdvances: {ids: ['6-4'], outcome: {next: 'participantStopped', roomTime: 'stays'}},
    clockJumpsBack: {ids: ['6-4'], outcome: {next: 'participantStopped', roomTime: 'stays'}},
    clockReachesHeldTime: {ids: ['6-4'], outcome: {next: 'participantStopped', roomTime: 'stays'}},
    clockJumpsForward: {ids: ['6-4'], outcome: {next: 'participantStopped', roomTime: 'stays'}},
    fiveSecondsSinceWrite: {ids: ['6-4'], outcome: {next: 'participantStopped', roomTime: 'stays'}},
    scriptsNotRunningNormally: participantWritesNoTime,
    pageHidden: {ids: ['6-4'], outcome: {next: 'participantStopped', roomTime: 'stays'}},
    recoveryEnds: hostOnly,
    snapshotTaken: {ids: ['6-4'], outcome: {next: 'participantCounting', roomTime: "the snapshot's"}},
    hostAway: {impossible: 'the netcode tells host away again only after host back'},
    hostBackWithEqualSnapshot: {ids: ['6-4'], outcome: {next: 'participantCounting', roomTime: 'goes on from where it stood'}}
  }
}
