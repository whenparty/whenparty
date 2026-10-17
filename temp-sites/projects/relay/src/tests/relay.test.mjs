import assert from 'node:assert/strict'
import {once} from 'node:events'
import {after, before, describe, it} from 'node:test'
import WebSocket from 'ws'
import {startRelay} from '../relay.mjs'

const gameOrigin = 'https://chess.when.party'

const connect = (port, options = {}) =>
  new WebSocket(`ws://127.0.0.1:${port}`, {origin: gameOrigin, ...options})

const openSocket = async (port, options) => {
  const socket = connect(port, options)
  await once(socket, 'open')
  return socket
}

const send = (socket, message) => socket.send(JSON.stringify(message))

const nextMessage = async socket => {
  const [data] = await once(socket, 'message')
  return JSON.parse(data.toString())
}

describe('relay', () => {
  let relay

  before(async () => {
    relay = await startRelay({port: 0})
  })

  after(() => relay.close())

  it('answers /health with 200 OK', async () => {
    const response = await fetch(`http://127.0.0.1:${relay.port}/health`)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')
  })

  it('answers other paths with 404', async () => {
    const response = await fetch(`http://127.0.0.1:${relay.port}/`)

    assert.equal(response.status, 404)
  })

  it('delivers a published message to the subscribers of its topic', async () => {
    const subscriber = await openSocket(relay.port)
    const publisher = await openSocket(relay.port)

    // The relay echoes to every subscriber, so this echo proves the subscription is in place
    send(subscriber, {type: 'subscribe', topic: 'room-1'})
    send(subscriber, {type: 'publish', topic: 'room-1', payload: 'ready'})
    await nextMessage(subscriber)

    const received = nextMessage(subscriber)
    send(publisher, {type: 'publish', topic: 'room-1', payload: {move: 'e4'}})

    assert.deepEqual(await received, {topic: 'room-1', payload: {move: 'e4'}})
    subscriber.close()
    publisher.close()
  })

  it('rejects a connection from another site with 403', async () => {
    const socket = connect(relay.port, {origin: 'https://evil.example'})
    const [error] = await once(socket, 'error')

    assert.match(error.message, /403/)
  })

  it('rejects a connection without an Origin header with 403', async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${relay.port}`)
    const [error] = await once(socket, 'error')

    assert.match(error.message, /403/)
  })
})

describe('relay heartbeat', () => {
  it('terminates clients that stop answering pings and keeps the others', async t => {
    const relay = await startRelay({port: 0, heartbeatMs: 50})
    t.after(() => relay.close())

    const silent = await openSocket(relay.port, {autoPong: false})
    const healthy = await openSocket(relay.port)
    const [code] = await once(silent, 'close')

    assert.equal(code, 1006)
    assert.equal(healthy.readyState, WebSocket.OPEN)
    healthy.close()
  })
})
