// Tic-tac-toe rules. Pure functions over plain JSON data, so the host can run them and
// every peer can render the result.
import type {GameRules} from '@whenparty/p2p'

export type Mark = 'X' | 'O'
export type Cell = Mark | null

export interface TicTacToe {
  // Nine cells, row by row
  board: Cell[]
  turn: Mark
  winner: Mark | 'draw' | null
  // The three winning cells, empty until someone wins
  line: number[]
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
  line: []
})

const isCellIndex = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) < 9

const isMark = (value: unknown): value is Mark => value === 'X' || value === 'O'

const findLine = (board: Cell[], mark: Mark) => lines.find(line => line.every(cell => board[cell] === mark)) ?? []

// The next state, or null when the move is not allowed
export const play = (game: TicTacToe, mark: Mark, cell: number): TicTacToe | null => {
  if (game.winner || mark !== game.turn || !isCellIndex(cell) || game.board[cell]) {
    return null
  }

  const board = game.board.with(cell, mark)
  const line = findLine(board, mark)
  const winner = line.length > 0 ? mark : board.every(Boolean) ? 'draw' : null

  return {board, turn: mark === 'X' ? 'O' : 'X', winner, line}
}

export const isTicTacToe = (value: unknown): value is TicTacToe => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const {board, turn, winner, line} = value as Record<string, unknown>

  return (
    Array.isArray(board) &&
    board.length === 9 &&
    board.every(cell => cell === null || isMark(cell)) &&
    isMark(turn) &&
    (winner === null || winner === 'draw' || isMark(winner)) &&
    Array.isArray(line) &&
    line.every(isCellIndex)
  )
}

export const ticTacToe: GameRules<TicTacToe, number> = {
  seats: marks,
  createState: createGame,
  applyMove: (game, seat, cell) => (isMark(seat) ? play(game, seat, cell) : null),
  isOver: game => game.winner !== null,
  isMove: isCellIndex,
  isState: isTicTacToe
}
