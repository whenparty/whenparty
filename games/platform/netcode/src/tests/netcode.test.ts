import assert from 'node:assert/strict'
import {test} from 'node:test'
import {harness, names} from './harness.ts'

test('a start that the rooms module rejects at once does not leave the game starting', () => {
  const h = harness()
  h.rooms.refuseCalls = true
  h.netcode.start()
  assert.equal(h.netcode.phase, 'none')
  assert.deepEqual(names(h, 0), ['failed'])
})
