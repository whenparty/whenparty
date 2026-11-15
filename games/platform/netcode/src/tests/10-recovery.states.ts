type State = 'recovering'

type Event =
  | 'rosterWithUsableRecord'
  | 'rosterWithRecordOfOtherVersions'
  | 'rosterWithRecordOfOtherForm'
  | 'rosterWithoutRecordSnapshot'
  | 'rosterLacksParticipant'
  | 'rosterLacksPlayerWhileMatchRuns'
  | 'rosterHasNewParticipant'
  | 'rosterHasPlayerWhileMatchRuns'
  | 'noMatchRunsAtEnd'
  | 'deadlinesDueAtEnd'
  | 'pageHiddenOrVisible'
  | 'startMatchCalled'
  | 'timerFires'
  | 'actionArrives'
  | 'joinRequest'
  | 'participantEvent'

type Outcome = {
  readonly next: 'recovering' | 'hosting'
  readonly snapshot?:
    "the record's" | 'without a match, the host on the first seat, the roster on the next seats by public number, the rest queued'
  readonly matchNumber?: "the record snapshot's" | '0'
  readonly change?: 'none' | 'one, the first of the new term'
  readonly participant?:
    | 'leaves its seat or the queue'
    | 'leaves as 5-7 says'
    | 'joins the end of the queue, lost and not hidden'
    | 'counts as lost and not hidden'
  readonly calls?: readonly string[]
  readonly told?: 'nothing but entering'
  readonly afterwards?: 'a batch before any other cause, and the timer'
  readonly seats?: 'the first spectators take the free seats'
}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

const noConnectionYet = {
  impossible: "no participant's connection to the new page opens before the rooms module gives the term and roster"
} as const

export const table: {readonly [S in State]: {readonly [E in Event]: Cell<Outcome>}} = {
  recovering: {
    rosterWithUsableRecord: {
      ids: ['10-1', '10-3'],
      outcome: {next: 'hosting', snapshot: "the record's", change: 'one, the first of the new term'}
    },
    rosterWithRecordOfOtherVersions: {
      ids: ['10-1', '10-3'],
      outcome: {
        next: 'hosting',
        snapshot: 'without a match, the host on the first seat, the roster on the next seats by public number, the rest queued',
        matchNumber: "the record snapshot's",
        change: 'one, the first of the new term'
      }
    },
    rosterWithRecordOfOtherForm: {
      ids: ['10-1', '10-3'],
      outcome: {
        next: 'hosting',
        snapshot: 'without a match, the host on the first seat, the roster on the next seats by public number, the rest queued',
        matchNumber: "the record snapshot's",
        change: 'one, the first of the new term'
      }
    },
    rosterWithoutRecordSnapshot: {
      ids: ['10-1', '10-3'],
      outcome: {
        next: 'hosting',
        snapshot: 'without a match, the host on the first seat, the roster on the next seats by public number, the rest queued',
        matchNumber: '0',
        change: 'one, the first of the new term'
      }
    },
    rosterLacksParticipant: {ids: ['10-3'], outcome: {next: 'hosting', participant: 'leaves its seat or the queue'}},
    rosterLacksPlayerWhileMatchRuns: {ids: ['10-3'], outcome: {next: 'hosting', participant: 'leaves as 5-7 says'}},
    rosterHasNewParticipant: {ids: ['10-3'], outcome: {next: 'hosting', participant: 'joins the end of the queue, lost and not hidden'}},
    rosterHasPlayerWhileMatchRuns: {
      ids: ['10-3'],
      outcome: {
        next: 'hosting',
        participant: 'counts as lost and not hidden',
        calls: ['presence lost for each player of the roster, by seat', "presence visible or hidden for the host's seat", 'over']
      }
    },
    noMatchRunsAtEnd: {ids: ['10-3'], outcome: {next: 'hosting', calls: [], seats: 'the first spectators take the free seats'}},
    deadlinesDueAtEnd: {ids: ['10-4'], outcome: {next: 'hosting', afterwards: 'a batch before any other cause, and the timer'}},
    pageHiddenOrVisible: {ids: ['10-2', '10-3'], outcome: {next: 'recovering', change: 'none', told: 'nothing but entering'}},
    startMatchCalled: {ids: ['10-2'], outcome: {next: 'recovering', change: 'none', told: 'nothing but entering'}},
    timerFires: {impossible: 'the host sets no timer before recovery ends (10-2)'},
    actionArrives: noConnectionYet,
    joinRequest: {
      impossible:
        "the rooms module asks only the owner's page that has the room, which the returning page has only with the term and roster"
    },
    participantEvent: noConnectionYet
  }
}
