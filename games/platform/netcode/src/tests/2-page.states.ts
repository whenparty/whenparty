type State = 'none' | 'starting' | 'recovering' | 'hosting' | 'joining' | 'waiting' | 'joined' | 'returning' | 'playing' | 'hostAway'

type Event =
  | 'start'
  | 'enterNew'
  | 'enterRecordParticipant'
  | 'enterRecordHost'
  | 'badRules'
  | 'leave'
  | 'openElsewhere'
  | 'roomCreated'
  | 'roomsFails'
  | 'roomEnds'
  | 'serverLost'
  | 'serverBack'

type Told = 'entering' | 'code' | 'failed' | 'ended' | 'server lost' | 'server back'

type Cause = 'open elsewhere' | 'bad rules' | 'the rooms cause' | 'the cause that the table of 2-13 gives'

type Outcome = {
  readonly next: State
  readonly told: readonly Told[]
  readonly cause?: Cause
  readonly olderSide?: true
  readonly leavesLastGameFirst?: true
  readonly leavesRoom?: true
  readonly roomClosesForAll?: true
}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

const noGame = {impossible: 'no game goes on, so the rooms module tells the page nothing'} as const
const notCreating = {impossible: 'the rooms module tells this only to a page that creates a room'} as const
const ownerOnly = {impossible: "the rooms module tells this only to an owner's page that has the room"} as const
const lockHeld = {impossible: 'the rooms module answers open elsewhere only before it creates, joins or returns'} as const
const noFailureAfterJoin = {
  impossible:
    'after the join completes, or on a return, the rooms module repeats, ends the room or enters the page as new, and fails nothing'
} as const
const failsInstead = {impossible: 'before the join completes, the rooms module fails the join instead of ending the room'} as const
const notCreatedYet = {impossible: 'a room ends only after the rooms module created it'} as const

const asParticipantGameGoesOn = {
  start: {ids: ['2-12', '2-3'], outcome: {next: 'starting', told: [], leavesLastGameFirst: true}},
  enterNew: {ids: ['2-12', '2-5', '2-6'], outcome: {next: 'joining', told: ['entering'], leavesLastGameFirst: true}},
  enterRecordParticipant: {ids: ['2-12', '2-5', '2-6'], outcome: {next: 'returning', told: ['entering'], leavesLastGameFirst: true}},
  enterRecordHost: {ids: ['2-12', '2-5', '2-6'], outcome: {next: 'recovering', told: ['entering'], leavesLastGameFirst: true}},
  badRules: {ids: ['2-12', '2-3', '2-5'], outcome: {next: 'none', told: ['failed'], cause: 'bad rules', leavesLastGameFirst: true}},
  leave: {ids: ['2-11'], outcome: {next: 'none', told: [], leavesRoom: true}}
} as const

const asHostGameGoesOn = {
  start: {ids: ['2-12', '2-11', '2-3'], outcome: {next: 'starting', told: [], leavesLastGameFirst: true, roomClosesForAll: true}},
  enterNew: {
    ids: ['2-12', '2-11', '2-5', '2-6'],
    outcome: {next: 'joining', told: ['entering'], leavesLastGameFirst: true, roomClosesForAll: true}
  },
  enterRecordParticipant: {
    ids: ['2-12', '2-11', '2-5', '2-6'],
    outcome: {next: 'returning', told: ['entering'], leavesLastGameFirst: true, roomClosesForAll: true}
  },
  enterRecordHost: {
    ids: ['2-12', '2-11', '2-5', '2-6'],
    outcome: {next: 'recovering', told: ['entering'], leavesLastGameFirst: true, roomClosesForAll: true}
  },
  badRules: {
    ids: ['2-12', '2-11', '2-3', '2-5'],
    outcome: {next: 'none', told: ['failed'], cause: 'bad rules', leavesLastGameFirst: true, roomClosesForAll: true}
  },
  leave: {ids: ['2-11'], outcome: {next: 'none', told: [], leavesRoom: true, roomClosesForAll: true}}
} as const

