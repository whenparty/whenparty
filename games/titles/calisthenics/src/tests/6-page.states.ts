// The page of either interface and the actions it keeps (6-page.md).
export type State = 'start' | 'inRoom' | 'keeping' | 'over'

export type Event =
  // On the start screen: Create a room; the form with a room code; the form with text that is no code.
  | 'create'
  | 'submitCode'
  | 'submitNoCode'
  // The page opens at an address with a room code; the page reloads at an address with a room code, or at
  // one without (before the code arrived, after starting failed, or after the code was removed).
  | 'openWithCode'
  | 'reload'
  | 'reloadNoCode'
  // The part of the address after `#` changes to another room's code; to the page's own code, to text that
  // is no code, or to nothing.
  | 'addressOtherCode'
  | 'addressNoChange'
  | 'leavePressed'
  // The netcode tells the host's page of a join request.
  | 'joinRequest'
  // A seated player's action while the page can act; while it cannot; an appearance change while the last
  // kept action is one; a name while a name is kept.
  | 'action'
  | 'actionCannotAct'
  | 'appearanceKept'
  | 'nameKept'
  // The netcode tells that the page can act, and: one action is kept, of the screen of the last snapshot;
  // two are kept, the first of that screen; two are kept, the first of another screen; two are kept, and the
  // netcode answers the first "too large".
  | 'canActOne'
  | 'canActSeveral'
  | 'canActStale'
  | 'canActTooLarge'
  // Starting or entering fails, or the game ends.
  | 'gameEnds'

export interface Outcome {
  readonly next: State
  readonly screen: 'start' | 'room'
  readonly leaveButton: boolean
  readonly netcode?: 'starts a game' | 'enters the game' | 'leaves, then enters the other game' | 'leaves the game' | 'nothing'
  readonly formError?: 'That is not a room code. Codes have 5 characters, like K7MXQ.'
  readonly address?: 'ends in # and the code' | 'no room code'
  readonly request?: 'let in'
  readonly sent?: 'the action' | 'the first kept action' | 'the second kept action' | 'nothing'
  readonly kept?: 'added' | 'merged into the last' | 'replaces the kept name' | 'one left' | 'none left'
}

export type Cell = {readonly ids: readonly string[]; readonly outcome: Outcome} | {readonly impossible: string}

type Row = {readonly [E in Event]: Cell}

const room = {screen: 'room', leaveButton: true} as const
const noGame = {impossible: 'without a game the netcode tells the page nothing and the page shows no actions (6-2)'} as const
const noStartScreen = {impossible: 'the room is shown in place of the start screen (6-2)'} as const
const alreadyOpen = {impossible: 'the page is already open; it opens again only by a reload'} as const
const nothingKept = {impossible: 'the page keeps no action in this state (6-5)'} as const
const sendsAtOnce = {impossible: 'the page sends a kept action as soon as the netcode tells it can act, so it cannot act while it keeps one (6-5)'} as const
const ended = {impossible: 'after starting or entering fails or the game ends, the room shows no controls for actions (6-2) and the netcode tells the page nothing more (2-7 of netcode 2-page.md)'} as const
const startsAnew = (kept?: Outcome['kept']): Cell => ({
  ids: kept ? ['6-1', '6-5'] : ['6-1'],
  outcome: {next: 'start', screen: 'start', leaveButton: false, netcode: 'nothing', ...(kept ? {kept} : {})}
})
const enters = (next: State, ids: readonly string[], kept?: Outcome['kept']): Cell => ({
  ids,
  outcome: {next, ...room, netcode: 'enters the game', address: 'ends in # and the code', ...(kept ? {kept} : {})}
})

