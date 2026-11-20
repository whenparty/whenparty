type State = 'none' | 'running' | 'lobby' | 'lobbyRunning'

type Event =
  | 'startAllowed'
  | 'startPresenceFails'
  | 'startRefused'
  | 'startInitialFails'
  | 'startOnOtherPage'
  | 'playerEvent'
  | 'playerEventPresenceFails'
  | 'recoveryLostOrVisibilityFails'
  | 'recoveryLeftFails'
  | 'spectatorEvent'
  | 'playerEventNoPresenceTitle'
  | 'playerLeaves'
  | 'playerLeavesNoPresenceTitle'
  | 'playerLeavesPresenceFails'
  | 'spectatorLeaves'
  | 'otherChange'
  | 'overYes'
  | 'seatTaken'
  | 'startingCompletes'
  | 'overYesSpectatorWaits'

type Outcome = {
  readonly next: State
  readonly change?: 'none' | 'its own' | 'goes on'
  readonly matchNumber?: 'grows by 1'
  readonly calls: readonly string[]
  readonly told?: 'cannot start'
  readonly state?:
    'from the last call' | 'as before the failed call' | 'unchanged' | 'the lobby state, then from the last call' | 'the lobby state'
  readonly seats?: 'the spectator takes the free seat'
}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

const lobbyHasPresence = {impossible: 'a title that gives lobby gives presence (1-6)'} as const
const noSeatInMatch = {
  impossible: 'while a match runs, no participant takes a seat (4-4, 4-5); the change in which a match ends is overYesSpectatorWaits'
} as const
const startsBeforeMatches = {impossible: 'starting completes before any match runs'} as const
const overOnlyInMatch = {impossible: 'the netcode calls over only while a match runs (5-4)'} as const
const lobbyCalls = ['presence lost for each lost player, by seat', 'presence hidden for each hidden player, by seat'] as const

