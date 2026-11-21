import {once} from 'node:events'
import {createServer} from 'node:http'
import {createTransportServer} from '@whenparty/transport/server'
import {WebSocketServer} from 'ws'

const platformMessageBytes = 65_536

const handleHttp = (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, {'Content-Type': 'text/plain'}).end('OK')
    return
  }

  response.writeHead(404).end()
}

const refuseUpgrade = socket => {
  socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
  socket.destroy()
}

export const startSignalingServer = async ({port, turnSecret = null, parts = {}} = {}) => {
  const server = createServer(handleHttp)
  const platform = new WebSocketServer({noServer: true, maxPayload: platformMessageBytes})
  const transport = createTransportServer({
    parts,
    turnSecret,
    upgrade: (request, socket, head, done) => platform.handleUpgrade(request, socket, head, done)
  })

  server.on('upgrade', (request, socket, head) => {
    if (!transport.handleUpgrade(request, socket, head)) {
      refuseUpgrade(socket)
    }
  })

  server.listen(port)
  await once(server, 'listening')

  const close = async () => {
    transport.close()
    platform.close()
    server.close()
    await once(server, 'close')
  }

  return {port: server.address().port, close}
}
