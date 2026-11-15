import assert from 'node:assert/strict'
import {test} from 'node:test'
import {newGame, type Game} from '../tictactoe.ts'
import {pageHarness, view, type PageHarness, type Played} from './fake-page.ts'

const code = 'BCDFG'

const statusAfter = (played: Played): string => {
  const h = pageHarness(code)
  h.page.open()
  h.on.snapshot(view(played))
  return h.view.status
}

const away = (game: Game, mark: 'X' | 'O'): Game => ({...game, away: {...game.away, [mark]: {lost: true, hiddenSince: null}}})

const won: Game = {...newGame(), result: {kind: 'win', mark: 'X', cells: [0, 1, 2]}}
const drawn: Game = {...newGame(), result: {kind: 'draw'}}
const hidden: Game = {...newGame(), result: {kind: 'hidden', seat: 'O'}}
const left: Game = {...newGame(), result: {kind: 'left', seat: 'O'}}
const waitingForPlayer = 'Waiting for a second player. Send them the code.'

const hostPage = (): PageHarness => {
  const h = pageHarness()
  h.page.open()
  h.page.startPressed()
  h.on.code(code)
  h.on.snapshot(view({running: false, match: 0, seats: [1, null], game: null}))
  return h
}

const returnedHostPage = (): PageHarness => {
  const h = pageHarness(code)
  h.page.open()
  h.on.entering()
  h.on.snapshot(view({running: false, match: 0, seats: [1, null], game: null}))
  return h
}

test('3-1 the status of starting, waiting for the host and entering', () => {
  const starting = pageHarness()
  starting.page.open()
  starting.page.startPressed()
  assert.equal(starting.view.status, 'Creating a room…')
  const h = pageHarness(code)
  h.page.open()
  h.on.entering()
  assert.equal(h.view.status, `Looking for room ${code}…`)
  h.on.waiting('decides')
  assert.equal(h.view.status, `Waiting for the host of ${code} to let you in…`)
  h.on.waiting('offline')
  assert.equal(h.view.status, `Waiting for the host of ${code} to come back…`)
  h.on.entering()
  assert.equal(h.view.status, `Looking for room ${code}…`)
})

test('3-1 the lost server and a rules error go before the text of the next row', () => {
  const h = hostPage()
  h.on.snapshot(view({running: false, match: 0, seats: [1, 2], game: null, number: 2}))
  h.on.serverLost()
  assert.equal(h.view.status, 'New players cannot join right now: the game server is out of reach. Ready for the next match.')
  h.on.rulesError()
  assert.equal(
    h.view.status,
    'New players cannot join right now: the game server is out of reach. This game has an error. Ready for the next match.'
  )
})

test('3-1 the end of the last match', () => {
  assert.equal(statusAfter({running: false, game: hidden}), 'O was away too long, so the match is over.')
  assert.equal(statusAfter({running: false, game: left, seats: [1, null]}), 'O left, so the match is over. Send the code to a new player.')
  assert.equal(statusAfter({running: false, game: left, seats: [1, 3]}), 'Ready for the next match.')
  assert.equal(statusAfter({running: false, game: won, participant: 1}), 'X wins.')
  assert.equal(statusAfter({running: false, game: won, participant: 2, isHost: false}), 'X wins.')
  assert.equal(statusAfter({running: false, game: drawn}), 'Draw.')
})

test('3-1 with a free seat, the status asks for a second player after a win or a draw, and not after a player was away too long', () => {
  assert.equal(statusAfter({running: false, game: won, seats: [1, null], participant: 3, isHost: false}), waitingForPlayer)
  assert.equal(statusAfter({running: false, game: drawn, seats: [1, null]}), waitingForPlayer)
  assert.equal(statusAfter({running: false, game: hidden, seats: [1, null]}), 'O was away too long, so the match is over.')
})

test('3-1 the status while no match runs', () => {
  assert.equal(statusAfter({running: false, match: 0, game: null, seats: [1, null]}), waitingForPlayer)
  assert.equal(statusAfter({running: false, match: 0, game: null, seats: [1, 2]}), 'Ready for the next match.')
})

test('3-1 the status of a paused match', () => {
  assert.equal(statusAfter({game: away(away(newGame(), 'X'), 'O')}), 'Paused: both players are away.')
  assert.equal(statusAfter({game: away(newGame(), 'O')}), 'Paused: O is away. The match goes on when they are back.')
  const hiddenX: Game = {...newGame(), away: {X: {lost: false, hiddenSince: 5}, O: {lost: false, hiddenSince: null}}}
  assert.equal(statusAfter({game: hiddenX}), 'Paused: X is away. The match goes on when they are back.')
})

test('3-1 "host back" ends the status of "host away"', () => {
  const h = pageHarness(code)
  h.page.open()
  h.on.snapshot(view({participant: 2, isHost: false}))
  h.on.hostAway()
  assert.equal(h.view.status, 'The connection to the host is lost. The game goes on when it is back.')
  h.on.hostBack()
  assert.equal(h.view.status, 'You are O. X to move.')
})

test('3-1 "server back" ends the text of the lost server', () => {
  const h = hostPage()
  h.on.serverLost()
  assert.equal(h.view.status, `New players cannot join right now: the game server is out of reach. ${waitingForPlayer}`)
  h.on.serverBack()
  assert.equal(h.view.status, waitingForPlayer)
})

test('3-1 "This game has an error." stays from "rules error" through later snapshots until the game ends, and a new game has none', () => {
  for (const h of [hostPage(), returnedHostPage()]) {
    h.on.rulesError()
    assert.equal(h.view.status, `This game has an error. ${waitingForPlayer}`)
    h.on.snapshot(view({running: false, match: 0, seats: [1, null], game: null, number: 2}))
    assert.equal(h.view.status, `This game has an error. ${waitingForPlayer}`)
    h.on.ended({cause: 'room closed'})
    assert.equal(h.view.status, 'The room is closed, so the game is over.')
    h.page.leavePressed()
    h.page.startPressed()
    h.on.code(code)
    h.on.snapshot(view({running: false, match: 0, seats: [1, null], game: null}))
    assert.equal(h.view.status, waitingForPlayer)
  }
})

test('3-1 the status of a running match', () => {
  assert.equal(statusAfter({participant: 3, seats: [1, 2], isHost: false}), 'You are watching. X to move.')
  assert.equal(statusAfter({participant: 1}), 'Your turn. You are X.')
  assert.equal(statusAfter({participant: 2, isHost: false}), 'You are O. X to move.')
})