export const table: {readonly [S in State]: {readonly [E in Event]: Cell<Outcome>}} = {
  none: {
    startAllowed: {
      ids: ['5-2', '5-3', '5-4', '5-1'],
      outcome: {
        next: 'running',
        change: 'its own',
        matchNumber: 'grows by 1',
        calls: ['initial state', 'presence lost for each lost player, by seat', 'presence hidden for each hidden player, by seat', 'over'],
        state: 'from the last call'
      }
    },
    startPresenceFails: {
      ids: ['5-8', '5-2', '5-1'],
      outcome: {
        next: 'running',
        change: 'goes on',
        matchNumber: 'grows by 1',
        calls: ['initial state', 'presence, which fails', 'the remaining calls of 5-3', 'over'],
        state: 'as before the failed call'
      }
    },
    startRefused: {ids: ['5-2'], outcome: {next: 'none', change: 'none', calls: [], told: 'cannot start'}},
    startInitialFails: {ids: ['5-2'], outcome: {next: 'none', change: 'none', calls: ['initial state'], told: 'cannot start'}},
    startOnOtherPage: {ids: ['5-2'], outcome: {next: 'none', change: 'none', calls: []}},
    playerEvent: {ids: ['5-6'], outcome: {next: 'none', change: 'none', calls: []}},
    playerEventPresenceFails: {impossible: 'while no match runs, the netcode calls no presence (5-6)'},
    recoveryLostOrVisibilityFails: {impossible: 'the end of recovery calls presence only while a match runs'},
    spectatorEvent: {ids: ['5-6'], outcome: {next: 'none', change: 'none', calls: []}},
    playerEventNoPresenceTitle: {ids: ['5-6'], outcome: {next: 'none', change: 'none', calls: []}},
    playerLeaves: {ids: ['5-6'], outcome: {next: 'none', calls: []}},
    playerLeavesNoPresenceTitle: {ids: ['5-6'], outcome: {next: 'none', calls: []}},
    playerLeavesPresenceFails: {impossible: 'while no match runs, the netcode calls no presence (5-6)'},
    spectatorLeaves: {ids: ['5-6'], outcome: {next: 'none', calls: []}},
    otherChange: {ids: ['5-4'], outcome: {next: 'none', calls: []}},
    overYes: {impossible: 'the netcode calls over only while a match runs (5-4)'},
    seatTaken: {ids: ['5-6'], outcome: {next: 'none', calls: []}},
    startingCompletes: {ids: ['5-11'], outcome: {next: 'none', change: 'its own', calls: []}},
    overYesSpectatorWaits: overOnlyInMatch,
    recoveryLeftFails: {impossible: 'while no match runs, a title without lobby gets no presence at the end of recovery (10-3)'}
  },
  running: {
    startAllowed: {ids: ['5-2'], outcome: {next: 'running', change: 'none', calls: [], told: 'cannot start'}},
    startPresenceFails: {ids: ['5-2'], outcome: {next: 'running', change: 'none', calls: [], told: 'cannot start'}},
    startRefused: {ids: ['5-2'], outcome: {next: 'running', change: 'none', calls: [], told: 'cannot start'}},
    startInitialFails: {ids: ['5-2'], outcome: {next: 'running', change: 'none', calls: [], told: 'cannot start'}},
    startOnOtherPage: {ids: ['5-2'], outcome: {next: 'running', change: 'none', calls: []}},
    playerEvent: {
      ids: ['5-6', '5-4'],
      outcome: {next: 'running', change: 'its own', calls: ['presence', 'over'], state: 'from the last call'}
    },
    playerEventPresenceFails: {
      ids: ['5-8'],
      outcome: {next: 'running', change: 'none', calls: ['presence, which fails'], state: 'unchanged'}
    },
    recoveryLostOrVisibilityFails: {
      ids: ['5-8'],
      outcome: {
        next: 'running',
        change: 'goes on',
        calls: ['presence, which fails', 'the remaining calls of the end of recovery'],
        state: 'as before the failed call'
      }
    },
    spectatorEvent: {ids: ['5-6'], outcome: {next: 'running', change: 'none', calls: []}},
    playerEventNoPresenceTitle: {ids: ['5-6'], outcome: {next: 'running', change: 'none', calls: []}},
    playerLeaves: {
      ids: ['5-7', '5-4'],
      outcome: {next: 'running', change: 'its own', calls: ['presence left', 'over'], state: 'from the last call'}
    },
    playerLeavesNoPresenceTitle: {ids: ['5-7', '5-1'], outcome: {next: 'none', change: 'its own', calls: [], state: 'unchanged'}},
    playerLeavesPresenceFails: {
      ids: ['5-7', '5-1'],
      outcome: {next: 'none', change: 'its own', calls: ['presence left, which fails'], state: 'unchanged'}
    },
    spectatorLeaves: {ids: ['5-7', '5-4'], outcome: {next: 'running', change: 'its own', calls: ['over'], state: 'unchanged'}},
    otherChange: {ids: ['5-4'], outcome: {next: 'running', calls: ['over']}},
    overYes: {ids: ['5-4', '5-1'], outcome: {next: 'none', change: 'its own', calls: ['over']}},
    seatTaken: noSeatInMatch,
    startingCompletes: startsBeforeMatches,
    overYesSpectatorWaits: {
      ids: ['5-4', '5-1'],
      outcome: {next: 'none', change: 'its own', calls: ['over']}
    },
    recoveryLeftFails: {
      ids: ['5-7', '5-8', '5-1'],
      outcome: {next: 'none', change: 'goes on', calls: ['presence left, which fails'], state: 'unchanged'}
    }
  },
  lobby: {
    startAllowed: {
      ids: ['5-2', '5-3', '5-4', '5-1'],
      outcome: {
        next: 'lobbyRunning',
        change: 'its own',
        matchNumber: 'grows by 1',
        calls: ['initial state', 'presence lost for each lost player, by seat', 'presence hidden for each hidden player, by seat', 'over'],
        state: 'from the last call'
      }
    },
    startPresenceFails: {
      ids: ['5-8', '5-2', '5-1'],
      outcome: {
        next: 'lobbyRunning',
        change: 'goes on',
        matchNumber: 'grows by 1',
        calls: ['initial state', 'presence, which fails', 'the remaining calls of 5-3', 'over'],
        state: 'as before the failed call'
      }
    },
    startRefused: {ids: ['5-2'], outcome: {next: 'lobby', change: 'none', calls: [], told: 'cannot start'}},
    startInitialFails: {ids: ['5-2'], outcome: {next: 'lobby', change: 'none', calls: ['initial state'], told: 'cannot start'}},
    startOnOtherPage: {ids: ['5-2'], outcome: {next: 'lobby', change: 'none', calls: []}},
    playerEvent: {ids: ['5-6'], outcome: {next: 'lobby', change: 'its own', calls: ['presence'], state: 'from the last call'}},
    playerEventPresenceFails: {
      ids: ['5-8'],
      outcome: {next: 'lobby', change: 'none', calls: ['presence, which fails'], state: 'unchanged'}
    },
    recoveryLostOrVisibilityFails: {
      ids: ['5-8'],
      outcome: {
        next: 'lobby',
        change: 'goes on',
        calls: ['presence, which fails', 'the remaining calls of the end of recovery'],
        state: 'as before the failed call'
      }
    },
    spectatorEvent: {ids: ['5-6'], outcome: {next: 'lobby', change: 'none', calls: []}},
    playerEventNoPresenceTitle: lobbyHasPresence,
    playerLeaves: {ids: ['5-7', '5-6'], outcome: {next: 'lobby', change: 'its own', calls: ['presence left'], state: 'from the last call'}},
    playerLeavesNoPresenceTitle: lobbyHasPresence,
    playerLeavesPresenceFails: {
      ids: ['5-10', '5-11'],
      outcome: {
        next: 'lobby',
        change: 'its own',
        calls: ['presence left, which fails', ...lobbyCalls],
        state: 'the lobby state, then from the last call'
      }
    },
    spectatorLeaves: {ids: ['5-6'], outcome: {next: 'lobby', change: 'its own', calls: []}},
    otherChange: {ids: ['5-4'], outcome: {next: 'lobby', calls: []}},
    overYes: {impossible: 'the netcode calls over only while a match runs (5-4)'},
    seatTaken: {
      ids: ['5-11'],
      outcome: {next: 'lobby', calls: ['presence lost for it when it is lost', 'presence hidden for it when its page is hidden']}
    },
    startingCompletes: {
      ids: ['5-9', '5-11'],
      outcome: {
        next: 'lobby',
        change: 'its own',
        calls: ['presence hidden for the host when its page is hidden'],
        state: 'the lobby state, then from the last call'
      }
    },
    overYesSpectatorWaits: overOnlyInMatch,
    recoveryLeftFails: {
      ids: ['5-10', '5-11'],
      outcome: {next: 'lobby', change: 'goes on', calls: ['presence left, which fails'], state: 'the lobby state'}
    }
  },
  lobbyRunning: {
    startAllowed: {ids: ['5-2'], outcome: {next: 'lobbyRunning', change: 'none', calls: [], told: 'cannot start'}},
    startPresenceFails: {ids: ['5-2'], outcome: {next: 'lobbyRunning', change: 'none', calls: [], told: 'cannot start'}},
    startRefused: {ids: ['5-2'], outcome: {next: 'lobbyRunning', change: 'none', calls: [], told: 'cannot start'}},
    startInitialFails: {ids: ['5-2'], outcome: {next: 'lobbyRunning', change: 'none', calls: [], told: 'cannot start'}},
    startOnOtherPage: {ids: ['5-2'], outcome: {next: 'lobbyRunning', change: 'none', calls: []}},
    playerEvent: {
      ids: ['5-6', '5-4'],
      outcome: {next: 'lobbyRunning', change: 'its own', calls: ['presence', 'over'], state: 'from the last call'}
    },
    playerEventPresenceFails: {
      ids: ['5-8'],
      outcome: {next: 'lobbyRunning', change: 'none', calls: ['presence, which fails'], state: 'unchanged'}
    },
    recoveryLostOrVisibilityFails: {
      ids: ['5-8'],
      outcome: {
        next: 'lobbyRunning',
        change: 'goes on',
        calls: ['presence, which fails', 'the remaining calls of the end of recovery'],
        state: 'as before the failed call'
      }
    },
    spectatorEvent: {ids: ['5-6'], outcome: {next: 'lobbyRunning', change: 'none', calls: []}},
    playerEventNoPresenceTitle: lobbyHasPresence,
    playerLeaves: {
      ids: ['5-7', '5-4'],
      outcome: {next: 'lobbyRunning', change: 'its own', calls: ['presence left', 'over'], state: 'from the last call'}
    },
    playerLeavesNoPresenceTitle: lobbyHasPresence,
    playerLeavesPresenceFails: {
      ids: ['5-10', '5-7', '5-11', '5-1'],
      outcome: {
        next: 'lobby',
        change: 'its own',
        calls: ['presence left, which fails', ...lobbyCalls],
        state: 'the lobby state, then from the last call'
      }
    },
    spectatorLeaves: {
      ids: ['5-7', '5-4'],
      outcome: {next: 'lobbyRunning', change: 'its own', calls: ['over'], state: 'unchanged'}
    },
    otherChange: {ids: ['5-4'], outcome: {next: 'lobbyRunning', calls: ['over']}},
    overYes: {ids: ['5-4', '5-1'], outcome: {next: 'lobby', change: 'its own', calls: ['over']}},
    seatTaken: noSeatInMatch,
    startingCompletes: startsBeforeMatches,
    overYesSpectatorWaits: {
      ids: ['5-4', '5-11', '5-1'],
      outcome: {
        next: 'lobby',
        change: 'its own',
        calls: ['over', 'presence lost for it when it is lost', 'presence hidden for it when its page is hidden'],
        seats: 'the spectator takes the free seat'
      }
    },
    recoveryLeftFails: {
      ids: ['5-10', '5-7', '5-11', '5-1'],
      outcome: {next: 'lobby', change: 'goes on', calls: ['presence left, which fails'], state: 'the lobby state'}
    }
  }
}
