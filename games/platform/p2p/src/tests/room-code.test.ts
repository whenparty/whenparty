import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, createRoomCode, normalizeRoomCode, roomCodeFromHash} from '../room-code.ts'

describe('createRoomCode', () => {
  it('creates valid invite codes for the full random input range', () => {
    const sources = [
      (length: number) => new Uint32Array(length),
      (length: number) => new Uint32Array(length).fill(0xffff_ffff),
      (length: number) => Uint32Array.from({length}, (_, index) => index * 1_000_003)
    ]

    for (const source of sources) {
      const code = createRoomCode(source)

      assert.equal(code.length, ROOM_CODE_LENGTH)
      assert.ok(
        [...code].every(char => ROOM_CODE_ALPHABET.includes(char)),
        code
      )
      assert.equal(roomCodeFromHash(`#${code}`), code)
    }
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

describe('roomCodeFromHash', () => {
  it('reads the code from an invite link hash', () => {
    assert.equal(roomCodeFromHash('#K7MXQ'), 'K7MXQ')
    assert.equal(roomCodeFromHash('#k7mxq'), 'K7MXQ')
  })

  it('is null for an empty hash or one that is not a room code', () => {
    for (const hash of ['', '#', '#K7MX', '#hello', '#K7MXQ#K7MXQ']) {
      assert.equal(roomCodeFromHash(hash), null, hash)
    }
  })
})
