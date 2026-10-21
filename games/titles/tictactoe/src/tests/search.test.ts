import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import type {SessionView} from '@whenparty/p2p'
import {lostRoom, searchOf} from '../search.ts'

const view = (changes: Partial<SessionView<unknown>> = {}): SessionView<unknown> => ({
  selfId: 'self',
  playerId: 'self',
  isHost: false,
  inControl: true,
  room: null,
  waitingForHost: false,
  hostLeft: false,
  unreachable: false,
  ...changes
})

const room = {
  members: [{playerId: 'host', peerId: 'host'}],
  term: 0,
  hostId: 'host',
  seats: {},
  game: {},
  handled: {},
  clock: 0,
  reservations: {}
}

describe('searchOf', () => {
  it('is looking until the hint time has passed', () => {
    assert.equal(searchOf({view: view(), hostIsLate: false, signalingOpen: true}), 'looking')
  })

  it('tells an unreachable room at once, whatever the time', () => {
    assert.equal(searchOf({view: view({unreachable: true}), hostIsLate: false, signalingOpen: false}), 'unreachable')
  })

  it('tells a dead signaling connection from nobody hosting', () => {
    assert.equal(searchOf({view: view(), hostIsLate: true, signalingOpen: false}), 'offline')
    assert.equal(searchOf({view: view(), hostIsLate: true, signalingOpen: true}), 'nobody')
  })
})

describe('lostRoom', () => {
  it('is true only when a room goes away', () => {
    assert.equal(lostRoom(view({room}), view()), true)
    assert.equal(lostRoom(view(), view()), false)
    assert.equal(lostRoom(null, view()), false)
    assert.equal(lostRoom(view({room}), view({room})), false)
  })
})
