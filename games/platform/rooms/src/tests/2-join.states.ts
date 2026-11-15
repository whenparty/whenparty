type State = 'asking' | 'askingAgain' | 'waiting' | 'asked' | 'attempting' | 'returning' | 'pausing' | 'spacing' | 'lateAttempting'

type Event =
  | 'joinAsked'
  | 'joinOwnerAway'
  | 'joinNoRoom'
  | 'joinFull'
  | 'joinBusy'
  | 'joinBadApp'
  | 'joinLetIn'
  | 'joinRefused'
  | 'returnOwnerPeer'
  | 'returnOwnerAway'
  | 'returnNoRoom'
  | 'returnRemoved'
  | 'noAnswer'
  | 'timer5s'
  | 'signalingCannotOpen'
  | 'signalingClosesWhileNeeded'
  | 'attemptOpensForRooms'
  | 'attemptCloses'
  | 'passes30s'
  | 'passes45s'

type Reason = 'no room' | 'full' | 'busy' | 'refused' | 'offline' | 'unreachable'

type Effect =
  | 'appToldAsked'
  | 'appToldWaitingForOwner'
  | 'appToldLetIn'
  | 'asksToJoin'
  | 'asksToReturn'
  | 'asksAgainIn5s'
  | 'connectsToOwner'
  | 'appToldNumber'
  | 'writesRecord'
  | 'appGetsRefusalData'
  | 'tellsServerLeaveIfSignalingOpen'
  | 'closesAttempt'

type Simple = {
  readonly next: State | 'in' | 'failed'
  readonly reason?: Reason
  readonly effects: readonly Effect[]
}

type Outcome = Simple | { readonly branches: readonly { readonly when: string; readonly outcome: Simple }[] }

type Cell<O> = { readonly ids: readonly string[]; readonly outcome: O } | { readonly impossible: string }

const noJoinRequest = { impossible: 'no join request of the page waits for an answer' } as const
const afterAskedOnly = { impossible: 'the server sends this answer only after "asked"' } as const
const finalAnswers = { impossible: 'after "asked" only a final answer comes' } as const
const appIdChecked = { impossible: 'the page checks the app ID before it asks' } as const
const notLetIn = { impossible: 'the page has no token and no peer connection before it is let in' } as const
const noReturnRequest = { impossible: 'no return request of the page waits for an answer' } as const
const noTimer = { impossible: 'no 5-second wait runs in this state' } as const
const notOpening = { impossible: 'the page is not opening a signaling connection in this state' } as const
const notNeeded = { impossible: 'no request waits for an answer and the page does not wait to ask to join again' } as const
const noAttempt = { impossible: 'no attempt is open in this state' } as const
const failedAt30s = { impossible: 'joining failed at 30 seconds, when no attempt was open' } as const
const passed30s = { impossible: '30 seconds have already passed' } as const
const before30s = { impossible: '30 seconds pass before 45 seconds' } as const

const go = (next: State | 'in', ids: readonly string[], effects: readonly Effect[] = []): Cell<Outcome> => ({ ids, outcome: { next, effects } })
const fail = (reason: Reason, ids: readonly string[], effects: readonly Effect[] = []): Cell<Outcome> => ({ ids, outcome: { next: 'failed', reason, effects } })
const unreachableLeaving = (ids: readonly string[], effects: readonly Effect[] = []): Cell<Outcome> => fail('unreachable', ids, [...effects, 'tellsServerLeaveIfSignalingOpen'])

const beforeLetIn = {
  returnOwnerPeer: notLetIn,
  returnOwnerAway: notLetIn,
  returnNoRoom: notLetIn,
  returnRemoved: notLetIn,
  attemptOpensForRooms: notLetIn,
  attemptCloses: notLetIn,
  passes30s: notLetIn,
  passes45s: notLetIn,
} as const

const afterLetIn = {
  joinAsked: noJoinRequest,
  joinOwnerAway: noJoinRequest,
  joinNoRoom: noJoinRequest,
  joinFull: noJoinRequest,
  joinBusy: noJoinRequest,
  joinBadApp: noJoinRequest,
  joinLetIn: noJoinRequest,
  joinRefused: noJoinRequest,
} as const

const noReturn = {
  returnOwnerPeer: noReturnRequest,
  returnOwnerAway: noReturnRequest,
  returnNoRoom: noReturnRequest,
  returnRemoved: noReturnRequest,
  noAnswer: noReturnRequest,
  signalingCannotOpen: notOpening,
  signalingClosesWhileNeeded: notNeeded,
} as const

