import {once} from 'node:events'
import {createServer} from 'node:http'
import {createWsRelayServer} from '@trystero-p2p/ws-relay/server'
import {isAllowedOrigin} from './origin.mjs'

// Well below nginx's 90 s proxy_read_timeout and Cloudflare's ~100 s WebSocket idle timeout
const defaultHeartbeatMs = 30_000

// A player's tab holds one socket with 2 subscriptions (the room and its own peer topic). It sends
// messages under 1 KB: about 5 for each other player in the room while it connects to them, then
// one a minute. These limits leave a wide margin over that, and keep one client from taking the
// server's capacity. nginx allows 64 connections per IP (infra/nginx/conf.d/temp-sites.conf), so
// it takes 79 IPs to fill the server, and subscriptions never run out before connections do.
const defaultLimits = {
  maxConnections: 5_000,
  maxSubscriptions: 40_000,
  maxSubscriptionsPerSocket: 8,
  // Bytes. A larger message closes the socket with 1009.
  maxPayload: 64 * 1024,
  // Messages a socket may send at once (enough to join a room of 40), refilled at messagesPerSecond
  messageBurst: 200,
  messagesPerSecond: 20
}

const logError = error => console.error(`signaling error: ${error.message}`)

const handleHttp = (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, {'Content-Type': 'text/plain'}).end('OK')
    return
  }

  response.writeHead(404).end()
}

// The ws-relay server never pings. Ping every client each interval and drop the ones that
// did not answer the previous ping: idle sockets stay open through nginx and Cloudflare,
// and dead connections (a phone that lost its network) release their subscriptions.
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

// Closes a socket that sends more than messageBurst messages at once, or more than
// messagesPerSecond for long. The client reconnects after a few seconds.
const limitMessageRate = (wss, {messageBurst, messagesPerSecond}) => {
  wss.on('connection', socket => {
    let budget = messageBurst
    let lastMessageAt = performance.now()

    // Ahead of ws-relay's own listener, which ignores messages from a closing socket
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

export const startSignalingServer = async ({port, heartbeatMs = defaultHeartbeatMs, limits} = {}) => {
  const {maxConnections, maxSubscriptions, maxSubscriptionsPerSocket, maxPayload, ...rate} = {...defaultLimits, ...limits}
  const server = createServer(handleHttp)
  const wsRelay = createWsRelayServer({
    server,
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

  server.listen(port)
  await once(server, 'listening')

  const close = async () => {
    stopHeartbeat()
    await wsRelay.close()
    server.close()
    await once(server, 'close')
  }

  return {port: server.address().port, close}
}
