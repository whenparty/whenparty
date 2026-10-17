import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, createRoomCode, normalizeRoomCode} from '../room-code.ts'

describe('createRoomCode', () => {
  it('makes codes of the room code length from the alphabet', () => {
    for (let index = 0; index < 100; index++) {
      const code = createRoomCode()

      assert.equal(code.length, ROOM_CODE_LENGTH)
      assert.ok([...code].every(char => ROOM_CODE_ALPHABET.includes(char)), code)
    }
  })

  it('picks each character from the random source', () => {
    const counting = (length: number) => Uint32Array.from({length}, (_, index) => index)

    assert.equal(createRoomCode(counting), ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH))
  })

  it('leaves out characters that are easy to misread', () => {
    for (const char of '01OIL') {
      assert.ok(!ROOM_CODE_ALPHABET.includes(char), char)
    }
  })
})

describe('normalizeRoomCode', () => {
  it('accepts codes typed in lowercase, with spaces or dashes', () => {
    assert.equal(normalizeRoomCode(' k7mxq '), 'K7MXQ')
    assert.equal(normalizeRoomCode('K7M-XQ'), 'K7MXQ')
    assert.equal(normalizeRoomCode('k7m xq'), 'K7MXQ')
  })

  it('rejects codes of the wrong length or with other characters', () => {
    for (const input of ['', 'K7MX', 'K7MXQQ', 'K7MX0', 'K7MXO', 'K7MX!']) {
      assert.equal(normalizeRoomCode(input), null, input)
    }
  })
})