export const table: { readonly [S in State]: { readonly [E in Event]: Cell<Outcome> } } = {
  asking: {
    ...beforeLetIn,
    joinAsked: go('asked', ['2-3'], ['appToldAsked']),
    joinOwnerAway: go('waiting', ['2-3', '2-4'], ['appToldWaitingForOwner', 'asksAgainIn5s']),
    joinNoRoom: fail('no room', ['2-3']),
    joinFull: fail('full', ['2-3']),
    joinBusy: fail('busy', ['2-3']),
    joinBadApp: appIdChecked,
    joinLetIn: afterAskedOnly,
    joinRefused: afterAskedOnly,
    noAnswer: fail('offline', ['2-5']),
    timer5s: noTimer,
    signalingCannotOpen: fail('offline', ['2-5']),
    signalingClosesWhileNeeded: fail('offline', ['2-5']),
  },
  askingAgain: {
    ...beforeLetIn,
    joinAsked: go('asked', ['2-3', '2-4'], ['appToldAsked']),
    joinOwnerAway: go('waiting', ['2-4'], ['asksAgainIn5s']),
    joinNoRoom: fail('no room', ['2-3']),
    joinFull: fail('full', ['2-3']),
    joinBusy: fail('busy', ['2-3']),
    joinBadApp: appIdChecked,
    joinLetIn: afterAskedOnly,
    joinRefused: afterAskedOnly,
    noAnswer: fail('offline', ['2-5']),
    timer5s: noTimer,
    signalingCannotOpen: { impossible: 'the page asks again over the signaling connection that is already open' },
    signalingClosesWhileNeeded: fail('offline', ['2-5']),
  },
  waiting: {
    ...beforeLetIn,
    joinAsked: noJoinRequest,
    joinOwnerAway: noJoinRequest,
    joinNoRoom: noJoinRequest,
    joinFull: noJoinRequest,
    joinBusy: noJoinRequest,
    joinBadApp: noJoinRequest,
    joinLetIn: noJoinRequest,
    joinRefused: noJoinRequest,
    noAnswer: noJoinRequest,
    timer5s: go('askingAgain', ['2-4'], ['asksToJoin']),
    signalingCannotOpen: notOpening,
    signalingClosesWhileNeeded: fail('offline', ['2-5']),
  },
  asked: {
    ...beforeLetIn,
    joinAsked: finalAnswers,
    joinOwnerAway: go('waiting', ['2-6', '2-4'], ['appToldWaitingForOwner', 'asksAgainIn5s']),
    joinNoRoom: fail('no room', ['2-6']),
    joinFull: finalAnswers,
    joinBusy: finalAnswers,
    joinBadApp: finalAnswers,
    joinLetIn: go('attempting', ['2-6', '2-7'], ['appToldLetIn', 'connectsToOwner']),
    joinRefused: fail('refused', ['2-6'], ['appGetsRefusalData']),
    noAnswer: fail('offline', ['2-5']),
    timer5s: noTimer,
    signalingCannotOpen: notOpening,
    signalingClosesWhileNeeded: fail('offline', ['2-5']),
  },
  attempting: {
    ...afterLetIn,
    ...noReturn,
    timer5s: noTimer,
    attemptOpensForRooms: go('in', ['2-8'], ['appToldNumber', 'writesRecord']),
    attemptCloses: go('returning', ['2-9'], ['asksToReturn']),
    passes30s: go('lateAttempting', ['2-9']),
    passes45s: before30s,
  },
  returning: {
    ...afterLetIn,
    returnOwnerPeer: {
      ids: ['2-9'],
      outcome: {
        branches: [
          { when: '5 seconds have passed since the previous attempt started', outcome: { next: 'attempting', effects: ['connectsToOwner'] } },
          { when: 'otherwise', outcome: { next: 'spacing', effects: [] } },
        ],
      },
    },
    returnOwnerAway: go('pausing', ['2-9'], ['asksAgainIn5s']),
    returnNoRoom: fail('no room', ['2-11']),
    returnRemoved: fail('unreachable', ['2-11']),
    noAnswer: go('pausing', ['2-9'], ['asksAgainIn5s']),
    timer5s: noTimer,
    signalingCannotOpen: go('pausing', ['2-9'], ['asksAgainIn5s']),
    signalingClosesWhileNeeded: go('pausing', ['2-9'], ['asksAgainIn5s']),
    attemptOpensForRooms: noAttempt,
    attemptCloses: noAttempt,
    passes30s: {
      ids: ['2-10'],
      outcome: {
        branches: [
          { when: 'the signaling connection of the return request is still opening', outcome: { next: 'failed', reason: 'offline', effects: [] } },
          { when: 'otherwise', outcome: { next: 'failed', reason: 'unreachable', effects: ['tellsServerLeaveIfSignalingOpen'] } },
        ],
      },
    },
    passes45s: failedAt30s,
  },
  pausing: {
    ...afterLetIn,
    ...noReturn,
    timer5s: go('returning', ['2-9'], ['asksToReturn']),
    attemptOpensForRooms: noAttempt,
    attemptCloses: noAttempt,
    passes30s: {
      ids: ['2-10'],
      outcome: {
        branches: [
          { when: 'the signaling connection of the latest return request could not open', outcome: { next: 'failed', reason: 'offline', effects: [] } },
          { when: 'otherwise', outcome: { next: 'failed', reason: 'unreachable', effects: ['tellsServerLeaveIfSignalingOpen'] } },
        ],
      },
    },
    passes45s: failedAt30s,
  },
  spacing: {
    ...afterLetIn,
    ...noReturn,
    timer5s: go('attempting', ['2-9'], ['connectsToOwner']),
    attemptOpensForRooms: noAttempt,
    attemptCloses: noAttempt,
    passes30s: unreachableLeaving(['2-10']),
    passes45s: failedAt30s,
  },
  lateAttempting: {
    ...afterLetIn,
    ...noReturn,
    timer5s: noTimer,
    attemptOpensForRooms: go('in', ['2-8'], ['appToldNumber', 'writesRecord']),
    attemptCloses: unreachableLeaving(['2-10']),
    passes30s: passed30s,
    passes45s: unreachableLeaving(['2-9', '2-10'], ['closesAttempt']),
  },
}
