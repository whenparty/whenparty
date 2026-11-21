import {createRoomsServer, roomsModule} from '@whenparty/rooms/server'
import {startSignalingServer} from './server.mjs'

const turnSecret = process.env.TURN_SECRET || null
const server = await startSignalingServer({port: Number(process.env.PORT ?? 8080), turnSecret, parts: {[roomsModule]: createRoomsServer()}})
console.log(`Signaling server listening on port ${server.port}, TURN credentials ${turnSecret ? 'on' : 'off'}`)

const shutdown = async () => {
  await server.close()
  process.exit(0)
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
