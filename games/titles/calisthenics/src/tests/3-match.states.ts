// The championship as the host's rules see it (3-match.md). In a state that ends in "Paused", an athlete's
// player is absent or has left (3-4); the part before it names the screen that the championship shows.
export type State =
  | 'lobby'
  | 'lostLobby'
  | 'announcement'
  | 'announcementPaused'
  | 'preparation'
  | 'preparationPaused'
  | 'performing'
  | 'performingPaused'
  | 'resultsDone'
  | 'resultsDonePaused'
  | 'finished'

export type Event =
  // The host starts a match with 2 seated players who have names and are present, with one of them absent,
  // or with one of them unnamed (3-2).
  | 'start'
  | 'startWithAbsent'
  | 'startNotReady'
  // Seat 2 sends a name of 1 to 20 characters after trimming, or one of only spaces, or an appearance (3-1).
  | 'name'
  | 'badName'
  | 'appearance'
  // The host sends train, perform with every plan confirmed, perform with a plan unconfirmed, next,
  // Next athlete for the current turn, or Next athlete for a turn that has ended (3-3, 3-5).
  | 'train'
  | 'perform'
  | 'performUnconfirmed'
  | 'next'
  | 'nextAthlete'
  | 'nextAthleteStale'
  // Seat 2 sends the action that would move the host's current screen on (3-3, 3-5).
  | 'guestAdvances'
  // Seat 2 confirms a plan that can be confirmed (3-3, and 1-4 of 1-preparation.md).
  | 'confirm'
  // The end time of the current turn arrives: of a turn that is not the last, of the last turn of a
  // challenge before the tenth, and of the last turn of the tenth (3-5, 3-3).
  | 'turnEnds'
  | 'lastTurnEnds'
  | 'finalTurnEnds'
  // Seat 2's player is lost or its page hidden. It becomes present (back with its page visible, or visible)
  // while nobody else is absent and no athlete's player has left; while seat 3's player is still absent;
  // while another athlete's player has left. It is back but its page is hidden. It leaves its seat. It leaves
  // its seat and "presence" fails for it (5-10 of netcode 5-matches.md).
  | 'away'
  | 'back'
  | 'backOthersAway'
  | 'backWithLeft'
  | 'backHidden'
  | 'left'
  | 'leaveFails'

export interface Outcome {
  readonly next: State
  // An action is accepted or refused ("step" returns null or the action fails "is action"); a start
  // starts, or the host cannot start ("can start" answers no).
  readonly result?: 'accepted' | 'refused' | 'starts' | 'cannot start'
  readonly detail?:
    | "seat 2's name is trimmed"
    | "seat 2's name and appearance are gone"
    | "seat 2's appearance changes"
    | 'no seated player has a name or an appearance'
    | 'nothing changes, and a running turn keeps its end time'
    | 'the next athlete has twelve seconds'
    | 'the turn keeps its remaining time'
    | 'the turn runs again with its remaining time'
    | 'every athlete has had a turn'
}

export type Cell = {readonly ids: readonly string[]; readonly outcome: Outcome} | {readonly impossible: string}

type Row = {readonly [E in Event]: Cell}

const refused = (next: State, ...ids: string[]): Cell => ({ids, outcome: {next, result: 'refused'}})
const cannotStart = (next: State, ...ids: string[]): Cell => ({ids, outcome: {next, result: 'cannot start'}})
const goes = (next: State, ids: readonly string[], detail?: Outcome['detail']): Cell => ({
  ids,
  outcome: detail === undefined ? {next} : {next, detail}
})

const noTurn = {impossible: '"deadlines" lists a time only while a turn runs and the championship is not paused (3-4, 3-5)'} as const
const pausedTurn = {impossible: 'a paused turn has no end time, so "deadlines" lists none (3-4)'} as const
const nobodyAway = {impossible: 'no athlete player is absent in this state, so none can come back (3-4)'} as const
const noAthletes = {impossible: 'the lobby has no athletes, so no athlete player has left (3-2)'} as const

const lobbyRow = (state: 'lobby' | 'lostLobby'): Row => ({
  start: state === 'lobby' ? {ids: ['3-2'], outcome: {next: 'announcement', result: 'starts'}} : cannotStart(state, '3-2', '3-7'),
  startWithAbsent:
    state === 'lobby' ? {ids: ['3-2', '3-4'], outcome: {next: 'announcementPaused', result: 'starts'}} : cannotStart(state, '3-2', '3-7'),
  startNotReady: cannotStart(state, '3-2'),
  name: {ids: state === 'lobby' ? ['3-1'] : ['3-1', '3-7'], outcome: {next: state, result: 'accepted', detail: "seat 2's name is trimmed"}},
  badName: refused(state, '3-1'),
  appearance: {
    ids: state === 'lobby' ? ['3-1'] : ['3-1', '3-7'],
    outcome: {next: state, result: 'accepted', detail: "seat 2's appearance changes"}
  },
  train: refused(state, '3-3'),
  perform: refused(state, '3-3'),
  performUnconfirmed: refused(state, '3-3'),
  next: refused(state, '3-3'),
  nextAthlete: refused(state, '3-5'),
  nextAthleteStale: refused(state, '3-5'),
  guestAdvances: refused(state, '3-3'),
  confirm: refused(state, '3-3'),
  turnEnds: noTurn,
  lastTurnEnds: noTurn,
  finalTurnEnds: noTurn,
  away: goes(state, ['3-4']),
  back: goes(state, ['3-4']),
  backOthersAway: goes(state, ['3-4']),
  backWithLeft: noAthletes,
  backHidden: goes(state, ['3-4']),
  left: goes(state, ['3-1'], "seat 2's name and appearance are gone"),
  leaveFails: goes(state, ['3-1'], 'no seated player has a name or an appearance')
})

