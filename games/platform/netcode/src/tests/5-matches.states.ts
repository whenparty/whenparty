type State = 'none' | 'running'

type Event =
  | 'startAllowed'
  | 'startPresenceFails'
  | 'startRefused'
  | 'startInitialFails'
  | 'startOnOtherPage'
  | 'playerEvent'
  | 'playerEventPresenceFails'
  | 'recoveryPresenceFails'
  | 'spectatorEvent'
  | 'playerEventNoPresenceTitle'
  | 'playerLeaves'
  | 'playerLeavesNoPresenceTitle'
  | 'playerLeavesPresenceFails'
  | 'spectatorLeaves'
  | 'otherChange'
  | 'overYes'

type Outcome = {
  readonly next: State
  readonly change?: 'none' | 'its own' | 'goes on'
  readonly matchNumber?: 'grows by 1'
  readonly calls: readonly string[]
  readonly told?: 'cannot start'
  readonly state?: 'from the last call' | 'as before the failed call' | 'unchanged'
}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

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
    recoveryPresenceFails: {impossible: 'the end of recovery calls presence only while a match runs'},
    spectatorEvent: {ids: ['5-6'], outcome: {next: 'none', change: 'none', calls: []}},
    playerEventNoPresenceTitle: {ids: ['5-6'], outcome: {next: 'none', change: 'none', calls: []}},
    playerLeaves: {ids: ['5-6'], outcome: {next: 'none', calls: []}},
    playerLeavesNoPresenceTitle: {ids: ['5-6'], outcome: {next: 'none', calls: []}},
    playerLeavesPresenceFails: {impossible: 'while no match runs, the netcode calls no presence (5-6)'},
    spectatorLeaves: {ids: ['5-6'], outcome: {next: 'none', calls: []}},
    otherChange: {ids: ['5-4'], outcome: {next: 'none', calls: []}},
    overYes: {impossible: 'the netcode calls over only while a match runs (5-4)'}
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
    recoveryPresenceFails: {
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
    overYes: {ids: ['5-4', '5-1'], outcome: {next: 'none', change: 'its own', calls: ['over']}}
  }
}
