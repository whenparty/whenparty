import {startRelay} from './relay.mjs'

const relay = await startRelay({port: Number(process.env.PORT ?? 8080)})
console.log(`Trystero relay listening on port ${relay.port}`)

const shutdown = async () => {
  await relay.close()
  process.exit(0)
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
