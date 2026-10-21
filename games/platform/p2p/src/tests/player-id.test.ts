import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {playerIdFrom} from '../player-id.ts'

const storage = () => {
  const items = new Map<string, string>()
  return {getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value)}
}

describe('playerIdFrom', () => {
  it('makes an ID once and gives the same one again', () => {
    const kept = storage()
    const first = playerIdFrom(() => kept)

    assert.match(first, /^[0-9a-f-]{36}$/)
    assert.equal(
      playerIdFrom(() => kept),
      first
    )
    assert.notEqual(
      playerIdFrom(() => storage()),
      first
    )
  })

  it('gives a fresh ID when there is no storage or it throws', () => {
    assert.match(
      playerIdFrom(() => null),
      /^[0-9a-f-]{36}$/
    )
    assert.match(
      playerIdFrom(() => {
        throw new Error('sandboxed')
      }),
      /^[0-9a-f-]{36}$/
    )
  })
})
