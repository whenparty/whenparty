type State = 'running' | 'paused' | 'over'

type Event =
  | 'moveValid'
  | 'moveWins'
  | 'moveFillsBoard'
  | 'moveWrongSeat'
  | 'moveTakenCell'
  | 'moveOtherBoard'
  | 'moveNotAMove'
  | 'lost'
  | 'hiddenCountNotRunning'
  | 'hiddenCountRunning'
  | 'backStillHidden'
  | 'backOrVisibleAllPresent'
  | 'backOrVisibleThenVisibleSomeAway'
  | 'visibleAlreadyVisible'
  | 'left'
  | 'hiddenTooLong'
  | 'hiddenTooLongTwoAtOnce'

type Outcome = {
  readonly next: State
  readonly move?: 'accepted' | 'refused'
  readonly board?: "the cell gets the seat's mark, and the other seat is to move" | 'unchanged'
  readonly result?:
    | 'the mark wins, with its winning cells'
    | 'draw'
    | 'no winner, naming the seat away too long'
    | 'no winner, naming the first such seat in seat order'
    | 'no winner, naming the seat that left'
  readonly hiddenCount?: 'starts for that player' | 'goes on' | 'stops for that player' | 'stops for every player'
  readonly state?: 'as it is'
}

type Cell<O> = {readonly ids: readonly string[]; readonly outcome: O} | {readonly impossible: string}

const nobodyAway = {impossible: 'while the match is not paused, no player is lost or hidden, so no count runs (1-6, 1-7)'} as const
const refusedPaused = {ids: ['1-2', '1-3'], outcome: {next: 'paused', move: 'refused', board: 'unchanged'}} as const
const refusedOver = {ids: ['1-2', '1-3'], outcome: {next: 'over', move: 'refused', board: 'unchanged'}} as const
const overStays = {ids: ['1-9'], outcome: {next: 'over', state: 'as it is'}} as const

export const table: {readonly [S in State]: {readonly [E in Event]: Cell<Outcome>}} = {
  running: {
    moveValid: {
      ids: ['1-2'],
      outcome: {next: 'running', move: 'accepted', board: "the cell gets the seat's mark, and the other seat is to move"}
    },
    moveWins: {ids: ['1-2', '1-4'], outcome: {next: 'over', move: 'accepted', result: 'the mark wins, with its winning cells'}},
    moveFillsBoard: {ids: ['1-2', '1-5'], outcome: {next: 'over', move: 'accepted', result: 'draw'}},
    moveWrongSeat: {ids: ['1-3'], outcome: {next: 'running', move: 'refused', board: 'unchanged'}},
    moveTakenCell: {ids: ['1-3'], outcome: {next: 'running', move: 'refused', board: 'unchanged'}},
    moveOtherBoard: {ids: ['1-3'], outcome: {next: 'running', move: 'refused', board: 'unchanged'}},
    moveNotAMove: {ids: ['1-3'], outcome: {next: 'running', move: 'refused', board: 'unchanged'}},
    lost: {ids: ['1-6'], outcome: {next: 'paused', board: 'unchanged'}},
    hiddenCountNotRunning: {ids: ['1-6', '1-7'], outcome: {next: 'paused', board: 'unchanged', hiddenCount: 'starts for that player'}},
    hiddenCountRunning: nobodyAway,
    backStillHidden: nobodyAway,
    backOrVisibleAllPresent: nobodyAway,
    backOrVisibleThenVisibleSomeAway: nobodyAway,
    visibleAlreadyVisible: {ids: ['1-6'], outcome: {next: 'running', board: 'unchanged'}},
    left: {ids: ['1-8'], outcome: {next: 'over', result: 'no winner, naming the seat that left'}},
    hiddenTooLong: nobodyAway,
    hiddenTooLongTwoAtOnce: nobodyAway
  },
  paused: {
    moveValid: refusedPaused,
    moveWins: refusedPaused,
    moveFillsBoard: refusedPaused,
    moveWrongSeat: refusedPaused,
    moveTakenCell: refusedPaused,
    moveOtherBoard: refusedPaused,
    moveNotAMove: refusedPaused,
    lost: {ids: ['1-6', '1-7'], outcome: {next: 'paused', board: 'unchanged', hiddenCount: 'goes on'}},
    hiddenCountNotRunning: {ids: ['1-6', '1-7'], outcome: {next: 'paused', board: 'unchanged', hiddenCount: 'starts for that player'}},
    hiddenCountRunning: {ids: ['1-7'], outcome: {next: 'paused', board: 'unchanged', hiddenCount: 'goes on'}},
    backStillHidden: {ids: ['1-6', '1-7'], outcome: {next: 'paused', board: 'unchanged', hiddenCount: 'goes on'}},
    backOrVisibleAllPresent: {ids: ['1-6', '1-7'], outcome: {next: 'running', board: 'unchanged', hiddenCount: 'stops for every player'}},
    backOrVisibleThenVisibleSomeAway: {
      ids: ['1-6', '1-7'],
      outcome: {next: 'paused', board: 'unchanged', hiddenCount: 'stops for that player'}
    },
    visibleAlreadyVisible: {ids: ['1-6'], outcome: {next: 'paused', board: 'unchanged', hiddenCount: 'goes on'}},
    left: {ids: ['1-8'], outcome: {next: 'over', result: 'no winner, naming the seat that left'}},
    hiddenTooLong: {ids: ['1-7'], outcome: {next: 'over', result: 'no winner, naming the seat away too long'}},
    hiddenTooLongTwoAtOnce: {ids: ['1-7'], outcome: {next: 'over', result: 'no winner, naming the first such seat in seat order'}}
  },
  over: {
    moveValid: refusedOver,
    moveWins: refusedOver,
    moveFillsBoard: refusedOver,
    moveWrongSeat: refusedOver,
    moveTakenCell: refusedOver,
    moveOtherBoard: refusedOver,
    moveNotAMove: refusedOver,
    lost: overStays,
    hiddenCountNotRunning: overStays,
    hiddenCountRunning: overStays,
    backStillHidden: overStays,
    backOrVisibleAllPresent: overStays,
    backOrVisibleThenVisibleSomeAway: overStays,
    visibleAlreadyVisible: overStays,
    left: overStays,
    hiddenTooLong: overStays,
    hiddenTooLongTwoAtOnce: overStays
  }
}
