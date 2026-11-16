type State = 'returningAsking' | 'returningPausing'

type Event =
  | 'termAndRosterAnswer'
  | 'otherTermAnswer'
  | 'noRoomOrRemovedAnswer'
  | 'noAnswer'
  | 'signalingCannotOpen'
  | 'signalingCloses'
  | 'timer5s'
  | 'waitingTimePasses'

type Reason = 'room closed' | 'owner away'

type Effect = 'appToldTermAndRoster' | 'writesRecord' | 'asksAgainWithThatTerm' | 'asksAgainIn5s' | 'asksToReturn'

type Simple = {
  readonly next: State | 'owning' | 'ended'
  readonly reason?: Reason
  readonly effects: readonly Effect[]
}

type Branch = {readonly when: string; readonly outcome: Simple} | {readonly when: string; readonly impossible: string}

type Outcome = Simple | {readonly branches: readonly Branch[]}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

const noRequest = {impossible: 'no return request of the page waits for an answer'} as const
const notOpening = {impossible: 'the page is not opening a signaling connection while it pauses'} as const
const noSignaling = {impossible: 'the page has no signaling connection while it pauses'} as const
const noTimer = {impossible: 'no 5-second wait runs while a request is out'} as const

const go = (next: State | 'owning', ids: readonly string[], effects: readonly Effect[] = []): Cell<Outcome> => ({
  ids,
  outcome: {next, effects}
})
const deadline: Cell<Outcome> = {ids: ['5-4'], outcome: {next: 'ended', reason: 'owner away', effects: []}}

export const table: {readonly [S in State]: {readonly [E in Event]: Cell<Outcome>}} = {
  returningAsking: {
    termAndRosterAnswer: go('owning', ['5-1', '5-2'], ['appToldTermAndRoster', 'writesRecord']),
    otherTermAnswer: go('returningAsking', ['5-1'], ['asksAgainWithThatTerm']),
    noRoomOrRemovedAnswer: {
      ids: ['5-6'],
      outcome: {
        branches: [
          {
            when: 'the waiting time has passed since the owner connection was lost',
            impossible:
              'the room ends for the page when the waiting time passes (5-4), so no return of the page waits for an answer after it'
          },
          {when: 'otherwise', outcome: {next: 'ended', reason: 'room closed', effects: []}}
        ]
      }
    },
    noAnswer: go('returningPausing', ['5-3'], ['asksAgainIn5s']),
    signalingCannotOpen: go('returningPausing', ['5-3'], ['asksAgainIn5s']),
    signalingCloses: go('returningPausing', ['5-3'], ['asksAgainIn5s']),
    timer5s: noTimer,
    waitingTimePasses: deadline
  },
  returningPausing: {
    termAndRosterAnswer: noRequest,
    otherTermAnswer: noRequest,
    noRoomOrRemovedAnswer: noRequest,
    noAnswer: noRequest,
    signalingCannotOpen: notOpening,
    signalingCloses: noSignaling,
    timer5s: go('returningAsking', ['5-3', '5-1'], ['asksToReturn']),
    waitingTimePasses: deadline
  }
}
