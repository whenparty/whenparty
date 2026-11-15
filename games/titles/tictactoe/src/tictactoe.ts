import type {Context, Json, PresenceEvent, Rules, Title} from '@whenparty/netcode'

export type Mark = 'X' | 'O'
export type Cell = Mark | null

export interface Away {
  readonly lost: boolean
  readonly hiddenSince: number | null
}

export type Result =
  | {readonly kind: 'win'; readonly mark: Mark; readonly cells: readonly number[]}
  | {readonly kind: 'draw'}
  | {readonly kind: 'hidden'; readonly seat: Mark}
  | {readonly kind: 'left'; readonly seat: Mark}

export interface Game {
  readonly board: readonly Cell[]
  readonly turn: Mark
  readonly away: {readonly X: Away; readonly O: Away}
  readonly result: Result | null
}

export interface Move {
  readonly cell: number
  readonly board: readonly Cell[]
}

export const marks: readonly Mark[] = ['X', 'O']

export const hiddenLimitMs = 600_000

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

const present: Away = {lost: false, hiddenSince: null}

export const newGame = (): Game => ({board: Array<Cell>(9).fill(null), turn: 'X', away: {X: present, O: present}, result: null})

const isRecord = (value: unknown): value is {readonly [key: string]: unknown} =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isMark = (value: unknown): value is Mark => value === 'X' || value === 'O'

const isCell = (value: unknown): value is Cell => value === null || isMark(value)

const isIndex = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) < 9

const isBoard = (value: unknown): value is readonly Cell[] => Array.isArray(value) && value.length === 9 && value.every(isCell)

const isAway = (value: unknown): value is Away =>
  isRecord(value) &&
  typeof value.lost === 'boolean' &&
  (value.hiddenSince === null || (Number.isSafeInteger(value.hiddenSince) && Number(value.hiddenSince) >= 0))

const isResult = (value: unknown): value is Result => {
  if (value === null) {
    return true
  }
  if (!isRecord(value)) {
    return false
  }
  switch (value.kind) {
    case 'win':
      return isMark(value.mark) && Array.isArray(value.cells) && value.cells.every(isIndex)
    case 'draw':
      return true
    case 'hidden':
    case 'left':
      return isMark(value.seat)
    default:
      return false
  }
}

export const isGame = (value: unknown): value is Game =>
  isRecord(value) &&
  isBoard(value.board) &&
  isMark(value.turn) &&
  isRecord(value.away) &&
  isAway(value.away.X) &&
  isAway(value.away.O) &&
  isResult(value.result)

export const isMove = (value: unknown): value is Move => isRecord(value) && isIndex(value.cell) && isBoard(value.board)

export const isOver = (game: Game): boolean => game.result !== null

export const isPaused = (game: Game): boolean => marks.some(mark => game.away[mark].lost || game.away[mark].hiddenSince !== null)

const winningCells = (board: readonly Cell[], mark: Mark): number[] => [
  ...new Set(lines.filter(line => line.every(cell => board[cell] === mark)).flat())
]

export const play = (game: Game, seat: string, move: unknown): Game | null => {
  if (!isMove(move) || isOver(game) || isPaused(game) || seat !== game.turn || game.board[move.cell] !== null) {
    return null
  }
  if (move.board.some((cell, index) => cell !== game.board[index])) {
    return null
  }
  const board = game.board.with(move.cell, game.turn)
  const cells = winningCells(board, game.turn)
  const result: Result | null = cells.length > 0 ? {kind: 'win', mark: game.turn, cells} : board.every(Boolean) ? {kind: 'draw'} : null
  return {...game, board, turn: game.turn === 'X' ? 'O' : 'X', result}
}

export const notePresence = (game: Game, seat: string, event: PresenceEvent, roomTime: number): Game => {
  if (isOver(game) || !isMark(seat)) {
    return game
  }
  const away = game.away[seat]
  const changed = (next: Away): Game => ({...game, away: {...game.away, [seat]: next}})
  switch (event) {
    case 'lost':
      return changed({...away, lost: true})
    case 'back':
      return changed({...away, lost: false})
    case 'hidden':
      return away.hiddenSince === null ? changed({...away, hiddenSince: roomTime}) : game
    case 'visible':
      return changed({...away, hiddenSince: null})
    case 'left':
      return {...game, result: {kind: 'left', seat}}
  }
}

export const hiddenDeadlines = (game: Game): number[] =>
  isOver(game)
    ? []
    : marks.flatMap(mark => {
        const since = game.away[mark].hiddenSince
        return since === null ? [] : [since + hiddenLimitMs]
      })

export const passDeadline = (game: Game, time: number): Game => {
  if (isOver(game)) {
    return game
  }
  const seat = marks.find(mark => {
    const since = game.away[mark].hiddenSince
    return since !== null && since + hiddenLimitMs <= time
  })
  return seat === undefined ? game : {...game, result: {kind: 'hidden', seat}}
}

const asJson = (game: Game): Json => game as unknown as Json
const asGame = (state: Json): Game => state as unknown as Game

export const rules: Rules = {
  seats: () => marks,
  initialState: () => asJson(newGame()),
  step: (state, seat, action) => {
    const next = play(asGame(state), seat, action)
    return next === null ? null : asJson(next)
  },
  over: state => isOver(asGame(state)),
  isAction: isMove,
  isState: isGame,
  presence: (state, seat, event, context: Context) => asJson(notePresence(asGame(state), seat, event, context.roomTime)),
  deadlines: state => hiddenDeadlines(asGame(state)),
  deadline: (state, time) => asJson(passDeadline(asGame(state), time))
}

export const title: Title = {appId: 'when.party/tictactoe', waitingSeconds: 600, formatVersion: 1, rules}
