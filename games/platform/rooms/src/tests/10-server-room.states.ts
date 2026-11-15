type State = 'owned' | 'away' | 'closed'

type Event =
  | 'reconnectFromOwnersPage'
  | 'reconnectFromOtherPage'
  | 'reconnectWithoutOwnerToken'
  | 'ownerReturnFromOwnersPage'
  | 'ownerReturnWithRoomTerm'
  | 'ownerReturnWithOtherTerm'
  | 'ownerConnectionCloses'
  | 'ownerLeaveArrives'
  | 'participantLeaveArrives'
  | 'ownerRequestFromOtherConnection'
  | 'waitingTimeWithoutOwnerConnection'
  | 'sixHundredSecondsWithoutOwnerConnectionOrMember'
  | 'twentyFourHoursSinceCreated'
  | 'serverRestarts'
  | 'unreadableRequest'

type Answer = 'no room' | 'removed' | 'roster' | 'term and roster' | 'room term' | 'none'

type Effect =
  | 'appliesLeaves'
  | 'makesOwnerConnection'
  | 'raisesTerm'
  | 'requestPageBecomesOwnersPage'
  | 'cancelsTokens'
  | 'cancelsThatToken'
  | 'endsPendingJoinRequests'
  | 'freesCode'
  | 'tellsOwnerConnectionRoomClosed'
  | 'dropsRequest'
  | 'forgetsEveryRoom'

type Outcome = { readonly next: State | 'gone'; readonly answer?: Answer; readonly effects: readonly Effect[] }

type Cell<O> = { readonly ids: readonly string[]; readonly outcome: O } | { readonly impossible: string }

const s = (next: State | 'gone', ids: readonly string[], effects: readonly Effect[] = [], answer?: Answer): Cell<Outcome> =>
  answer === undefined ? { ids, outcome: { next, effects } } : { ids, outcome: { next, answer, effects } }

const noOwnerConnection = { impossible: 'the room has no owner connection' } as const
const hasOwnerConnection = { impossible: 'the room has an owner connection' } as const
const answeredFirst = { impossible: 'the answer table of returns answers "no room" before a return of the owner' } as const
const noTimers = { impossible: 'the server keeps no time limits for a closed room' } as const

const closes = (ids: readonly string[], extra: readonly Effect[] = []): Cell<Outcome> => s('closed', ids, ['cancelsTokens', 'endsPendingJoinRequests', 'freesCode', ...extra])

const open = (st: 'owned' | 'away') => ({
  reconnectFromOwnersPage: s('owned', ['10-6'], ['appliesLeaves', 'makesOwnerConnection'], 'roster'),
  reconnectFromOtherPage: s(st, ['10-6'], ['dropsRequest'], 'none'),
  reconnectWithoutOwnerToken: s(st, ['10-6'], [], 'removed'),
  ownerReturnFromOwnersPage: s('owned', ['10-7'], ['appliesLeaves', 'makesOwnerConnection'], 'term and roster'),
  ownerReturnWithRoomTerm: s('owned', ['10-7'], ['appliesLeaves', 'raisesTerm', 'requestPageBecomesOwnersPage', 'makesOwnerConnection'], 'term and roster'),
  ownerReturnWithOtherTerm: s(st, ['10-7'], [], 'room term'),
  ownerLeaveArrives: closes(['10-8', '10-3']),
  participantLeaveArrives: s(st, ['10-8'], ['cancelsThatToken']),
  ownerRequestFromOtherConnection: s(st, ['10-5'], ['dropsRequest']),
  serverRestarts: s('gone', ['10-1'], ['forgetsEveryRoom']),
  unreadableRequest: s(st, ['10-9'], ['dropsRequest'], 'none'),
})

export const table: { readonly [S in State]: { readonly [E in Event]: Cell<Outcome> } } = {
  owned: {
    ...open('owned'),
    ownerConnectionCloses: s('away', ['10-5']),
    waitingTimeWithoutOwnerConnection: hasOwnerConnection,
    sixHundredSecondsWithoutOwnerConnectionOrMember: hasOwnerConnection,
    twentyFourHoursSinceCreated: closes(['10-3'], ['tellsOwnerConnectionRoomClosed']),
  },
  away: {
    ...open('away'),
    ownerConnectionCloses: noOwnerConnection,
    waitingTimeWithoutOwnerConnection: closes(['10-3']),
    sixHundredSecondsWithoutOwnerConnectionOrMember: closes(['10-3']),
    twentyFourHoursSinceCreated: closes(['10-3']),
  },
  closed: {
    reconnectFromOwnersPage: s('closed', ['10-6'], [], 'no room'),
    reconnectFromOtherPage: s('closed', ['10-6'], [], 'no room'),
    reconnectWithoutOwnerToken: s('closed', ['10-6'], [], 'no room'),
    ownerReturnFromOwnersPage: answeredFirst,
    ownerReturnWithRoomTerm: answeredFirst,
    ownerReturnWithOtherTerm: answeredFirst,
    ownerConnectionCloses: noOwnerConnection,
    ownerLeaveArrives: s('closed', ['10-8']),
    participantLeaveArrives: s('closed', ['10-8']),
    ownerRequestFromOtherConnection: s('closed', ['10-5'], ['dropsRequest']),
    waitingTimeWithoutOwnerConnection: noTimers,
    sixHundredSecondsWithoutOwnerConnectionOrMember: noTimers,
    twentyFourHoursSinceCreated: noTimers,
    serverRestarts: s('gone', ['10-1'], ['forgetsEveryRoom']),
    unreadableRequest: s('closed', ['10-9'], ['dropsRequest'], 'none'),
  },
}
