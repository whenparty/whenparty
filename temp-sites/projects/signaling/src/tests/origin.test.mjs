import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {isAllowedOrigin} from '../origin.mjs'

describe('isAllowedOrigin', () => {
  it('allows when.party and its subdomains over https', () => {
    for (const origin of [
      'https://when.party',
      'https://chess.when.party',
      'https://dev.chess.when.party'
    ]) {
      assert.equal(isAllowedOrigin(origin), true, origin)
    }
  })

  it('allows localhost and 127.0.0.1 over http for local development', () => {
    for (const origin of [
      'http://localhost',
      'http://localhost:5173',
      'http://127.0.0.1:8000'
    ]) {
      assert.equal(isAllowedOrigin(origin), true, origin)
    }
  })

  it('rejects other sites and look-alike hosts', () => {
    for (const origin of [
      'https://evil.example',
      'https://evilwhen.party',
      'https://when.party.evil.example',
      'http://chess.when.party',
      'https://localhost.evil.example',
      'http://localhost.evil.example:5173'
    ]) {
      assert.equal(isAllowedOrigin(origin), false, origin)
    }
  })

  it('rejects a missing or malformed origin', () => {
    for (const origin of [undefined, '', 'null', 'not a url']) {
      assert.equal(isAllowedOrigin(origin), false, String(origin))
    }
  })
})
