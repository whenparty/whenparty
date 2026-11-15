type State =
  | 'participantNotInRoom'
  | 'participantInRoom'
  | 'ownerNumberOpen'
  | 'ownerNumberNotOpen'
  | 'ownerNumberUnknownOrRemoved'
  | 'ended'

type Event = 'appSendsText' | 'appSendsNonText' | 'appSendsToAll' | 'textArrives' | 'foreignFormArrives'

type Outcome = {
  readonly send?: 'sent' | 'callFails' | 'skipped'
  readonly arrival?: 'appGetsTextWithSenderNumber' | 'dropped'
}

type Cell<O> = { readonly ids: readonly string[]; readonly outcome: O } | { readonly impossible: string }

const ownerOnly = { impossible: 'only the owner page sends to all participants' } as const
const noConnection = { impossible: 'the page keeps no peer connection here' } as const

const fails: Cell<Outcome> = { ids: ['7-3'], outcome: { send: 'callFails' } }
const sent: Cell<Outcome> = { ids: ['7-2'], outcome: { send: 'sent' } }
const gets: Cell<Outcome> = { ids: ['7-2'], outcome: { arrival: 'appGetsTextWithSenderNumber' } }
const dropped: Cell<Outcome> = { ids: ['7-5'], outcome: { arrival: 'dropped' } }
const skipped: Cell<Outcome> = { ids: ['7-3'], outcome: { send: 'skipped' } }

export const table: { readonly [S in State]: { readonly [E in Event]: Cell<Outcome> } } = {
  participantNotInRoom: { appSendsText: fails, appSendsNonText: fails, appSendsToAll: ownerOnly, textArrives: dropped, foreignFormArrives: dropped },
  participantInRoom: { appSendsText: sent, appSendsNonText: fails, appSendsToAll: ownerOnly, textArrives: gets, foreignFormArrives: dropped },
  ownerNumberOpen: { appSendsText: sent, appSendsNonText: fails, appSendsToAll: { ids: ['7-3'], outcome: { send: 'sent' } }, textArrives: gets, foreignFormArrives: dropped },
  ownerNumberNotOpen: { appSendsText: fails, appSendsNonText: fails, appSendsToAll: skipped, textArrives: dropped, foreignFormArrives: dropped },
  ownerNumberUnknownOrRemoved: { appSendsText: fails, appSendsNonText: fails, appSendsToAll: skipped, textArrives: noConnection, foreignFormArrives: noConnection },
  ended: { appSendsText: fails, appSendsNonText: fails, appSendsToAll: fails, textArrives: noConnection, foreignFormArrives: noConnection },
}
