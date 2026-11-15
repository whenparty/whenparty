import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {End, Failure, Waiting} from '@whenparty/netcode'
import {pageHarness, view} from './fake-page.ts'

const code = 'BCDFG'

const ended = (end: End): string => {
  const h = pageHarness(code)
  h.page.open()
  h.on.snapshot(view({participant: 2, isHost: false}))
  h.on.ended(end)
  return h.view.status
}

const failed = (failure: Failure, waitedFor: Waiting | null = null): string => {
  const h = pageHarness(code)
  h.page.open()
  h.on.entering()
  if (waitedFor !== null) {
    h.on.waiting(waitedFor)
  }
  h.on.failed(failure)
  return h.view.status
}

const startFailed = (failure: Failure): string => {
  const h = pageHarness()
  h.page.open()
  h.page.startPressed()
  h.on.failed(failure)
  return h.view.status
}

test('4-1 the status after the game ended', () => {
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

test('4-1 the status after starting or entering failed', () => {
  assert.equal(failed({cause: 'other version', older: 'page'}), 'This game was updated. Reload the page.')
  assert.equal(failed({cause: 'outdated', older: 'page'}), 'This game was updated. Reload the page.')
  assert.equal(failed({cause: 'outdated', older: 'server'}), 'The game server is being updated. Try again in a few minutes.')
  assert.equal(
    failed({cause: 'other version', older: 'host'}),
    `The host of ${code} runs an older version of the game. Ask them to reload the page.`
  )
  assert.equal(failed({cause: 'bad rules'}), 'This game has an error and cannot start.')
  assert.equal(failed({cause: 'busy'}), 'The game server is busy. Try again in a few minutes.')
  assert.equal(failed({cause: 'bad app'}), 'This game was updated. Reload the page.')
  assert.equal(startFailed({cause: 'bad wait'}), 'This game was updated. Reload the page.')
  assert.equal(startFailed({cause: 'outdated', older: 'page'}), 'This game was updated. Reload the page.')
  assert.equal(startFailed({cause: 'outdated', older: 'server'}), 'The game server is being updated. Try again in a few minutes.')
  assert.equal(startFailed({cause: 'bad rules'}), 'This game has an error and cannot start.')
  assert.equal(startFailed({cause: 'busy'}), 'The game server is busy. Try again in a few minutes.')
  assert.equal(startFailed({cause: 'offline'}), 'Cannot reach the game server. Check your internet connection.')
  assert.equal(startFailed({cause: 'open elsewhere'}), 'This game is open in another tab. Close it and reload this page.')
  assert.equal(failed({cause: 'no room'}, 'decides'), `Room ${code} is closed.`)
  assert.equal(failed({cause: 'no room'}, 'offline'), `Room ${code} is closed.`)
  assert.equal(failed({cause: 'no room'}), `Nobody hosts ${code}. Check the code with the room creator.`)
  assert.equal(failed({cause: 'owner away'}), `The host of ${code} is offline. Try again in a moment.`)
  assert.equal(failed({cause: 'full'}), `Room ${code} is full.`)
  assert.equal(failed({cause: 'refused'}), `The host of ${code} did not let you in.`)
  assert.equal(
    failed({cause: 'unreachable'}),
    `Found room ${code}, but could not connect to its host. A network on the way may block the connection. Try again in a moment, or switch between Wi-Fi and mobile data.`
  )
  assert.equal(failed({cause: 'offline'}), 'Cannot reach the game server. Check your internet connection.')
  assert.equal(failed({cause: 'open elsewhere'}), 'This game is open in another tab. Close it and reload this page.')
})

test('4-1 "no room" after the page waited for the host gives its text also when entering went on after the wait', () => {
  const h = pageHarness()
  h.page.open()
  h.page.submitted(code)
  h.on.entering()
  h.on.waiting('decides')
  h.on.entering()
  h.on.failed({cause: 'no room'})
  assert.equal(h.view.status, `Room ${code} is closed.`)
})
