import {once} from 'node:events'
import {createServer} from 'node:http'
import {createWsRelayServer} from '@trystero-p2p/ws-relay/server'
import {isAllowedOrigin} from './origin.mjs'

// Well below nginx's 90 s proxy_read_timeout and Cloudflare's ~100 s WebSocket idle timeout
const defaultHeartbeatMs = 30_000

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

export const startSignalingServer = async ({port, heartbeatMs = defaultHeartbeatMs} = {}) => {
  const server = createServer(handleHttp)
  const wsRelay = createWsRelayServer({
    server,
    onError: logError,
    verifyClient: ({origin}, done) => done(isAllowedOrigin(origin), 403)
  })
  const stopHeartbeat = startHeartbeat(wsRelay.wss, heartbeatMs)

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
