import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {createGame, isTicTacToe, play, ticTacToe, type TicTacToe} from '../tictactoe.ts'

// Plays the cells in order, X first, and fails the test on any rejected move
const playAll = (cells: number[]): TicTacToe =>
  cells.reduce((game, cell) => {
    const next = play(game, game.turn, cell)
    assert.ok(next, `move ${cell} was rejected`)
    return next
  }, createGame())

describe('createGame', () => {
  it('starts with an empty board and X to move', () => {
    assert.deepEqual(createGame(), {
      board: [null, null, null, null, null, null, null, null, null],
      turn: 'X',
      winner: null,
      line: []
    })
  })
})

describe('play', () => {
  it('places the mark and passes the turn', () => {
    const game = play(createGame(), 'X', 4)

    assert.equal(game?.board[4], 'X')
    assert.equal(game?.turn, 'O')
  })

  it('leaves the previous state untouched', () => {
    const game = createGame()
    play(game, 'X', 0)

    assert.deepEqual(game, createGame())
  })

  it('rejects a move out of turn', () => {
    assert.equal(play(createGame(), 'O', 0), null)
  })

  it('rejects a taken cell', () => {
    assert.equal(play(playAll([0]), 'O', 0), null)
  })

  it('rejects cells off the board', () => {
    for (const cell of [-1, 9, 1.5, Number.NaN]) {
      assert.equal(play(createGame(), 'X', cell), null)
    }
  })

  it('detects a row', () => {
    const game = playAll([0, 3, 1, 4, 2])

    assert.equal(game.winner, 'X')
    assert.deepEqual(game.line, [0, 1, 2])
  })

  it('detects a column', () => {
    const game = playAll([0, 1, 3, 4, 8, 7])

    assert.equal(game.winner, 'O')
    assert.deepEqual(game.line, [1, 4, 7])
  })

  it('detects a diagonal', () => {
    const game = playAll([2, 0, 4, 1, 6])

    assert.equal(game.winner, 'X')
    assert.deepEqual(game.line, [2, 4, 6])
  })

  it('calls a full board without a line a draw', () => {
    const game = playAll([0, 1, 2, 4, 3, 5, 7, 6, 8])

    assert.equal(game.winner, 'draw')
    assert.deepEqual(game.line, [])
  })

  it('counts a line made with the last free cell as a win', () => {
    const game = playAll([0, 2, 1, 3, 4, 6, 5, 7, 8])

    assert.equal(game.winner, 'X')
    assert.deepEqual(game.line, [0, 4, 8])
  })

  it('rejects moves once the game is over', () => {
    assert.equal(play(playAll([0, 3, 1, 4, 2]), 'O', 5), null)
  })
})

describe('isTicTacToe', () => {
  it('accepts games that went over the wire', () => {
    const game = playAll([0, 3, 1, 4, 2])

    assert.equal(isTicTacToe(JSON.parse(JSON.stringify(game))), true)
    assert.equal(isTicTacToe(createGame()), true)
  })

  it('rejects malformed games', () => {
    const valid = createGame()
    const malformed = [
      null,
      'board',
      {...valid, board: valid.board.slice(1)},
      {...valid, board: ['Y', ...valid.board.slice(1)]},
      {...valid, turn: 'Y'},
      {...valid, winner: 'nobody'},
      {...valid, line: [0, 1, 'two']},
      {board: valid.board, turn: 'X', winner: null}
    ]

    for (const value of malformed) {
      assert.equal(isTicTacToe(value), false, JSON.stringify(value))
    }
  })
})

describe('ticTacToe rules', () => {
  it('seats X and O', () => {
    assert.deepEqual(ticTacToe.seats, ['X', 'O'])
  })

  it('accepts board cells as moves', () => {
    assert.equal(ticTacToe.isMove(0), true)
    assert.equal(ticTacToe.isMove(8), true)

    for (const value of [-1, 9, 0.5, '4', null]) {
      assert.equal(ticTacToe.isMove(value), false)
    }
  })

  it('lets only the seat whose turn it is move', () => {
    assert.ok(ticTacToe.applyMove(createGame(), 'X', 0))
    assert.equal(ticTacToe.applyMove(createGame(), 'O', 0), null)
    assert.equal(ticTacToe.applyMove(createGame(), 'spectator', 0), null)
  })

  it('is over once there is a winner or a draw', () => {
    assert.equal(ticTacToe.isOver(createGame()), false)
    assert.equal(ticTacToe.isOver(playAll([0, 3, 1, 4, 2])), true)
  })
})
