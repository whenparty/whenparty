import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import type {End, Failure} from '@whenparty/netcode'
import type {Visit} from '../connection.ts'
import {createChampionship, type Championship} from '../core/index.ts'
import {statusOf} from '../frontends/shared/texts.ts'
import {announced, confirmAll, finishPerformances, lobbyOf, must, move, perfectPlans, performing, rests, started, withAthlete} from './fixtures.ts'

const visitOf = (change: Partial<Visit>): Visit => ({
  code: 'K7MXQ',
  phase: 'playing',
  waiting: null,
  waitedForHost: false,
  hostAway: false,
  serverLost: false,
  rulesError: false,
  finish: null,
  game: null,
  seat: '2',
  isHost: false,
  occupied: ['1', '2'],
  matchNumber: 1,
  canAct: true,
  ...change
})

const playing = (game: Championship, change: Partial<Visit> = {}) => statusOf(visitOf({game, ...change}))
const asHost = {seat: '1', isHost: true} as const

const finishedWith = (plansOf: (index: number) => Record<string, typeof rests>): Championship => {
  let state = started(2)
  for (let index = 0; index < 10; index++) {
    if (index > 0) state = must(move(must(move(state, '1', {type: 'next'})), '1', {type: 'train'}))
    state = finishPerformances(performing(state, plansOf(index)))
  }
  return state
}

