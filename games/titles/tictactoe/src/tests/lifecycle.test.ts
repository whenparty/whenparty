import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {applyIntent, createRoomState, dropPlayer, joinPlayer, syncPresence} from '@whenparty/p2p'
import {ticTacToe} from '../tictactoe.ts'

const member = (id: string) => ({playerId: id, peerId: id})
const admittedMatch = () => ['b', 'c'].reduce((room, id) => joinPlayer(room, member(id)), createRoomState(ticTacToe, member('a')))

describe('room lifecycle', () => {
  it('blocks the missing player and resumes the same board and turn after a reload', () => {
    const played = applyIntent(ticTacToe, admittedMatch(), 'a', {type: 'move', move: 0, id: 1})
    const missing = syncPresence(ticTacToe, played, {...played, reservations: {b: 50}})
    const blocked = applyIntent(ticTacToe, missing, 'b', {type: 'move', move: 1, id: 1})
    assert.deepEqual(blocked.game.board, played.game.board)
    const rejoined = joinPlayer(blocked, {playerId: 'b', peerId: 'b2'})
    const back = syncPresence(ticTacToe, rejoined, {...rejoined, reservations: {}})
    assert.equal(back.seats.O, 'b')
    assert.equal(back.game.turn, 'O')
    assert.deepEqual(back.game.waitingFor, [])
    assert.equal(applyIntent(ticTacToe, back, 'b', {type: 'move', move: 1, id: 1}).game.board[1], 'O')
  })

  it('ends the admitted match before replacing a player and requires an explicit rematch', () => {
    const left = dropPlayer(ticTacToe, admittedMatch(), 'b')
    assert.equal(left.game.abandonedBy, 'O')
    assert.equal(left.seats.O, 'c')
    assert.equal(applyIntent(ticTacToe, left, 'a', {type: 'move', move: 0, id: 1}).game.board[0], null)
    const rematch = applyIntent(ticTacToe, left, 'a', {type: 'restart', id: 2})
    assert.equal(rematch.game.abandonedBy, null)
    assert.equal(applyIntent(ticTacToe, rematch, 'a', {type: 'move', move: 0, id: 3}).game.board[0], 'X')
  })
})
