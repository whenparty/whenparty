import assert from 'node:assert/strict'
import {once} from 'node:events'
import {after, before, describe, it} from 'node:test'
import {createRooms} from '@whenparty/rooms'
import {createRoomsServer, roomsModule} from '@whenparty/rooms/server'
import {createTransport, systemClock} from '@whenparty/transport'
import WebSocket from 'ws'
import {startSignalingServer} from '../server.mjs'

const gameOrigin = 'https://chess.when.party'

const connect = (port, options = {}) => new WebSocket(`ws://127.0.0.1:${port}`, {origin: gameOrigin, ...options})

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

const subscribe = async (socket, topic = 'room-1') => {
  const ready = nextMessage(socket)
  send(socket, {type: 'subscribe', topic})
  send(socket, {type: 'publish', topic, payload: 'ready'})
  assert.deepEqual(await ready, {topic, payload: 'ready'})
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

  it('delivers a published message to the subscribers of its topic', async () => {
    const subscriber = await openSocket(server.port)
    const publisher = await openSocket(server.port)
    await subscribe(subscriber)

    const received = nextMessage(subscriber)
    send(publisher, {type: 'publish', topic: 'room-1', payload: {move: 'e4'}})

    assert.deepEqual(await received, {topic: 'room-1', payload: {move: 'e4'}})
    subscriber.close()
    publisher.close()
  })

  it('rejects a connection from another site with 403', async () => {
    const socket = connect(server.port, {origin: 'https://evil.example'})
    const [error] = await once(socket, 'error')

    assert.match(error.message, /403/)
  })

  it('rejects a connection without an Origin header with 403', async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}`)
    const [error] = await once(socket, 'error')

    assert.match(error.message, /403/)
  })
})

describe('signaling server limits', () => {
  const startWith = async (t, limits) => {
    const server = await startSignalingServer({port: 0, limits})
    t.after(() => server.close())
    return server
  }

  it('closes a socket that sends a message over maxPayload with 1009', async t => {
    const server = await startWith(t, {maxPayload: 1024})
    const socket = await openSocket(server.port)

    send(socket, {type: 'publish', topic: 'room-1', payload: 'x'.repeat(2048)})
    const [code] = await once(socket, 'close')

    assert.equal(code, 1009)
  })

  it('closes a socket that subscribes to more than maxSubscriptionsPerSocket topics with 1008', async t => {
    const server = await startWith(t, {maxSubscriptionsPerSocket: 2})
    const socket = await openSocket(server.port)

    for (const topic of ['room-1', 'room-2', 'room-3']) {
      send(socket, {type: 'subscribe', topic})
    }
    const [code] = await once(socket, 'close')

    assert.equal(code, 1008)
  })

  it('rejects connections over maxConnections with 503, in a burst too, and accepts one again after a socket closes', async t => {
    const server = await startWith(t, {maxConnections: 1})
    const outcome = socket =>
      new Promise(resolve => {
        socket.once('open', () => resolve('open'))
        socket.once('error', error => resolve(error.message))
      })
    const sockets = [connect(server.port), connect(server.port), connect(server.port)]
    const outcomes = await Promise.all(sockets.map(outcome))

    assert.equal(outcomes.filter(result => result === 'open').length, 1)
    assert.equal(outcomes.filter(result => /503/.test(result)).length, 2)

    const open = sockets[outcomes.indexOf('open')]
    open.close()
    await once(open, 'close')
    const next = await openSocket(server.port)
    next.close()
  })

  it('closes a socket that sends more than messageBurst messages at once with 1008, without relaying the rest', async t => {
    const server = await startWith(t, {messageBurst: 3, messagesPerSecond: 0.001})
    const subscriber = await openSocket(server.port)
    const publisher = await openSocket(server.port)
    const received = []
    await subscribe(subscriber)
    subscriber.on('message', data => received.push(JSON.parse(data.toString()).payload))

    for (const payload of [1, 2, 3, 4, 5]) {
      send(publisher, {type: 'publish', topic: 'room-1', payload})
    }
    const [code] = await once(publisher, 'close')
    send(subscriber, {type: 'publish', topic: 'room-1', payload: 'done'})
    await once(subscriber, 'message')

    assert.equal(code, 1008)
    assert.deepEqual(received, [1, 2, 3, 'done'])
    subscriber.close()
  })

  it('accepts another burst after its message budget refills', async t => {
    let now = 0
    t.mock.method(performance, 'now', () => now)
    const server = await startWith(t, {messageBurst: 2, messagesPerSecond: 100})
    const socket = await openSocket(server.port)
    await subscribe(socket)

    for (let round = 0; round < 3; round++) {
      now += 20
      for (const payload of [1, 2]) {
        const received = nextMessage(socket)
        send(socket, {type: 'publish', topic: 'room-1', payload})
        assert.deepEqual(await received, {topic: 'room-1', payload})
      }
    }

    socket.close()
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

  it('keeps the relay at other paths', async t => {
    const server = await startSignalingServer({port: 0, parts: {echo: echo([])}})
    t.after(() => server.close())

    const socket = await openSocket(server.port)
    await subscribe(socket)
    socket.close()
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

describe('signaling server heartbeat', () => {
  it('terminates clients that stop answering pings and keeps the others', async t => {
    const server = await startSignalingServer({port: 0, heartbeatMs: 50})
    t.after(() => server.close())

    const silent = await openSocket(server.port, {autoPong: false})
    const healthy = await openSocket(server.port)
    const [code] = await once(silent, 'close')

    assert.equal(code, 1006)
    assert.equal(healthy.readyState, WebSocket.OPEN)
    healthy.close()
  })
})