const inGame = (state: 'inRoom' | 'keeping'): Row => {
  const dropped = state === 'keeping' ? ('none left' as const) : undefined
  const dropIds = state === 'keeping' ? ['6-5'] : []
  return {
    create: noStartScreen,
    submitCode: noStartScreen,
    submitNoCode: noStartScreen,
    openWithCode: alreadyOpen,
    reload: enters('inRoom', ['6-1', ...dropIds], dropped),
    reloadNoCode: startsAnew(dropped),
    addressOtherCode: {
      ids: ['6-3', ...dropIds],
      outcome: {next: 'inRoom', ...room, netcode: 'leaves, then enters the other game', ...(dropped ? {kept: dropped} : {})}
    },
    addressNoChange: {ids: ['6-3'], outcome: {next: state, ...room, netcode: 'nothing'}},
    leavePressed: {
      ids: ['6-2', ...dropIds],
      outcome: {next: 'start', screen: 'start', leaveButton: false, netcode: 'leaves the game', address: 'no room code', ...(dropped ? {kept: dropped} : {})}
    },
    joinRequest: {ids: ['6-4'], outcome: {next: state, ...room, request: 'let in'}},
    action: state === 'inRoom' ? {ids: ['6-5'], outcome: {next: 'inRoom', ...room, sent: 'the action'}} : sendsAtOnce,
    actionCannotAct: {ids: ['6-5'], outcome: {next: 'keeping', ...room, sent: 'nothing', kept: 'added'}},
    appearanceKept: state === 'keeping' ? {ids: ['6-5'], outcome: {next: 'keeping', ...room, sent: 'nothing', kept: 'merged into the last'}} : nothingKept,
    nameKept: state === 'keeping' ? {ids: ['6-5'], outcome: {next: 'keeping', ...room, sent: 'nothing', kept: 'replaces the kept name'}} : nothingKept,
    canActOne: state === 'keeping' ? {ids: ['6-5'], outcome: {next: 'inRoom', ...room, sent: 'the first kept action', kept: 'none left'}} : nothingKept,
    canActSeveral: state === 'keeping' ? {ids: ['6-5'], outcome: {next: 'keeping', ...room, sent: 'the first kept action', kept: 'one left'}} : nothingKept,
    canActStale: state === 'keeping' ? {ids: ['6-5'], outcome: {next: 'inRoom', ...room, sent: 'the second kept action', kept: 'none left'}} : nothingKept,
    canActTooLarge: state === 'keeping' ? {ids: ['6-5'], outcome: {next: 'inRoom', ...room, sent: 'the second kept action', kept: 'none left'}} : nothingKept,
    gameEnds: {ids: ['6-2', ...dropIds], outcome: {next: 'over', ...room, ...(dropped ? {kept: dropped} : {})}}
  }
}

export const table: {readonly [S in State]: Row} = {
  start: {
    create: {ids: ['6-1', '6-2'], outcome: {next: 'inRoom', ...room, netcode: 'starts a game'}},
    submitCode: enters('inRoom', ['6-1', '6-2']),
    submitNoCode: {
      ids: ['6-1'],
      outcome: {next: 'start', screen: 'start', leaveButton: false, netcode: 'nothing', formError: 'That is not a room code. Codes have 5 characters, like K7MXQ.'}
    },
    openWithCode: enters('inRoom', ['6-1', '6-2']),
    reload: enters('inRoom', ['6-1', '6-2']),
    reloadNoCode: startsAnew(),
    addressOtherCode: enters('inRoom', ['6-3']),
    addressNoChange: {ids: ['6-3'], outcome: {next: 'start', screen: 'start', leaveButton: false, netcode: 'nothing'}},
    leavePressed: {impossible: 'the start screen has no Leave the room button (6-2)'},
    joinRequest: noGame,
    action: noGame,
    actionCannotAct: noGame,
    appearanceKept: noGame,
    nameKept: noGame,
    canActOne: noGame,
    canActSeveral: noGame,
    canActStale: noGame,
    canActTooLarge: noGame,
    gameEnds: noGame
  },
  inRoom: inGame('inRoom'),
  keeping: inGame('keeping'),
  over: {
    create: noStartScreen,
    submitCode: noStartScreen,
    submitNoCode: noStartScreen,
    openWithCode: alreadyOpen,
    reload: enters('inRoom', ['6-1']),
    reloadNoCode: startsAnew(),
    addressOtherCode: enters('inRoom', ['6-3']),
    addressNoChange: {ids: ['6-3'], outcome: {next: 'over', ...room, netcode: 'nothing'}},
    leavePressed: {ids: ['6-2'], outcome: {next: 'start', screen: 'start', leaveButton: false, netcode: 'nothing', address: 'no room code'}},
    joinRequest: ended,
    action: ended,
    actionCannotAct: ended,
    appearanceKept: ended,
    nameKept: ended,
    canActOne: ended,
    canActSeveral: ended,
    canActStale: ended,
    canActTooLarge: ended,
    gameEnds: ended
  }
}