describe('7-status', () => {
  it('7-1 gives the status while the page starts, waits, enters or has lost the host', () => {
    assert.equal(statusOf(visitOf({phase: 'starting', code: null})), 'Creating a room…')
    assert.equal(statusOf(visitOf({phase: 'entering', waiting: 'decides'})), 'Waiting for the host of K7MXQ to let you in…')
    assert.equal(statusOf(visitOf({phase: 'entering', waiting: 'offline'})), 'Waiting for the host of K7MXQ to come back…')
    assert.equal(
      playing(announced(), {hostAway: true, serverLost: true}),
      'The connection to the host is lost. The game goes on when it is back. The room closes if the host is away for 10 minutes.'
    )
    assert.equal(statusOf(visitOf({phase: 'entering'})), 'Looking for room K7MXQ…')
  })

  it('7-1 puts the lost server and a rules error before the next row that applies', () => {
    assert.equal(
      playing(announced(), {serverLost: true, rulesError: true}),
      'New players cannot join right now: the game server is out of reach. This game has an error. The host starts training.'
    )
    assert.equal(statusOf(visitOf({phase: 'entering', rulesError: true})), 'This game has an error. Looking for room K7MXQ…')
  })

  it('7-1 says that the room lost its championship, before the lobby rows', () => {
    assert.equal(playing(createChampionship(), {...asHost, matchNumber: 1}), 'This room lost its championship. Create a new room to play again.')
  })

  it('7-1 gives the lobby status of the host and of another seated player', () => {
    assert.equal(playing(lobbyOf(2), {...asHost, matchNumber: 0}), 'Send the code to the other players. Start when everyone has entered a name.')
    assert.equal(playing(lobbyOf(2), {matchNumber: 0}), 'Enter a name. The host starts the championship.')
  })

  it('7-1 names one winner or several winners of a finished championship', () => {
    assert.equal(playing(finishedWith(index => ({'1': perfectPlans[index] ?? rests}))), 'Athlete 1 wins the championship.')
    assert.equal(playing(finishedWith(() => ({}))), 'Athlete 1, Athlete 2 share the win.')
  })

  it('7-1 says that the championship is paused for good or while a player is away', () => {
    assert.equal(playing(withAthlete(announced(), '2', {left: true})), 'Paused for good: the player of Athlete 2 left the room.')
    assert.equal(
      playing({...announced(), away: ['2']}, asHost),
      'Paused: the player of Athlete 2 is away. The championship waits for them to come back.'
    )
  })

  it('7-1 tells a page without an athlete that it watches', () => {
    assert.equal(playing(announced(), {seat: null}), 'You are watching the championship.')
    assert.equal(playing(announced(), {seat: '3'}), 'You are watching the championship.')
  })

  it('7-1 gives the status of each screen to the host and to another player', () => {
    assert.equal(playing(announced(), asHost), 'Talk the challenge over, then start training.')
    assert.equal(playing(announced()), 'The host starts training.')
    assert.equal(playing(confirmAll(started())), 'Waiting for the others to confirm their plans.')
    assert.equal(playing(started()), 'Plan three actions for your athlete, then confirm.')
    assert.equal(playing(performing(started())), 'Watch each athlete take their turn. Their result appears after the performance.')
    const results = finishPerformances(performing(started()))
    assert.equal(playing(results, asHost), 'Announce the next challenge when everyone has seen the results.')
    assert.equal(playing(results), 'The host announces the next challenge.')
  })

  it('7-2 gives the status after the game ended', () => {
    const ended = (end: End) => statusOf(visitOf({phase: 'over', finish: {kind: 'ended', end}}))
    assert.equal(ended({cause: 'other version', older: 'host'}), 'The host runs an older version of the game. Ask them to reload the page.')
    assert.equal(ended({cause: 'other version', older: 'page'}), 'This game was updated. Reload the page.')
    assert.equal(ended({cause: 'outdated', older: 'page'}), 'This game was updated. Reload the page.')
    assert.equal(ended({cause: 'outdated', older: 'server'}), 'The game server is being updated. Try again in a few minutes.')
    assert.equal(ended({cause: 'removed'}), 'You were away too long, so you left this game.')
    assert.equal(ended({cause: 'owner away'}), 'The connection was lost for too long, so the game is over.')
    assert.equal(ended({cause: 'idle'}), 'Nobody played for a while, so the room is closed.')
    assert.equal(ended({cause: 'unreachable'}), 'Lost the connection to the host and could not get it back.')
    assert.equal(ended({cause: 'no relay'}), 'Lost the connection to the host and could not get it back.')
    assert.equal(ended({cause: 'room closed'}), 'The room is closed, so the game is over.')
  })

  it('7-2 gives the status after starting or entering failed', () => {
    const failed = (failure: Failure, waitedForHost = false) =>
      statusOf(visitOf({phase: 'over', finish: {kind: 'failed', failure}, waitedForHost}))
    assert.equal(failed({cause: 'other version', older: 'page'}), 'This game was updated. Reload the page.')
    assert.equal(failed({cause: 'other version', older: 'host'}), 'The host of K7MXQ runs an older version of the game. Ask them to reload the page.')
    assert.equal(failed({cause: 'outdated', older: 'server'}), 'The game server is being updated. Try again in a few minutes.')
    assert.equal(failed({cause: 'outdated', older: 'page'}), 'This game was updated. Reload the page.')
    assert.equal(failed({cause: 'bad rules'}), 'This game has an error and cannot start.')
    assert.equal(failed({cause: 'busy'}), 'The game server is busy. Try again in a few minutes.')
    assert.equal(failed({cause: 'bad app'}), 'This game was updated. Reload the page.')
    assert.equal(failed({cause: 'bad wait'}), 'This game was updated. Reload the page.')
    assert.equal(failed({cause: 'no room'}, true), 'Room K7MXQ is closed.')
    assert.equal(failed({cause: 'no room'}), 'Nobody hosts K7MXQ. Check the code with the room creator.')
    assert.equal(failed({cause: 'owner away'}), 'The host of K7MXQ is offline. Try again in a moment.')
    assert.equal(failed({cause: 'full'}), 'Room K7MXQ is full.')
    assert.equal(failed({cause: 'refused'}), 'The host of K7MXQ did not let you in.')
    assert.equal(
      failed({cause: 'unreachable'}),
      'Found room K7MXQ, but could not connect to its host. A network on the way may block the connection. Try again in a moment, or switch between Wi-Fi and mobile data.'
    )
    assert.equal(failed({cause: 'offline'}), 'Cannot reach the game server. Check your internet connection.')
    assert.equal(failed({cause: 'open elsewhere'}), 'This game is open in another tab. Close it and reload this page.')
  })
})
