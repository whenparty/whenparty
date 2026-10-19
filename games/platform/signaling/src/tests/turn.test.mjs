import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {after, before, describe, it} from 'node:test'
import {startSignalingServer} from '../server.mjs'
import {turnCredentials, turnFromEnv} from '../turn.mjs'

const turn = {secret: 'test-secret', urls: ['turn:turn.example:3478?transport=udp'], ttlSeconds: 3600}

describe('turnCredentials', () => {
  it('signs an expiring username as coturn checks it', () => {
    const {urls, username, credential, ttlSeconds} = turnCredentials(turn, 1_000_000_000_000)
    const [expiry, id] = username.split(':')

    assert.deepEqual(urls, turn.urls)
    assert.equal(ttlSeconds, 3600)
    assert.equal(Number(expiry), 1_000_000_000 + 3600)
    assert.match(id ?? '', /^[0-9a-f]{16}$/)
    assert.equal(credential, createHmac('sha1', 'test-secret').update(username).digest('base64'))
  })

  it('gives every page its own username', () => {
    assert.notEqual(turnCredentials(turn).username, turnCredentials(turn).username)
  })
})

describe('turnFromEnv', () => {
  it('is off without TURN_SECRET', () => {
    assert.equal(turnFromEnv({TURN_URLS: 'turn:turn.example:3478'}), null)
    assert.equal(turnFromEnv({TURN_SECRET: ''}), null)
  })

  it('reads the secret, the URLs and the lifetime', () => {
    assert.deepEqual(turnFromEnv({TURN_SECRET: 's', TURN_URLS: 'turn:a:3478?transport=udp, turn:a:3478?transport=tcp'}), {
      secret: 's',
      urls: ['turn:a:3478?transport=udp', 'turn:a:3478?transport=tcp'],
      ttlSeconds: 86_400
    })
  })
})

describe('GET /turn-credentials', () => {
  let server
  let serverWithoutTurn

  before(async () => {
    server = await startSignalingServer({port: 0, turn})
    serverWithoutTurn = await startSignalingServer({port: 0})
  })

  after(() => Promise.all([server.close(), serverWithoutTurn.close()]))

  const get = (port, origin) =>
    fetch(`http://127.0.0.1:${port}/turn-credentials`, {headers: origin ? {origin} : {}})

  it('hands a game page credentials that nothing may cache', async () => {
    const response = await get(server.port, 'https://tictactoe.when.party')
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://tictactoe.when.party')
    assert.deepEqual(body.urls, turn.urls)
    assert.equal(body.credential, createHmac('sha1', 'test-secret').update(body.username).digest('base64'))
  })

  it('refuses other sites and requests without an Origin with 403', async () => {
    assert.equal((await get(server.port, 'https://evil.example')).status, 403)
    assert.equal((await get(server.port)).status, 403)
  })

  it('is a 404 without TURN settings', async () => {
    assert.equal((await get(serverWithoutTurn.port, 'https://tictactoe.when.party')).status, 404)
  })
})
