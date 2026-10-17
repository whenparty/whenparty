import {startSignalingServer} from './server.mjs'

const server = await startSignalingServer({port: Number(process.env.PORT ?? 8080)})
console.log(`Trystero signaling server listening on port ${server.port}`)

const shutdown = async () => {
  await server.close()
  process.exit(0)
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
