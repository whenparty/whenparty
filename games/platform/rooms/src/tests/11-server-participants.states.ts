type State = 'asked' | 'member' | 'gone'

type Event =
  | 'ownerLetsIn'
  | 'ownerLetsInButPeerCannotBeAdded'
  | 'ownerRefuses'
  | 'sixtySecondsPass'
  | 'joiningPageWithdraws'
  | 'joiningSignalingCloses'
  | 'ownerConnectionClosesOrChanges'
  | 'roomCloses'
  | 'participantLeaveArrives'
  | 'ownerReportsLeave'
  | 'returnAccepted'
  | 'returnButPeerCannotBeAdded'

type Answer = 'token, number, waiting time and owner page peer ID' | 'refused' | 'owner away' | 'no room' | 'owner page peer ID'

type Effect =
  | 'addsPeerToOwnerList'
  | 'namesNumberAndPeerToOwnerPage'
  | 'ownerPageToldRequestEnded'
  | 'passesRefusalJoinData'
  | 'cancelsToken'
  | 'removesPeerFromOwnerList'
  | 'removesOlderPeerFromOwnerList'
  | 'tellsOwnerConnectionParticipantLeft'
  | 'dropsIt'

type Outcome = {readonly next: State; readonly answer?: Answer; readonly effects: readonly Effect[]}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

const s = (next: State, ids: readonly string[], effects: readonly Effect[] = [], answer?: Answer): Cell<Outcome> =>
  answer === undefined ? {ids, outcome: {next, effects}} : {ids, outcome: {next, answer, effects}}

const noToken = {impossible: 'a participant in the asked state has no token'} as const
const notAsked = {impossible: 'the server adds the peer ID at a let-in only for an asked participant'} as const
const noLimit = {impossible: 'no request of this participant waits, so no 60-second limit runs'} as const
const returnAnsweredFirst = {impossible: 'the answer table of returns answers "removed" first'} as const

const ended = (st: State): Cell<Outcome> => s(st, ['11-4'], ['dropsIt'])

export const table: {readonly [S in State]: {readonly [E in Event]: Cell<Outcome>}} = {
  asked: {
    ownerLetsIn: s(
      'member',
      ['11-4', '11-5'],
      ['addsPeerToOwnerList', 'namesNumberAndPeerToOwnerPage'],
      'token, number, waiting time and owner page peer ID'
    ),
    ownerLetsInButPeerCannotBeAdded: s('gone', ['11-4'], ['ownerPageToldRequestEnded'], 'owner away'),
    ownerRefuses: s('gone', ['11-4'], ['passesRefusalJoinData'], 'refused'),
    sixtySecondsPass: s('gone', ['11-4'], ['ownerPageToldRequestEnded'], 'refused'),
    joiningPageWithdraws: s('gone', ['11-4'], ['ownerPageToldRequestEnded']),
    joiningSignalingCloses: s('gone', ['11-4'], ['ownerPageToldRequestEnded']),
    ownerConnectionClosesOrChanges: s('gone', ['11-4'], [], 'owner away'),
    roomCloses: s('gone', ['11-4'], [], 'no room'),
    participantLeaveArrives: noToken,
    ownerReportsLeave: s('asked', ['11-7'], ['dropsIt']),
    returnAccepted: noToken,
    returnButPeerCannotBeAdded: noToken
  },
  member: {
    ownerLetsIn: ended('member'),
    ownerLetsInButPeerCannotBeAdded: notAsked,
    ownerRefuses: ended('member'),
    sixtySecondsPass: noLimit,
    joiningPageWithdraws: ended('member'),
    joiningSignalingCloses: s('member', ['11-5']),
    ownerConnectionClosesOrChanges: s('member', ['11-5']),
    roomCloses: s('gone', ['11-7', '11-8'], ['cancelsToken', 'removesPeerFromOwnerList']),
    participantLeaveArrives: s(
      'gone',
      ['11-7', '11-8'],
      ['cancelsToken', 'removesPeerFromOwnerList', 'tellsOwnerConnectionParticipantLeft']
    ),
    ownerReportsLeave: s('gone', ['11-7', '11-8'], ['cancelsToken', 'removesPeerFromOwnerList']),
    returnAccepted: s(
      'member',
      ['11-6', '11-8'],
      ['addsPeerToOwnerList', 'removesOlderPeerFromOwnerList', 'namesNumberAndPeerToOwnerPage'],
      'owner page peer ID'
    ),
    returnButPeerCannotBeAdded: s('member', ['11-6'], [], 'owner away')
  },
  gone: {
    ownerLetsIn: ended('gone'),
    ownerLetsInButPeerCannotBeAdded: notAsked,
    ownerRefuses: ended('gone'),
    sixtySecondsPass: noLimit,
    joiningPageWithdraws: ended('gone'),
    joiningSignalingCloses: s('gone', ['11-4']),
    ownerConnectionClosesOrChanges: s('gone', ['11-4']),
    roomCloses: s('gone', ['11-4']),
    participantLeaveArrives: s('gone', ['11-7'], ['dropsIt']),
    ownerReportsLeave: s('gone', ['11-7'], ['dropsIt']),
    returnAccepted: returnAnsweredFirst,
    returnButPeerCannotBeAdded: returnAnsweredFirst
  }
}
