type Cell<O> = { readonly ids: readonly string[]; readonly outcome: O } | { readonly impossible: string }

type CreateState = 'roomCanOpen' | 'tenOpenOrConnectionHasOpenRoom'

type CreateEvent = 'validRequest' | 'appIdNotValid' | 'waitingTimeNotValid' | 'bothNotValid'

type CreateOutcome = { readonly answer: 'created, with code and term 1' | 'bad app' | 'bad wait' | 'busy' }

const c = (answer: CreateOutcome['answer']): Cell<CreateOutcome> => ({ ids: ['12-1'], outcome: { answer } })

export const create: { readonly [S in CreateState]: { readonly [E in CreateEvent]: Cell<CreateOutcome> } } = {
  roomCanOpen: { validRequest: c('created, with code and term 1'), appIdNotValid: c('bad app'), waitingTimeNotValid: c('bad wait'), bothNotValid: c('bad app') },
  tenOpenOrConnectionHasOpenRoom: { validRequest: c('busy'), appIdNotValid: c('bad app'), waitingTimeNotValid: c('bad wait'), bothNotValid: c('bad app') },
}

type JoinState = 'noRoom' | 'noOwnerConnection' | 'full' | 'connectionHasWaitingJoin' | 'open'

type JoinEvent = 'validRequest' | 'appIdNotValid'

type JoinOutcome = { readonly answer: 'bad app' | 'no room' | 'owner away' | 'full' | 'busy' | 'asked'; readonly reservesNumberAndAsksOwner: boolean }

const j = (answer: JoinOutcome['answer']): Cell<JoinOutcome> => ({ ids: ['12-2'], outcome: { answer, reservesNumberAndAsksOwner: answer === 'asked' } })

export const join: { readonly [S in JoinState]: { readonly [E in JoinEvent]: Cell<JoinOutcome> } } = {
  noRoom: { validRequest: j('no room'), appIdNotValid: j('bad app') },
  noOwnerConnection: { validRequest: j('owner away'), appIdNotValid: j('bad app') },
  full: { validRequest: j('full'), appIdNotValid: j('bad app') },
  connectionHasWaitingJoin: { validRequest: j('busy'), appIdNotValid: j('bad app') },
  open: { validRequest: j('asked'), appIdNotValid: j('bad app') },
}

type ReturnState = 'noRoom' | 'ownerToken' | 'unknownToken' | 'noOwnerConnection' | 'memberToken'

type ReturnEvent = 'validRequest' | 'appIdNotValid'

type ReturnOutcome = { readonly answer: 'bad app' | 'no room' | 'as a return of the owner' | 'removed' | 'owner away' | 'as the acceptance of a return' }

const r = (answer: ReturnOutcome['answer']): Cell<ReturnOutcome> => ({ ids: ['12-3'], outcome: { answer } })

export const returning: { readonly [S in ReturnState]: { readonly [E in ReturnEvent]: Cell<ReturnOutcome> } } = {
  noRoom: { validRequest: r('no room'), appIdNotValid: r('bad app') },
  ownerToken: { validRequest: r('as a return of the owner'), appIdNotValid: r('bad app') },
  unknownToken: { validRequest: r('removed'), appIdNotValid: r('bad app') },
  noOwnerConnection: { validRequest: r('owner away'), appIdNotValid: r('bad app') },
  memberToken: { validRequest: r('as the acceptance of a return'), appIdNotValid: r('bad app') },
}
