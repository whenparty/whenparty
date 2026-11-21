import assert from 'node:assert/strict'
import {once} from 'node:events'
import {connect} from 'node:net'
import {after, before, describe, it} from 'node:test'
import {createRooms} from '@whenparty/rooms'
import {createRoomsServer, roomsModule} from '@whenparty/rooms/server'
import {createTransport, systemClock} from '@whenparty/transport'
import WebSocket from 'ws'
import {startSignalingServer} from '../server.mjs'

const gameOrigin = 'https://chess.when.party'

const nextMessage = async socket => {
  const [data] = await once(socket, 'message')
  return JSON.parse(data.toString())
}

describe('signaling server', () => {
  let server

  before(async () => {
    server = await startSignalingServer({port: 0})
  })

  after(() => server.close())

  it('answers /health with 200 OK', async () => {
    const response = await fetch(`http://127.0.0.1:${server.port}/health`)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')
  })

  it('answers other paths with 404', async () => {
    const response = await fetch(`http://127.0.0.1:${server.port}/`)

    assert.equal(response.status, 404)
  })

  it('refuses a WebSocket connection at another path than /platform with 404', async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/`, {origin: gameOrigin})
    const [error] = await once(socket, 'error')

    assert.match(error.message, /404/)
  })

  for (const target of ['//', '///']) {
    it(`refuses an upgrade at ${target} with 404 and keeps serving`, async () => {
      const socket = connect(server.port, '127.0.0.1')
      await once(socket, 'connect')
      socket.write(
        `GET ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nOrigin: ${gameOrigin}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`
      )
      const [answer] = await once(socket, 'data')
      socket.destroy()

      assert.match(answer.toString(), /^HTTP\/1\.1 404 /)
      assert.equal((await fetch(`http://127.0.0.1:${server.port}/health`)).status, 200)
    })
  }

  it('answers /turn-credentials with 404', async () => {
    const response = await fetch(`http://127.0.0.1:${server.port}/turn-credentials`)

    assert.equal(response.status, 404)
  })
})

describe('signaling server platform', () => {
  const pageEnvironment = (port, origin = 'http://localhost') => ({
    clock: systemClock,
    signalingUrl: `ws://127.0.0.1:${port}/platform`,
    openSocket: url => new WebSocket(url, {origin}).on('error', () => {}),
    createPeerConnection: () => {
      throw new Error('no peer connections here')
    },
    onPageHide: () => {}
  })

  const echo = closed => ({
    version: 1,
    start: port => ({
      message: (peerId, message) => port.send(peerId, {echo: message}),
      closed: peerId => closed.push(peerId)
    })
  })

  const openPage = (port, origin) => {
    const notices = []
    const transport = createTransport(pageEnvironment(port, origin))
    const notice = kind => value => notices.push({kind, value})
    const connection = transport.openSignaling({
      echo: {version: 1, handlers: {open: notice('open'), message: notice('message'), closed: notice('closed')}}
    })
    return {connection, notices}
  }

  const until = async condition => {
    const deadline = Date.now() + 2_000
    while (!condition()) {
      assert.ok(Date.now() < deadline, 'timed out')
      await new Promise(resolve => setTimeout(resolve, 5))
    }
  }

  it('hands upgrades at /platform to the transport server and its server parts', async t => {
    const closed = []
    const server = await startSignalingServer({port: 0, parts: {echo: echo(closed)}})
    t.after(() => server.close())

    const {connection, notices} = openPage(server.port)
    await until(() => connection.state === 'open')
    assert.equal(connection.send('echo', {move: 'e4'}), true)
    await until(() => notices.some(notice => notice.kind === 'message'))
    assert.deepEqual(notices.at(-1), {kind: 'message', value: {echo: {move: 'e4'}}})

    const peerId = connection.peerId
    connection.close()
    await until(() => closed.length > 0)
    assert.deepEqual(closed, [peerId])
  })

  it('runs the rooms server: a page creates a room, and the owner refuses a page that asks to join it', async t => {
    const unrefClock = {...systemClock, setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds).unref()}
    const server = await startSignalingServer({port: 0, parts: {[roomsModule]: createRoomsServer({clock: unrefClock})}})
    t.after(() => server.close())

    const roomsPage = () =>
      createRooms({
        transport: createTransport(pageEnvironment(server.port)),
        clock: systemClock,
        storage: null,
        takeLock: async () => ({release: () => {}}),
        visibility: () => 'visible',
        onVisibilityChange: () => {},
        onPageHide: () => {},
        onPageShow: () => {},
        reload: () => {}
      })

    let code = null
    let failure = null
    const owner = roomsPage().create('test.game', null, {
      created: created => {
        code = created
      },
      joinRequest: request => request.refuse({why: 'full table'})
    })
    await until(() => code !== null)
    roomsPage().join('test.game', code, {version: 1}, {failed: failed => (failure = failed)})
    await until(() => failure !== null)
    assert.deepEqual(failure, {reason: 'refused', joinData: {why: 'full table'}})
    owner.leave()
  })

  it('refuses a platform connection from another site', async t => {
    const server = await startSignalingServer({port: 0, parts: {echo: echo([])}})
    t.after(() => server.close())

    const {connection, notices} = openPage(server.port, 'https://evil.example')
    await until(() => connection.state === 'closed')
    assert.equal(notices.at(-1)?.value.reason, 'offline')
  })

  it('closes a platform connection whose page sends a message over 65,536 bytes', async t => {
    const server = await startSignalingServer({port: 0, parts: {echo: echo([])}})
    t.after(() => server.close())

    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/platform`, {origin: gameOrigin})
    await once(socket, 'open')
    socket.send(JSON.stringify({t: 'hello', v: 1, m: {echo: 1}}))
    await nextMessage(socket)
    socket.send('x'.repeat(65_537))
    const [code] = await once(socket, 'close')

    assert.equal(code, 1009)
  })
})
