import {startSignalingServer} from './server.mjs'
import {turnFromEnv} from './turn.mjs'

const turn = turnFromEnv(process.env)
const server = await startSignalingServer({port: Number(process.env.PORT ?? 8080), turn})
console.log(`Trystero signaling server listening on port ${server.port}, TURN credentials ${turn ? 'on' : 'off'}`)

const shutdown = async () => {
  await server.close()
  process.exit(0)
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
