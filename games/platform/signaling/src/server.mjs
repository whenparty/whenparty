import {once} from 'node:events'
import {createServer} from 'node:http'
import {createWsRelayServer} from '@trystero-p2p/ws-relay/server'
import {createTransportServer} from '@whenparty/transport/server'
import {WebSocketServer} from 'ws'
import {isAllowedOrigin} from './origin.mjs'
import {turnCredentials} from './turn.mjs'

const defaultHeartbeatMs = 30_000

const defaultLimits = {
  maxConnections: 5_000,
  maxSubscriptions: 40_000,
  maxSubscriptionsPerSocket: 8,
  maxPayload: 64 * 1024,
  messageBurst: 200,
  messagesPerSecond: 20
}

const platformMessageBytes = 65_536

const logError = error => console.error(`signaling error: ${error.message}`)

const handleHttp = turn => (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, {'Content-Type': 'text/plain'}).end('OK')
    return
  }

  if (request.method === 'GET' && request.url === '/turn-credentials') {
    const {origin} = request.headers

    if (!isAllowedOrigin(origin)) {
      response.writeHead(403).end()
      return
    }

    const cors = {'Access-Control-Allow-Origin': origin, Vary: 'Origin'}

    if (!turn) {
      response.writeHead(404, cors).end()
      return
    }

    response
      .writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors})
      .end(JSON.stringify(turnCredentials(turn)))
    return
  }

  response.writeHead(404).end()
}

const startHeartbeat = (wss, intervalMs) => {
  const alive = new WeakSet()

  wss.on('connection', socket => {
    alive.add(socket)
    socket.on('pong', () => alive.add(socket))
  })

  const timer = setInterval(() => {
    for (const socket of wss.clients) {
      if (alive.delete(socket)) {
        socket.ping()
      } else {
        socket.terminate()
      }
    }
  }, intervalMs)

  return () => clearInterval(timer)
}

const limitMessageRate = (wss, {messageBurst, messagesPerSecond}) => {
  wss.on('connection', socket => {
    let budget = messageBurst
    let lastMessageAt = performance.now()

    socket.prependListener('message', () => {
      const now = performance.now()
      budget = Math.min(messageBurst, budget + ((now - lastMessageAt) / 1000) * messagesPerSecond)
      lastMessageAt = now

      if (budget < 1) {
        socket.close(1008, 'message rate limit exceeded')
        return
      }

      budget -= 1
    })
  })
}

export const startSignalingServer = async ({port, heartbeatMs = defaultHeartbeatMs, limits, turn = null, parts = {}} = {}) => {
  const {maxConnections, maxSubscriptions, maxSubscriptionsPerSocket, maxPayload, ...rate} = {...defaultLimits, ...limits}
  const server = createServer(handleHttp(turn))
  const wsRelay = createWsRelayServer({
    port: undefined,
    noServer: true,
    onError: logError,
    maxPayload,
    maxSubscriptions,
    maxSubscriptionsPerSocket,
    verifyClient: ({origin}, done) => {
      if (!isAllowedOrigin(origin)) {
        done(false, 403)
      } else if (wsRelay.wss.clients.size >= maxConnections) {
        done(false, 503)
      } else {
        done(true)
      }
    }
  })
  const stopHeartbeat = startHeartbeat(wsRelay.wss, heartbeatMs)
  limitMessageRate(wsRelay.wss, rate)

  const platform = new WebSocketServer({noServer: true, maxPayload: platformMessageBytes})
  const transport = createTransportServer({
    parts,
    turnSecret: turn?.secret ?? null,
    upgrade: (request, socket, head, done) => platform.handleUpgrade(request, socket, head, done)
  })

  server.on('upgrade', (request, socket, head) => {
    if (!transport.handleUpgrade(request, socket, head)) {
      wsRelay.wss.handleUpgrade(request, socket, head, relaySocket => wsRelay.wss.emit('connection', relaySocket, request))
    }
  })

  server.listen(port)
  await once(server, 'listening')

  const close = async () => {
    stopHeartbeat()
    transport.close()
    platform.close()
    await wsRelay.close()
    server.close()
    await once(server, 'close')
  }

  return {port: server.address().port, close}
}
