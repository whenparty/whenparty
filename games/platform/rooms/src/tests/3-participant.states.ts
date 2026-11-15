type State = 'in' | 'lostReturning' | 'lostPausing' | 'lostAttempting'

type Event =
  | 'openConnectionCloses'
  | 'attemptCloses'
  | 'attemptOpensForRooms'
  | 'returnOwnerPeer'
  | 'returnOwnerAway'
  | 'returnNoRoom'
  | 'returnRemoved'
  | 'noAnswer'
  | 'timer5s'
  | 'signalingCannotOpen'
  | 'signalingCloses'
  | 'ownerSendsEnd'
  | 'waitingTimePasses'
  | 'previousConnectionEvent'

type Reason = 'room closed' | 'owner away' | 'removed' | 'unreachable' | 'no relay' | 'the reason the owner page sent'

type Effect =
  | 'appToldOwnerLost'
  | 'appToldOwnerBack'
  | 'keepsLastArrivalInRecord'
  | 'asksToReturn'
  | 'asksAgainIn5s'
  | 'connectsToOwner'
  | 'deletesRecordAndJoinsAsNew'
  | 'tellsServerLeaveIfSignalingOpen'

type Simple = {
  readonly next: State | 'ended' | 'joiningAsNew'
  readonly reason?: Reason
  readonly effects: readonly Effect[]
}

type Outcome = Simple | { readonly branches: readonly { readonly when: string; readonly outcome: Simple }[] }

type Cell<O> = { readonly ids: readonly string[]; readonly outcome: O } | { readonly impossible: string }

const notLost = { impossible: 'the owner is not lost while the page is in the room' } as const
const onlyOpenConnection = { impossible: 'in the room the page has only its connection that is open for rooms' } as const
const noneOpenForRooms = { impossible: 'no connection is open for rooms while the owner is lost' } as const
const noAttempt = { impossible: 'the page connects only after an answer that gives the owner page peer ID' } as const
const noReturnRequest = { impossible: 'no return request of the page waits for an answer' } as const
const noTimer = { impossible: 'no 5-second wait runs in this state' } as const
const notOpening = { impossible: 'the page is not opening a signaling connection in this state' } as const
const endsOnlyOverOpen = { impossible: 'the owner page sends an end only over a connection open for rooms, after its confirmation' } as const

const go = (next: State, ids: readonly string[], effects: readonly Effect[] = []): Cell<Outcome> => ({ ids, outcome: { next, effects } })

const deadline: Cell<Outcome> = {
  ids: ['3-7'],
  outcome: {
    branches: [
      { when: 'the latest answer to its returns gave the owner page peer ID, and its latest peer connection closed with no relay', outcome: { next: 'ended', reason: 'no relay', effects: ['tellsServerLeaveIfSignalingOpen'] } },
      { when: 'the latest answer to its returns gave the owner page peer ID', outcome: { next: 'ended', reason: 'unreachable', effects: ['tellsServerLeaveIfSignalingOpen'] } },
      { when: 'otherwise', outcome: { next: 'ended', reason: 'owner away', effects: ['tellsServerLeaveIfSignalingOpen'] } },
    ],
  },
}

const lostBase = {
  openConnectionCloses: noneOpenForRooms,
  returnOwnerPeer: noReturnRequest,
  returnOwnerAway: noReturnRequest,
  returnNoRoom: noReturnRequest,
  returnRemoved: noReturnRequest,
  noAnswer: noReturnRequest,
  signalingCannotOpen: notOpening,
  ownerSendsEnd: endsOnlyOverOpen,
  waitingTimePasses: deadline,
} as const

export const table: { readonly [S in State]: { readonly [E in Event]: Cell<Outcome> } } = {
  in: {
    openConnectionCloses: go('lostReturning', ['3-3', '3-4'], ['appToldOwnerLost', 'keepsLastArrivalInRecord', 'asksToReturn']),
    attemptCloses: onlyOpenConnection,
    attemptOpensForRooms: onlyOpenConnection,
    returnOwnerPeer: noReturnRequest,
    returnOwnerAway: noReturnRequest,
    returnNoRoom: noReturnRequest,
    returnRemoved: noReturnRequest,
    noAnswer: noReturnRequest,
    timer5s: noTimer,
    signalingCannotOpen: notOpening,
    signalingCloses: go('in', ['3-2']),
    ownerSendsEnd: { ids: ['3-8'], outcome: { next: 'ended', reason: 'the reason the owner page sent', effects: [] } },
    waitingTimePasses: notLost,
    previousConnectionEvent: go('in', ['3-10']),
  },
  lostReturning: {
    ...lostBase,
    attemptCloses: noAttempt,
    attemptOpensForRooms: noAttempt,
    returnOwnerPeer: go('lostAttempting', ['3-4'], ['connectsToOwner']),
    returnOwnerAway: go('lostPausing', ['3-6'], ['asksAgainIn5s']),
    returnNoRoom: {
      ids: ['3-8'],
      outcome: {
        branches: [
          { when: 'the waiting time has passed since the owner was lost', outcome: { next: 'ended', reason: 'owner away', effects: [] } },
          { when: 'otherwise', outcome: { next: 'ended', reason: 'room closed', effects: [] } },
        ],
      },
    },
    returnRemoved: {
      ids: ['3-8'],
      outcome: {
        branches: [
          { when: 'the return started from a join with the record code', outcome: { next: 'joiningAsNew', effects: ['deletesRecordAndJoinsAsNew'] } },
          { when: 'otherwise', outcome: { next: 'ended', reason: 'removed', effects: [] } },
        ],
      },
    },
    noAnswer: go('lostPausing', ['3-6'], ['asksAgainIn5s']),
    timer5s: noTimer,
    signalingCannotOpen: go('lostPausing', ['3-6'], ['asksAgainIn5s']),
    signalingCloses: go('lostPausing', ['3-6'], ['asksAgainIn5s']),
    previousConnectionEvent: go('lostReturning', ['3-10']),
  },
  lostPausing: {
    ...lostBase,
    attemptCloses: noAttempt,
    attemptOpensForRooms: noAttempt,
    timer5s: go('lostReturning', ['3-6', '3-4'], ['asksToReturn']),
    signalingCloses: go('lostPausing', ['3-2']),
    previousConnectionEvent: go('lostPausing', ['3-10']),
  },
  lostAttempting: {
    ...lostBase,
    attemptCloses: go('lostPausing', ['3-6'], ['asksAgainIn5s']),
    attemptOpensForRooms: go('in', ['3-5'], ['appToldOwnerBack']),
    timer5s: noTimer,
    signalingCloses: go('lostAttempting', ['3-2']),
    previousConnectionEvent: go('lostAttempting', ['3-10']),
  },
}
