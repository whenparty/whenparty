import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {Context, Json} from '@whenparty/netcode'
import {
  hiddenDeadlines,
  isPaused,
  newGame,
  notePresence,
  passDeadline,
  play,
  rules,
  title,
  type Cell,
  type Game,
  type Mark
} from '../tictactoe.ts'
import {table} from './1-rules.states.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']

const X: Mark = 'X'
const O: Mark = 'O'
const _ = null

const board = (...cells: Cell[]): Cell[] => cells

const context = (roomTime: number): Context => ({
  roomTime,
  seats: {X: {taken: true, lost: false, hidden: false}, O: {taken: true, lost: false, hidden: false}}
})

const withAway = (game: Game, mark: Mark, away: Partial<Game['away'][Mark]>): Game => ({
  ...game,
  away: {...game.away, [mark]: {...game.away[mark], ...away}}
})

const present = {lost: false, hiddenSince: null}

const xToMove = (cells: Cell[]): Game => ({board: cells, turn: X, away: {X: present, O: present}, result: null})

const boardFor = (event: Event): Game => {
  if (event === 'moveWins') {
    return xToMove(board(X, X, _, O, O, _, _, _, _))
  }
  if (event === 'moveFillsBoard') {
    return xToMove(board(X, O, X, X, O, O, O, X, _))
  }
  return xToMove(board(_, _, _, _, O, _, _, _, X))
}

const setups: {readonly [S in State]: (event: Event) => Game} = {
  running: boardFor,
  paused: event => {
    const game = boardFor(event)
    if (event === 'lost' || event === 'hiddenCountRunning' || event === 'hiddenTooLong' || event === 'visibleAlreadyVisible') {
      return withAway(game, X, {hiddenSince: 1000})
    }
    if (event === 'hiddenTooLongTwoAtOnce') {
      return withAway(withAway(game, X, {hiddenSince: 1000}), O, {hiddenSince: 1000})
    }
    if (event === 'backStillHidden') {
      return withAway(game, X, {lost: true, hiddenSince: 1000})
    }
    if (event === 'backOrVisibleThenVisibleSomeAway' || event === 'backOrVisibleAllPresent') {
      return withAway(withAway(game, X, {hiddenSince: 1000}), O, {lost: true})
    }
    return withAway(game, O, {lost: true})
  },
  over: event => {
    const game = xToMove(event === 'moveFillsBoard' ? board(X, O, X, X, O, O, O, X, _) : board(_, _, _, O, X, O, X, _, _))
    if (event.startsWith('move')) {
      return {...game, result: {kind: 'left', seat: O}}
    }
    return {...game, away: {X: {lost: false, hiddenSince: 1000}, O: {lost: false, hiddenSince: 0}}, result: {kind: 'hidden', seat: O}}
  }
}

const move = (game: Game, cell: number, seat: Mark = game.turn): Game | null => play(game, seat, {cell, board: [...game.board]})

interface Applied {
  readonly before: Game
  readonly after: Game
  readonly accepted?: boolean
}

const events: {readonly [E in Event]: (game: Game) => Applied | readonly Applied[]} = {
  moveValid: game => apply(game, move(game, 0)),
  moveWins: game => apply(game, move(game, 2)),
  moveFillsBoard: game => apply(game, move(game, 8)),
  moveWrongSeat: game => apply(game, move(game, 0, game.turn === X ? O : X)),
  moveTakenCell: game => {
    assert.notEqual(game.board[4], null)
    return apply(game, move(game, 4))
  },
  moveOtherBoard: game => apply(game, play(game, game.turn, {cell: 0, board: board(O, _, _, _, _, _, _, _, _)})),
  moveNotAMove: game => {
    assert.equal(rules.isAction('x'), false)
    return apply(game, play(game, game.turn, 'x'))
  },
  lost: game => ({before: game, after: notePresence(game, X, 'lost', 2000)}),
  hiddenCountNotRunning: game => {
    const hidden = game.away.O.lost ? O : X
    return {before: game, after: notePresence(game, hidden, 'hidden', 2000)}
  },
  hiddenCountRunning: game => ({before: game, after: notePresence(game, X, 'hidden', 5000)}),
  backStillHidden: game => ({before: game, after: notePresence(game, X, 'back', 3000)}),
  backOrVisibleAllPresent: game => ({before: game, after: notePresence(notePresence(game, X, 'visible', 3000), O, 'back', 3000)}),
  backOrVisibleThenVisibleSomeAway: game => {
    const lost = withAway(game, X, {lost: true})
    return [
      {before: game, after: notePresence(game, X, 'visible', 3000)},
      {before: lost, after: notePresence(notePresence(lost, X, 'back', 3000), X, 'visible', 3000)}
    ]
  },
  visibleAlreadyVisible: game => ({before: game, after: notePresence(game, O, 'visible', 3000)}),
  left: game => ({before: game, after: notePresence(game, O, 'left', 3000)}),
  hiddenTooLong: game => ({before: game, after: passDeadline(game, 601_000)}),
  hiddenTooLongTwoAtOnce: game => ({before: game, after: passDeadline(game, 601_000)})
}

const apply = (before: Game, next: Game | null): Applied => ({before, after: next ?? before, accepted: next !== null})

const stateOf = (game: Game): State => (game.result !== null ? 'over' : isPaused(game) ? 'paused' : 'running')

const check = (state: State, event: Event, outcome: Outcome): void => {
  for (const applied of [events[event](setups[state](event))].flat()) {
    checkApplied(applied, outcome)
  }
}

