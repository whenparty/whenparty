type State = 'creating' | 'owning' | 'offlineReconnecting' | 'offlinePausing'

type Event =
  | 'createdAnswer'
  | 'badAppAnswer'
  | 'badWaitAnswer'
  | 'busyAnswer'
  | 'rosterAnswer'
  | 'noRoomOrRemovedAnswer'
  | 'noAnswer'
  | 'signalingCannotOpen'
  | 'signalingCloses'
  | 'timer5s'
  | 'serverClosedRoom'
  | 'aloneOrUnseenForWaitingTime'

type Reason = 'bad app' | 'bad wait' | 'busy' | 'offline' | 'room closed' | 'owner away' | 'idle'

type Effect =
  | 'appToldCodeAndTerm'
  | 'writesRecord'
  | 'appToldServerLost'
  | 'appToldServerBack'
  | 'keepsLastArrivalInRecord'
  | 'opensSignaling'
  | 'asksToReconnect'
  | 'sendsRoomClosedToParticipants'
  | 'leavesSendingIdle'

type Simple = {
  readonly next: State | 'failed' | 'ended'
  readonly reason?: Reason
  readonly effects: readonly Effect[]
}

type Outcome = Simple | {readonly branches: readonly {readonly when: string; readonly outcome: Simple}[]}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

const noCreate = {impossible: 'no request to create waits for an answer'} as const
const createAnswersOnly = {impossible: 'a request to create gets only the answers of creating'} as const
const noReconnect = {impossible: 'no request to reconnect waits for an answer'} as const
const noRequest = {impossible: 'no request of the page waits for an answer in this state'} as const
const notOpening = {impossible: 'the page is not opening a signaling connection in this state'} as const
const noSignaling = {impossible: 'the page has no signaling connection in this state'} as const
const noTimer = {impossible: 'no 5-second wait runs in this state'} as const
const noRoomYet = {impossible: 'the room does not exist yet'} as const
const notOwnerConnection = {impossible: 'the server says this only over the owner connection'} as const

const go = (next: State, ids: readonly string[], effects: readonly Effect[] = []): Cell<Outcome> => ({ids, outcome: {next, effects}})
const fail = (reason: Reason): Cell<Outcome> => ({ids: ['4-2'], outcome: {next: 'failed', reason, effects: []}})
const idle: Cell<Outcome> = {ids: ['4-7'], outcome: {next: 'ended', reason: 'idle', effects: ['leavesSendingIdle']}}

const notCreating = {
  createdAnswer: noCreate,
  badAppAnswer: noCreate,
  badWaitAnswer: noCreate,
  busyAnswer: noCreate
} as const

export const table: {readonly [S in State]: {readonly [E in Event]: Cell<Outcome>}} = {
  creating: {
    createdAnswer: go('owning', ['4-2'], ['appToldCodeAndTerm', 'writesRecord']),
    badAppAnswer: fail('bad app'),
    badWaitAnswer: fail('bad wait'),
    busyAnswer: fail('busy'),
    rosterAnswer: noReconnect,
    noRoomOrRemovedAnswer: createAnswersOnly,
    noAnswer: fail('offline'),
    signalingCannotOpen: fail('offline'),
    signalingCloses: fail('offline'),
    timer5s: noTimer,
    serverClosedRoom: noRoomYet,
    aloneOrUnseenForWaitingTime: noRoomYet
  },
  owning: {
    ...notCreating,
    rosterAnswer: noReconnect,
    noRoomOrRemovedAnswer: noRequest,
    noAnswer: noRequest,
    signalingCannotOpen: notOpening,
    signalingCloses: go(
      'offlineReconnecting',
      ['4-4', '4-5'],
      ['appToldServerLost', 'keepsLastArrivalInRecord', 'opensSignaling', 'asksToReconnect']
    ),
    timer5s: noTimer,
    serverClosedRoom: {ids: ['4-6'], outcome: {next: 'ended', reason: 'room closed', effects: ['sendsRoomClosedToParticipants']}},
    aloneOrUnseenForWaitingTime: idle
  },
  offlineReconnecting: {
    ...notCreating,
    rosterAnswer: go('owning', ['4-5'], ['appToldServerBack']),
    noRoomOrRemovedAnswer: {
      ids: ['4-6'],
      outcome: {
        branches: [
          {
            when: 'the waiting time has passed since the owner connection was lost',
            outcome: {next: 'ended', reason: 'owner away', effects: ['sendsRoomClosedToParticipants']}
          },
          {when: 'otherwise', outcome: {next: 'ended', reason: 'room closed', effects: ['sendsRoomClosedToParticipants']}}
        ]
      }
    },
    noAnswer: go('offlinePausing', ['4-4']),
    signalingCannotOpen: go('offlinePausing', ['4-4']),
    signalingCloses: go('offlinePausing', ['4-4']),
    timer5s: noTimer,
    serverClosedRoom: notOwnerConnection,
    aloneOrUnseenForWaitingTime: idle
  },
  offlinePausing: {
    ...notCreating,
    rosterAnswer: noReconnect,
    noRoomOrRemovedAnswer: noRequest,
    noAnswer: noRequest,
    signalingCannotOpen: notOpening,
    signalingCloses: noSignaling,
    timer5s: go('offlineReconnecting', ['4-4', '4-5'], ['opensSignaling', 'asksToReconnect']),
    serverClosedRoom: noSignaling,
    aloneOrUnseenForWaitingTime: idle
  }
}
