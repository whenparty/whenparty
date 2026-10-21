// Tic-tac-toe rules. Pure functions over plain JSON data, so the host can run them and
// every peer can render the result.
import type {GameRules, SeatPresence} from '@whenparty/p2p'

export type Mark = 'X' | 'O'
export type Cell = Mark | null

export interface TicTacToe {
  // Nine cells, row by row
  board: Cell[]
  turn: Mark
  winner: Mark | 'draw' | null
  // The three winning cells, empty until someone wins
  line: number[]
  // Players that are not here right now. Nobody moves until they are back.
  waitingFor: Mark[]
  // The player that left a match in progress, which ends it
  abandonedBy: Mark | null
}

const marks: readonly Mark[] = ['X', 'O']

const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
]

export const createGame = (): TicTacToe => ({
  board: Array<Cell>(9).fill(null),
  turn: 'X',
  winner: null,
  line: [],
  waitingFor: [],
  abandonedBy: null
})

const isCellIndex = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) < 9

const isMark = (value: unknown): value is Mark => value === 'X' || value === 'O'

const findLine = (board: Cell[], mark: Mark) => lines.find(line => line.every(cell => board[cell] === mark)) ?? []

const isOver = (game: TicTacToe) => game.winner !== null || game.abandonedBy !== null

// The next state, or null when the move is not allowed
export const play = (game: TicTacToe, mark: Mark, cell: number): TicTacToe | null => {
  if (isOver(game) || game.waitingFor.length > 0 || mark !== game.turn || !isCellIndex(cell) || game.board[cell]) {
    return null
  }

  const board = game.board.with(cell, mark)
  const line = findLine(board, mark)
  const winner = line.length > 0 ? mark : board.every(Boolean) ? 'draw' : null

  return {...game, board, turn: mark === 'X' ? 'O' : 'X', winner, line}
}

// The match waits for a player that is not here. One that is gone for good ends a match in
// progress. Before the first move, its seat just goes to the next player.
export const notePresence = (game: TicTacToe, mark: Mark, presence: SeatPresence): TicTacToe => {
  const waitingFor = game.waitingFor.filter(each => each !== mark)

  if (presence === 'lost') {
    return {...game, waitingFor: [...waitingFor, mark]}
  }

  const started = game.board.some(Boolean)

  return {...game, waitingFor, abandonedBy: presence === 'left' && started && !isOver(game) ? mark : game.abandonedBy}
}

export const isTicTacToe = (value: unknown): value is TicTacToe => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const {board, turn, winner, line, waitingFor, abandonedBy} = value as Record<string, unknown>

  return (
    Array.isArray(board) &&
    board.length === 9 &&
    board.every(cell => cell === null || isMark(cell)) &&
    isMark(turn) &&
    (winner === null || winner === 'draw' || isMark(winner)) &&
    Array.isArray(line) &&
    line.every(isCellIndex) &&
    Array.isArray(waitingFor) &&
    waitingFor.every(isMark) &&
    (abandonedBy === null || isMark(abandonedBy))
  )
}

export const ticTacToe: GameRules<TicTacToe, number> = {
  seats: marks,
  createState: createGame,
  applyMove: (game, seat, cell) => (isMark(seat) ? play(game, seat, cell) : null),
  isOver,
  onPresence: (game, seat, presence) => (isMark(seat) ? notePresence(game, seat, presence) : game),
  isMove: isCellIndex,
  isState: isTicTacToe
}