export const table: {readonly [S in State]: {readonly [E in Event]: Cell<Outcome>}} = {
  none: {
    start: {ids: ['2-3', '2-1'], outcome: {next: 'starting', told: []}},
    enterNew: {ids: ['2-5', '2-6', '2-1'], outcome: {next: 'joining', told: ['entering']}},
    enterRecordParticipant: {ids: ['2-5', '2-6', '2-1'], outcome: {next: 'returning', told: ['entering']}},
    enterRecordHost: {ids: ['2-5', '2-6', '2-1'], outcome: {next: 'recovering', told: ['entering']}},
    badRules: {ids: ['2-3', '2-5'], outcome: {next: 'none', told: ['failed'], cause: 'bad rules'}},
    leave: {ids: ['2-1', '2-11'], outcome: {next: 'none', told: []}},
    openElsewhere: noGame,
    roomCreated: noGame,
    roomsFails: noGame,
    roomEnds: noGame,
    serverLost: noGame,
    serverBack: noGame
  },
  starting: {
    start: {ids: ['2-12', '2-3'], outcome: {next: 'starting', told: [], leavesLastGameFirst: true}},
    enterNew: {ids: ['2-12', '2-5', '2-6'], outcome: {next: 'joining', told: ['entering'], leavesLastGameFirst: true}},
    enterRecordParticipant: {ids: ['2-12', '2-5', '2-6'], outcome: {next: 'returning', told: ['entering'], leavesLastGameFirst: true}},
    enterRecordHost: {ids: ['2-12', '2-5', '2-6'], outcome: {next: 'recovering', told: ['entering'], leavesLastGameFirst: true}},
    badRules: {ids: ['2-12', '2-3', '2-5'], outcome: {next: 'none', told: ['failed'], cause: 'bad rules', leavesLastGameFirst: true}},
    leave: {ids: ['2-11'], outcome: {next: 'none', told: [], leavesRoom: true}},
    openElsewhere: {ids: ['2-2', '2-1'], outcome: {next: 'none', told: ['failed'], cause: 'open elsewhere'}},
    roomCreated: {ids: ['2-3', '2-1'], outcome: {next: 'hosting', told: ['code']}},
    roomsFails: {ids: ['2-3', '2-8', '2-1'], outcome: {next: 'none', told: ['failed'], cause: 'the rooms cause', olderSide: true}},
    roomEnds: notCreatedYet,
    serverLost: ownerOnly,
    serverBack: ownerOnly
  },
  recovering: {
    ...asHostGameGoesOn,
    openElsewhere: {ids: ['2-2', '2-1'], outcome: {next: 'none', told: ['failed'], cause: 'open elsewhere'}},
    roomCreated: notCreating,
    roomsFails: {impossible: "when an owner's return does not succeed, the rooms module repeats it or ends the room"},
    roomEnds: {ids: ['2-7', '2-8', '2-1'], outcome: {next: 'none', told: ['ended'], cause: 'the rooms cause', olderSide: true}},
    serverLost: {
      impossible: "the rooms module tells this only to an owner's page that has the room; a returning owner's page repeats its return"
    },
    serverBack: {
      impossible: "the rooms module tells this only to an owner's page that has the room; a returning owner's page repeats its return"
    }
  },
  hosting: {
    ...asHostGameGoesOn,
    openElsewhere: lockHeld,
    roomCreated: notCreating,
    roomsFails: {impossible: 'the rooms module fails only creating, joining or returning, and the room is created'},
    roomEnds: {ids: ['2-7', '2-8', '2-1'], outcome: {next: 'none', told: ['ended'], cause: 'the rooms cause', olderSide: true}},
    serverLost: {ids: ['2-9'], outcome: {next: 'hosting', told: ['server lost']}},
    serverBack: {ids: ['2-9'], outcome: {next: 'hosting', told: ['server back']}}
  },
  joining: {
    ...asParticipantGameGoesOn,
    openElsewhere: {ids: ['2-2', '2-1'], outcome: {next: 'none', told: ['failed'], cause: 'open elsewhere'}},
    roomCreated: notCreating,
    roomsFails: {ids: ['2-13', '2-8', '2-1'], outcome: {next: 'none', told: ['failed'], cause: 'the rooms cause', olderSide: true}},
    roomEnds: failsInstead,
    serverLost: ownerOnly,
    serverBack: ownerOnly
  },
  waiting: {
    ...asParticipantGameGoesOn,
    openElsewhere: lockHeld,
    roomCreated: notCreating,
    roomsFails: {ids: ['2-13', '2-8', '2-1'], outcome: {next: 'none', told: ['failed'], cause: 'the rooms cause', olderSide: true}},
    roomEnds: failsInstead,
    serverLost: ownerOnly,
    serverBack: ownerOnly
  },
  joined: {
    ...asParticipantGameGoesOn,
    openElsewhere: lockHeld,
    roomCreated: notCreating,
    roomsFails: noFailureAfterJoin,
    roomEnds: {
      ids: ['2-13', '2-8', '2-1'],
      outcome: {next: 'none', told: ['failed'], cause: 'the cause that the table of 2-13 gives', olderSide: true}
    },
    serverLost: ownerOnly,
    serverBack: ownerOnly
  },
  returning: {
    ...asParticipantGameGoesOn,
    openElsewhere: {ids: ['2-2', '2-1'], outcome: {next: 'none', told: ['failed'], cause: 'open elsewhere'}},
    roomCreated: notCreating,
    roomsFails: noFailureAfterJoin,
    roomEnds: {ids: ['2-7', '2-8', '2-1'], outcome: {next: 'none', told: ['ended'], cause: 'the rooms cause', olderSide: true}},
    serverLost: ownerOnly,
    serverBack: ownerOnly
  },
  playing: {
    ...asParticipantGameGoesOn,
    openElsewhere: lockHeld,
    roomCreated: notCreating,
    roomsFails: noFailureAfterJoin,
    roomEnds: {ids: ['2-7', '2-8', '2-1'], outcome: {next: 'none', told: ['ended'], cause: 'the rooms cause', olderSide: true}},
    serverLost: ownerOnly,
    serverBack: ownerOnly
  },
  hostAway: {
    ...asParticipantGameGoesOn,
    openElsewhere: lockHeld,
    roomCreated: notCreating,
    roomsFails: noFailureAfterJoin,
    roomEnds: {ids: ['2-7', '2-8', '2-1'], outcome: {next: 'none', told: ['ended'], cause: 'the rooms cause', olderSide: true}},
    serverLost: ownerOnly,
    serverBack: ownerOnly
  }
}
