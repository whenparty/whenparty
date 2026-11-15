type State = 'idle' | 'waiting' | 'skipping'

type Event =
  | 'batchStarts'
  | 'dueTimeGiven'
  | 'deadlineFails'
  | 'deadlinesFails'
  | 'hundredGivenAndMoreDue'
  | 'otherChange'
  | 'matchStarts'
  | 'matchEnds'

type Outcome = {
  readonly next: State
  readonly batch?: 'none' | 'reads room time once' | 'goes on' | 'ends'
  readonly change?: true
  readonly skips?: 'the failed time and every earlier one' | 'every time not later than the time read' | 'every time' | 'nothing more'
  readonly timer?: 'the earliest time that is not skipped' | 'none'
}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

const noCallWithoutMatch = {impossible: 'the host makes batches and calls deadlines only while a match runs (7-1, 7-2)'} as const

export const table: {readonly [S in State]: {readonly [E in Event]: Cell<Outcome>}} = {
  idle: {
    batchStarts: {ids: ['7-1'], outcome: {next: 'idle', batch: 'none'}},
    dueTimeGiven: noCallWithoutMatch,
    deadlineFails: noCallWithoutMatch,
    deadlinesFails: noCallWithoutMatch,
    hundredGivenAndMoreDue: noCallWithoutMatch,
    otherChange: {ids: ['7-2'], outcome: {next: 'idle', change: true, timer: 'none'}},
    matchStarts: {ids: ['7-2'], outcome: {next: 'waiting', change: true, timer: 'the earliest time that is not skipped'}},
    matchEnds: {impossible: 'no match runs'}
  },
  waiting: {
    batchStarts: {ids: ['7-1'], outcome: {next: 'waiting', batch: 'reads room time once'}},
    dueTimeGiven: {
      ids: ['7-1', '7-2'],
      outcome: {next: 'waiting', batch: 'goes on', change: true, timer: 'the earliest time that is not skipped'}
    },
    deadlineFails: {
      ids: ['7-3', '7-4'],
      outcome: {
        next: 'skipping',
        batch: 'ends',
        skips: 'the failed time and every earlier one',
        timer: 'the earliest time that is not skipped'
      }
    },
    deadlinesFails: {ids: ['7-3', '7-4'], outcome: {next: 'skipping', batch: 'ends', skips: 'every time', timer: 'none'}},
    hundredGivenAndMoreDue: {
      ids: ['7-3', '7-4'],
      outcome: {
        next: 'skipping',
        batch: 'ends',
        skips: 'every time not later than the time read',
        timer: 'the earliest time that is not skipped'
      }
    },
    otherChange: {ids: ['7-2'], outcome: {next: 'waiting', change: true, timer: 'the earliest time that is not skipped'}},
    matchStarts: {impossible: 'a match starts only while none runs (5-2)'},
    matchEnds: {ids: ['7-1', '7-2'], outcome: {next: 'idle', change: true, timer: 'none'}}
  },
  skipping: {
    batchStarts: {ids: ['7-1', '7-4'], outcome: {next: 'skipping', batch: 'reads room time once'}},
    dueTimeGiven: {
      ids: ['7-1', '7-4'],
      outcome: {next: 'waiting', batch: 'goes on', change: true, skips: 'nothing more', timer: 'the earliest time that is not skipped'}
    },
    deadlineFails: {
      ids: ['7-3', '7-4'],
      outcome: {
        next: 'skipping',
        batch: 'ends',
        skips: 'the failed time and every earlier one',
        timer: 'the earliest time that is not skipped'
      }
    },
    deadlinesFails: {ids: ['7-3', '7-4'], outcome: {next: 'skipping', batch: 'ends', skips: 'every time', timer: 'none'}},
    hundredGivenAndMoreDue: {
      ids: ['7-3', '7-4'],
      outcome: {
        next: 'skipping',
        batch: 'ends',
        skips: 'every time not later than the time read',
        timer: 'the earliest time that is not skipped'
      }
    },
    otherChange: {
      ids: ['7-4', '7-2'],
      outcome: {next: 'waiting', change: true, skips: 'nothing more', timer: 'the earliest time that is not skipped'}
    },
    matchStarts: {impossible: 'a match starts only while none runs (5-2)'},
    matchEnds: {ids: ['7-1', '7-2'], outcome: {next: 'idle', change: true, skips: 'nothing more', timer: 'none'}}
  }
}
