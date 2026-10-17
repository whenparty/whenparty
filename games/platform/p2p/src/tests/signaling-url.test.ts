import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {signalingUrlFor} from '../signaling-url.ts'

describe('signalingUrlFor', () => {
  it('uses the local signaling server for pages on localhost', () => {
    assert.equal(signalingUrlFor('localhost'), 'ws://localhost:8080')
    assert.equal(signalingUrlFor('127.0.0.1'), 'ws://localhost:8080')
  })

  it('uses signaling.when.party everywhere else', () => {
    assert.equal(signalingUrlFor('tictactoe.when.party'), 'wss://signaling.when.party')
    assert.equal(signalingUrlFor('localhost.example.com'), 'wss://signaling.when.party')
  })
})
