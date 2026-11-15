type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

type ConnectionState = 'ownerConnecting' | 'ownerWaiting' | 'ownerOpen' | 'participantConnecting' | 'participantWaiting' | 'participantOpen'

type ConnectionEvent =
  | 'transportOpens'
  | 'firstVisibilityArrives'
  | 'confirmationArrives'
  | 'participantVisibilityChanges'
  | 'closes'
  | 'outerTimeLimitPasses'
  | 'transportReportsPath'

type ConnectionEffect = 'sendsVisibility' | 'sendsConfirmation' | 'appToldPath' | 'keepsPathForOpening'

type ConnectionOutcome = {
  readonly next: ConnectionState | 'closed'
  readonly effects: readonly ConnectionEffect[]
}

const notOpenYet = {impossible: 'nothing arrives over a peer connection before the transport opens it'} as const
const alreadyOpen = {impossible: 'the transport opens a peer connection once'} as const
const ownerSideOnly = {impossible: 'only the owner page gets a visibility'} as const
const participantSideOnly = {impossible: 'only a participant page gets a confirmation'} as const
const participantPageOnly = {impossible: 'this is the visibility of a participant page'} as const
const firstAlreadyArrived = {impossible: 'the first visibility has already arrived'} as const
const oneConfirmation = {impossible: 'the owner page sends one confirmation over a connection'} as const
const limitsOnlyWhileWaiting = {impossible: 'the outer time limits run only while the connection is not open for rooms'} as const
const noPathBeforeOpen = {impossible: 'the transport reports a path only once the peer connection is open'} as const

const c = (
  next: ConnectionState | 'closed',
  ids: readonly string[],
  effects: readonly ConnectionEffect[] = []
): Cell<ConnectionOutcome> => ({ids, outcome: {next, effects}})

export const connection: {readonly [S in ConnectionState]: {readonly [E in ConnectionEvent]: Cell<ConnectionOutcome>}} = {
  ownerConnecting: {
    transportOpens: c('ownerWaiting', ['1-8']),
    firstVisibilityArrives: notOpenYet,
    confirmationArrives: participantSideOnly,
    participantVisibilityChanges: participantPageOnly,
    closes: c('closed', ['1-8']),
    outerTimeLimitPasses: c('closed', ['1-8']),
    transportReportsPath: noPathBeforeOpen
  },
  ownerWaiting: {
    transportOpens: alreadyOpen,
    firstVisibilityArrives: c('ownerOpen', ['1-8'], ['sendsConfirmation']),
    confirmationArrives: participantSideOnly,
    participantVisibilityChanges: participantPageOnly,
    closes: c('closed', ['1-8']),
    outerTimeLimitPasses: c('closed', ['1-8']),
    transportReportsPath: c('ownerWaiting', ['1-10'], ['keepsPathForOpening'])
  },
  ownerOpen: {
    transportOpens: alreadyOpen,
    firstVisibilityArrives: firstAlreadyArrived,
    confirmationArrives: participantSideOnly,
    participantVisibilityChanges: participantPageOnly,
    closes: c('closed', ['1-8']),
    outerTimeLimitPasses: limitsOnlyWhileWaiting,
    transportReportsPath: c('ownerOpen', ['1-10'], ['appToldPath'])
  },
  participantConnecting: {
    transportOpens: c('participantWaiting', ['1-8'], ['sendsVisibility']),
    firstVisibilityArrives: ownerSideOnly,
    confirmationArrives: notOpenYet,
    participantVisibilityChanges: c('participantConnecting', ['1-8']),
    closes: c('closed', ['1-8']),
    outerTimeLimitPasses: c('closed', ['1-8']),
    transportReportsPath: noPathBeforeOpen
  },
  participantWaiting: {
    transportOpens: alreadyOpen,
    firstVisibilityArrives: ownerSideOnly,
    confirmationArrives: c('participantOpen', ['1-8']),
    participantVisibilityChanges: c('participantWaiting', ['1-9'], ['sendsVisibility']),
    closes: c('closed', ['1-8']),
    outerTimeLimitPasses: c('closed', ['1-8']),
    transportReportsPath: c('participantWaiting', ['1-10'], ['keepsPathForOpening'])
  },
  participantOpen: {
    transportOpens: alreadyOpen,
    firstVisibilityArrives: ownerSideOnly,
    confirmationArrives: oneConfirmation,
    participantVisibilityChanges: c('participantOpen', ['1-9'], ['sendsVisibility']),
    closes: c('closed', ['1-8']),
    outerTimeLimitPasses: limitsOnlyWhileWaiting,
    transportReportsPath: c('participantOpen', ['1-10'], ['appToldPath'])
  }
}

type RequestState = 'sent' | 'askedArrived'

type RequestEvent = 'answerArrives' | 'askedArrives' | 'fifteenSecondsSinceSent' | 'sixtyFiveSecondsSinceAsked'

type RequestOutcome = {
  readonly next: RequestState | 'answered' | 'noAnswer'
  readonly closesSignaling: boolean
}

const r = (next: RequestState | 'answered' | 'noAnswer', ids: readonly string[]): Cell<RequestOutcome> => ({
  ids,
  outcome: {next, closesSignaling: next === 'noAnswer'}
})

export const request: {readonly [S in RequestState]: {readonly [E in RequestEvent]: Cell<RequestOutcome>}} = {
  sent: {
    answerArrives: r('answered', ['1-12']),
    askedArrives: r('askedArrived', ['1-12']),
    fifteenSecondsSinceSent: r('noAnswer', ['1-12']),
    sixtyFiveSecondsSinceAsked: {impossible: '"asked" has not arrived'}
  },
  askedArrived: {
    answerArrives: r('answered', ['1-12']),
    askedArrives: {impossible: 'the server answers "asked" once for a join request'},
    fifteenSecondsSinceSent: r('askedArrived', ['1-12']),
    sixtyFiveSecondsSinceAsked: r('noAnswer', ['1-12'])
  }
}
