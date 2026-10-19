import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import type {SessionView} from '@whenparty/p2p'
import {canStartRoom, lostRoom, searchOf} from '../search.ts'

const view = (changes: Partial<SessionView<unknown>> = {}): SessionView<unknown> => ({
  selfId: 'self',
  playerId: 'self',
  isHost: false,
  inControl: true,
  room: null,
  switchingHost: false,
  hostLeft: false,
  unreachable: false,
  ...changes
})

const room = {members: [{playerId: 'host', peerId: 'host'}], term: 0, provisional: false, seats: {}, game: {}, handled: {}, absent: {}}

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

describe('canStartRoom', () => {
  it('offers to start the room only when nobody hosts it', () => {
    assert.equal(canStartRoom({view: view(), hostIsLate: true, signalingOpen: true}), true)

    for (const state of [
      {view: view(), hostIsLate: false, signalingOpen: true},
      {view: view(), hostIsLate: true, signalingOpen: false},
      {view: view({unreachable: true}), hostIsLate: true, signalingOpen: true},
      {view: view({room}), hostIsLate: true, signalingOpen: true},
      {view: view({hostLeft: true}), hostIsLate: true, signalingOpen: true}
    ]) {
      assert.equal(canStartRoom(state), false, JSON.stringify(state))
    }
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
