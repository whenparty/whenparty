import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {test} from 'node:test'
import {table} from './8-turn.states.ts'
import {ServerHarness} from './fake-server.ts'

type Table = typeof table
type State = keyof Table

const secretOf: {readonly [S in State]: string | null} = {
  'open, with a TURN secret': 'turn-secret',
  'open, without a TURN secret': null
}

for (const [state, cells] of Object.entries(table) as [State, Table[State]][]) {
  for (const [event, cell] of Object.entries(cells)) {
    if (!('outcome' in cell)) {
      continue
    }
    test(`${cell.ids.join(' ')} ${state}: ${event}`, () => {
      const secret = secretOf[state]
      const h = new ServerHarness({turnSecret: secret})
      const {socket} = h.open()
      socket.receive({t: 'turn', r: 7})
      const answer = socket.last('turn')
      if (cell.outcome.answer === 'an empty answer') {
        assert.deepEqual(answer, {t: 'turn', r: 7, s: null})
        return
      }
      const servers = answer?.s as {urls: string[]; username: string; credential: string}
      assert.deepEqual(servers.urls, ['turn:turn.when.party:3478?transport=udp', 'turn:turn.when.party:3478?transport=tcp'])
      const [expiry, random] = servers.username.split(':')
      assert.equal(Number(expiry), Math.floor(h.clock.now() / 1000) + 86_400)
      assert.match(random ?? '', /^[0-9a-f]{16}$/)
      assert.equal(servers.credential, createHmac('sha1', String(secret)).update(servers.username).digest('base64'))
    })
  }
}

test('8-1 8-2 each request gets new credentials, and the expiry rounds down to a whole second', () => {
  const h = new ServerHarness({turnSecret: 'turn-secret'})
  const {socket} = h.open()
  h.clock.advance(999)
  socket.receive({t: 'turn', r: 1})
  socket.receive({t: 'turn', r: 2})
  const [first, second] = socket.of('turn').map(message => (message.s as {username: string}).username)
  assert.notEqual(first, second)
  assert.equal(Number(first?.split(':')[0]), Math.floor(h.clock.now() / 1000) + 86_400)
})
