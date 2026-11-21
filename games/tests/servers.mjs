import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {createRoomsServer, roomsModule} from '../platform/rooms/src/server/index.ts'
import {startSignalingServer} from '../platform/signaling/src/server.mjs'

const games = fileURLToPath(new URL('..', import.meta.url))
const unwatched = {strictPort: true, hmr: false, watch: null}

export default async () => {
  const secret = process.env.GAMES_TURN_SECRET
  if (!secret) {
    throw new Error('GAMES_TURN_SECRET is not set: run the browser tests with tests/browser.sh')
  }
  const signaling = await Promise.all([
    startSignalingServer({port: 8080, parts: {[roomsModule]: createRoomsServer()}}),
    startSignalingServer({port: 8081, turnSecret: secret})
  ])
  const pages = await Promise.all([
    createServer({configFile: false, root: games, server: {port: 5173, ...unwatched}}),
    createServer({root: `${games}titles/tictactoe`, server: {port: 5174, ...unwatched}}),
    createServer({root: `${games}titles/calisthenics`, server: {port: 5175, ...unwatched}})
  ])
  await Promise.all(pages.map(server => server.listen()))
  return async () => {
    await Promise.all([...signaling, ...pages].map(server => server.close()))
  }
}