type Timing = 'screen' | 'turn'

const kept = (timing: Timing) => (timing === 'turn' ? 'the turn keeps its remaining time' : undefined)

const screenRow = (state: State, paused: State, timing: Timing, moves: Partial<Row>): Row => ({
  start: cannotStart(state, '3-2'),
  startWithAbsent: cannotStart(state, '3-2'),
  startNotReady: cannotStart(state, '3-2'),
  name: refused(state, '3-1'),
  badName: refused(state, '3-1'),
  appearance: refused(state, '3-1'),
  train: refused(state, '3-3'),
  perform: refused(state, '3-3'),
  performUnconfirmed: refused(state, '3-3'),
  next: refused(state, '3-3', '3-5'),
  nextAthlete: refused(state, '3-5'),
  nextAthleteStale: refused(state, '3-5'),
  guestAdvances: refused(state, '3-3', '3-5'),
  confirm: refused(state, '3-3'),
  turnEnds: noTurn,
  lastTurnEnds: noTurn,
  finalTurnEnds: noTurn,
  away: goes(paused, ['3-4'], kept(timing)),
  back: goes(state, ['3-4'], 'nothing changes, and a running turn keeps its end time'),
  backOthersAway: nobodyAway,
  backWithLeft: nobodyAway,
  backHidden: nobodyAway,
  left: goes(paused, ['3-4'], kept(timing)),
  leaveFails: goes('lostLobby', ['3-1', '3-7'], 'no seated player has a name or an appearance'),
  ...moves
})

const pausedRow = (state: State, unpaused: State, timing: Timing, moves: Partial<Row>): Row => ({
  ...screenRow(state, state, timing, {}),
  train: refused(state, '3-3', '3-4'),
  perform: refused(state, '3-3', '3-4'),
  next: refused(state, '3-3', '3-4'),
  nextAthlete: refused(state, '3-4', '3-5'),
  back: goes(unpaused, ['3-4'], timing === 'turn' ? 'the turn runs again with its remaining time' : undefined),
  backOthersAway: goes(state, ['3-4'], kept(timing)),
  backWithLeft: goes(state, ['3-4'], kept(timing)),
  backHidden: goes(state, ['3-4'], kept(timing)),
  ...moves
})

export const table: {readonly [S in State]: Row} = {
  lobby: lobbyRow('lobby'),
  lostLobby: lobbyRow('lostLobby'),
  announcement: screenRow('announcement', 'announcementPaused', 'screen', {
    train: {ids: ['3-3'], outcome: {next: 'preparation', result: 'accepted'}}
  }),
  announcementPaused: pausedRow('announcementPaused', 'announcement', 'screen', {}),
  preparation: screenRow('preparation', 'preparationPaused', 'screen', {
    perform: {ids: ['3-3', '3-5'], outcome: {next: 'performing', result: 'accepted', detail: 'the next athlete has twelve seconds'}},
    confirm: {ids: ['3-3'], outcome: {next: 'preparation', result: 'accepted'}}
  }),
  preparationPaused: pausedRow('preparationPaused', 'preparation', 'screen', {
    confirm: {ids: ['3-3', '3-4'], outcome: {next: 'preparationPaused', result: 'accepted'}}
  }),
  performing: screenRow('performing', 'performingPaused', 'turn', {
    nextAthlete: {ids: ['3-5'], outcome: {next: 'performing', result: 'accepted', detail: 'the next athlete has twelve seconds'}},
    turnEnds: goes('performing', ['3-5'], 'the next athlete has twelve seconds'),
    lastTurnEnds: goes('resultsDone', ['3-3', '3-5'], 'every athlete has had a turn'),
    finalTurnEnds: goes('finished', ['3-3', '3-5'], 'every athlete has had a turn')
  }),
  performingPaused: pausedRow('performingPaused', 'performing', 'turn', {
    turnEnds: pausedTurn,
    lastTurnEnds: pausedTurn,
    finalTurnEnds: pausedTurn
  }),
  resultsDone: screenRow('resultsDone', 'resultsDonePaused', 'screen', {
    next: {ids: ['3-3'], outcome: {next: 'announcement', result: 'accepted'}}
  }),
  resultsDonePaused: pausedRow('resultsDonePaused', 'resultsDone', 'screen', {}),
  finished: screenRow('finished', 'finished', 'screen', {
    next: refused('finished', '3-3'),
    away: goes('finished', ['3-3']),
    back: goes('finished', ['3-3']),
    backOthersAway: goes('finished', ['3-3']),
    backWithLeft: goes('finished', ['3-3']),
    backHidden: goes('finished', ['3-3']),
    left: goes('finished', ['3-3'])
  })
}