const checkApplied = ({before, after, accepted}: Applied, outcome: Outcome): void => {
  assert.equal(stateOf(after), outcome.next)
  if (outcome.move !== undefined) {
    assert.equal(accepted, outcome.move === 'accepted')
  }
  if (outcome.board === 'unchanged' || outcome.state === 'as it is') {
    assert.deepEqual(after.board, before.board)
    assert.equal(after.turn, before.turn)
  }
  if (outcome.state === 'as it is') {
    assert.deepEqual(after, before)
  }
  if (outcome.board === "the cell gets the seat's mark, and the other seat is to move") {
    assert.equal(after.board[0], before.turn)
    assert.notEqual(after.turn, before.turn)
  }
  switch (outcome.result) {
    case 'the mark wins, with its winning cells':
      assert.deepEqual(after.result, {kind: 'win', mark: X, cells: [0, 1, 2]})
      break
    case 'draw':
      assert.deepEqual(after.result, {kind: 'draw'})
      break
    case 'no winner, naming the seat away too long':
    case 'no winner, naming the first such seat in seat order':
      assert.deepEqual(after.result, {kind: 'hidden', seat: X})
      break
    case 'no winner, naming the seat that left':
      assert.deepEqual(after.result, {kind: 'left', seat: O})
  }
  switch (outcome.hiddenCount) {
    case 'starts for that player':
      assert.ok(after.away.X.hiddenSince === 2000 || after.away.O.hiddenSince === 2000)
      break
    case 'goes on':
      assert.deepEqual(hiddenDeadlines(after), hiddenDeadlines(before))
      break
    case 'stops for that player':
      assert.equal(after.away.X.hiddenSince, null)
      assert.equal(after.away.O.lost, true)
      break
    case 'stops for every player':
      assert.deepEqual(hiddenDeadlines(after), [])
  }
}

for (const [state, cells] of Object.entries(table)) {
  for (const [event, cell] of Object.entries(cells)) {
    if ('ids' in cell) {
      test(`${cell.ids.join(' ')} ${state}, ${event}`, () => check(state as State, event as Event, cell.outcome as Outcome))
    }
  }
}

test('1-1 the title gives the netcode its app ID, waiting time, format version and two seats', () => {
  assert.deepEqual([title.appId, title.waitingSeconds, title.formatVersion, rules.seats()], ['when.party/tictactoe', 600, 1, ['X', 'O']])
  assert.equal(rules.admit, undefined)
  assert.equal(rules.canStart, undefined)
  assert.deepEqual(rules.initialState(0, context(0)), {
    board: [null, null, null, null, null, null, null, null, null],
    turn: 'X',
    away: {X: {lost: false, hiddenSince: null}, O: {lost: false, hiddenSince: null}},
    result: null
  })
})

test('1-3 a move is refused when its cell is off the board or its board is malformed', () => {
  const game = xToMove(board(_, _, _, _, O, _, _, _, X))
  const refused = (action: Json): boolean =>
    !rules.isAction(action) || rules.step(game as unknown as Json, X, action, 0, context(0)) === null
  for (const cell of [-1, 9, 1.5, '0', null]) {
    assert.equal(refused({cell, board: [...game.board]}), true, `cell ${String(cell)}`)
  }
  for (const malformed of [game.board.slice(0, 8), [...game.board, null], ['Z', ...game.board.slice(1)], 'XO', null] as Json[]) {
    assert.equal(refused({cell: 0, board: malformed}), true, `board ${JSON.stringify(malformed)}`)
  }
  assert.equal(refused({cell: 0}), true)
  assert.equal(refused({cell: 0, board: [...game.board]}), false)
})

test('1-4 a column or a diagonal wins, and the winning cells are those of every line of the mark', () => {
  assert.deepEqual(move(xToMove(board(X, O, _, X, O, _, _, _, _)), 6)?.result, {kind: 'win', mark: X, cells: [0, 3, 6]})
  assert.deepEqual(move(xToMove(board(X, O, O, _, X, _, _, _, _)), 8)?.result, {kind: 'win', mark: X, cells: [0, 4, 8]})
  assert.deepEqual(move(xToMove(board(X, X, _, O, X, O, X, O, O)), 2)?.result, {kind: 'win', mark: X, cells: [0, 1, 2, 4, 6]})
})

test('1-4 1-5 a move that fills the board and makes a line wins, not a draw', () => {
  assert.deepEqual(move(xToMove(board(X, O, X, O, X, O, O, X, _)), 8)?.result, {kind: 'win', mark: X, cells: [0, 4, 8]})
})

test('1-7 the hidden count runs 600 seconds of room time', () => {
  const game = notePresence(newGame(), O, 'hidden', 1000)
  assert.deepEqual(rules.deadlines?.(game as unknown as Json), [601_000])
  assert.equal(passDeadline(game, 600_999).result, null)
  assert.deepEqual(passDeadline(game, 601_000).result, {kind: 'hidden', seat: O})
})

test('1-7 the seat that reaches 600 seconds first is named', () => {
  const game = notePresence(notePresence(newGame(), X, 'hidden', 2000), O, 'hidden', 1000)
  assert.deepEqual(passDeadline(game, 601_000).result, {kind: 'hidden', seat: O})
})

test('1-9 once over, a hidden count asks for no deadline', () => {
  const over = setups.over('lost')
  assert.notEqual(over.away.X.hiddenSince, null)
  assert.deepEqual(rules.deadlines?.(over as unknown as Json), [])
})
