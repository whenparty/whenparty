// Random rooms: links that drop and come back, links noticed late or never, pages hidden, unloaded
// and back from the cache, tabs that reload or leave, and moves meanwhile. After every event each session must keep the
// invariants of session-machine.ts and never go back to an older term. Once every link is back,
// every page shown and things had time to settle, the room must have one host that everyone follows.
import assert from 'node:assert/strict'
import {setTimeout as sleep} from 'node:timers/promises'
import {describe, it} from 'node:test'
import type {PageEvent} from '../transport.ts'
import {invariantViolations, type Model} from '../session-machine.ts'
import {startSession, type Session, type SessionView} from '../session.ts'
import {createNetwork} from './fake-network.ts'
import {race, type Race} from './race.ts'

const takeoverDelayMs = 4
// More with FUZZ_SEEDS=500 npm test, and from another seed with FUZZ_FIRST
const seeds = Number(process.env.FUZZ_SEEDS ?? 24)
const firstSeed = Number(process.env.FUZZ_FIRST ?? 1)
const steps = 50
const players = ['a', 'b', 'c', 'd']

// A small seeded generator, so a failure can be replayed
const generator = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

interface Tab {
  player: string
  session: Session<number>
  page: 'shown' | 'hidden' | 'gone'
  // It left on purpose
  left: boolean
}

const playRoom = async (seed: number) => {
  const random = generator(seed)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!
  const network = createNetwork()
  const views = new Map<string, SessionView<Race>>()
  const problems: string[] = []
  const log: string[] = []
  const terms = new Map<string, number>()
  const models = new Map<string, Model<Race, number>>()
  // The tabs still open, by peer. A tab that reloads is replaced by a new one of its player.
  const tabs = new Map<string, Tab>()
  // Links cut that a side has not noticed yet
  const unnoticed = new Set<string>()
  let reloads = 0

  const observe = (id: string) => (model: Model<Race, number>) => {
    models.set(id, model)
    invariantViolations(model).forEach(problem => problems.push(`${id}: ${problem}`))
    const room = 'room' in model.phase ? model.phase.room : null
    // A new incarnation starts each time it waits for a host again
    const last = model.phase.name === 'waiting' ? -1 : (terms.get(id) ?? -1)

    if (room && room.term < last) {
      problems.push(`${id}: term went back from ${last} to ${room.term}`)
    }

    terms.set(id, room ? room.term : last)
  }

  const open = (id: string, player: string, isHost: boolean, rejoinAsHost = false) => {
    const session = startSession(
      {
        appId: 'fuzz',
        code: 'ROOM',
        playerId: player,
        isHost,
        rejoinAsHost,
        rules: race,
        takeoverDelayMs,
        seatHoldMs: takeoverDelayMs * 10,
        onChange: view => views.set(id, view)
      },
      network.transport(id),
      observe(id)
    )
    tabs.set(id, {player, session, page: 'shown', left: false})
  }

  const live = () => [...tabs.keys()]
  const pairs = () => live().flatMap((first, index) => live().slice(index + 1).map(second => [first, second] as const))
  const connectAll = () => pairs().forEach(([first, second]) => network.connect(first, second))

  players.forEach(player => open(player, player, player === 'a'))
  connectAll()
  await network.settle()

  for (let index = 0; index < steps; index++) {
    const roll = random()
    const [first, second] = pick(pairs())
    const id = pick(live())
    const tab = tabs.get(id)!

    if (roll < 0.18) {
      log.push(`cut ${first}-${second}`)
      network.cut(first, second)
      unnoticed.add(`${first}>${second}`).add(`${second}>${first}`)
    } else if (roll < 0.36 && unnoticed.size > 0) {
      const link = pick([...unnoticed])
      const [observer, peer] = link.split('>') as [string, string]
      log.push(`${observer} notices ${peer}`)
      unnoticed.delete(link)
      network.notice(observer, peer)
    } else if (roll < 0.5) {
      log.push(`connect ${first}-${second}`)
      unnoticed.delete(`${first}>${second}`)
      unnoticed.delete(`${second}>${first}`)
      network.connect(first, second)
    } else if (roll < 0.68) {
      const event: PageEvent =
        tab.page === 'gone' ? 'shown' : tab.page === 'hidden' ? pick(['back', 'gone'] as const) : pick(['away', 'leaving', 'gone'] as const)
      log.push(`${id} page ${event}`)
      tab.page = event === 'away' ? 'hidden' : event === 'gone' ? 'gone' : 'shown'
      network.page(id, event)
    } else if (roll < 0.74) {
      // The tab reloads: its links go quiet, and a new tab of the same player joins. The old one
      // is never heard from again. A tab that hosted comes back to host again (rejoinAsHost).
      const next = `${tab.player}${++reloads}`
      const hosted = views.get(id)?.isHost ?? false
      log.push(`${id} reloads as ${next}${hosted ? ', rejoining as host' : ''}`)
      live().forEach(other => {
        network.cut(id, other)
        unnoticed.add(`${other}>${id}`)
      })
      tabs.delete(id)
      open(next, tab.player, false, hosted)
      live()
        .filter(other => other !== next && random() < 0.7)
        .forEach(other => network.connect(next, other))
    } else if (roll < 0.76 && !tab.left) {
      log.push(`${id} leaves`)
      tab.left = true
      void tab.session.leave()
    } else {
      log.push(`${id} moves`)
      tab.session.send({type: 'move', move: pick([1, 2])})
    }

    await network.turn()

    if (random() < 0.5) {
      await sleep(Math.floor(random() * takeoverDelayMs * 3))
    }
  }

  // Everything comes back: WebRTC gives up on every link that is gone, pages are shown, every link
  // is up, and what joined again meets the rest
  log.push('heal')
  unnoticed.forEach(link => {
    const [observer, peer] = link.split('>') as [string, string]
    network.notice(observer, peer)
  })
  tabs.forEach((tab, id) => {
    if (tab.page === 'hidden') {
      network.page(id, 'back')
    } else if (tab.page === 'gone') {
      network.page(id, 'shown')
    }
  })

  // The fake network links a tab that joined again only when told to, where the signaling server
  // would at once. So it links everyone again until no tab has joined again for two rounds.
  const joins = () => live().map(id => network.joins(id)).join()
  let quiet = 0

  for (let round = 0; round < 40 && quiet < 2; round++) {
    const before = joins()
    await network.settle()
    connectAll()
    await sleep(takeoverDelayMs * 4)
    quiet = joins() === before ? quiet + 1 : 0
  }

  await network.settle()

  // Where each session ended up, for the failure message
  const ends = live().map(id => {
    const model = models.get(id)
    const room = model && 'room' in model.phase ? model.phase.room : null
    const members = room?.members.map(member => member.peerId).join(',')
    return `${id}: ${model?.phase.name}${room ? ` [${members}] term ${room.term} ${room.origin}` : ''}`
  })

  // The tabs that should be in the room: open, not left, and not told the host left
  const inRoom = live().filter(id => !tabs.get(id)?.left && !views.get(id)?.hostLeft)
  // Every tab left is new to the room and waits for a host, which only the player can change
  const newcomers = inRoom.every(id => {
    const phase = models.get(id)?.phase
    return phase?.name === 'waiting' && phase.reclaim === null
  })

  return {views, inRoom: newcomers ? [] : inRoom, problems, log: [...log, ...ends]}
}

describe('random rooms', () => {
  for (let seed = firstSeed; seed < firstSeed + seeds; seed++) {
    it(`keeps the invariants and ends with one host (seed ${seed})`, async () => {
      const {views, inRoom, problems, log} = await playRoom(seed)
      const context = `\n${log.join('\n')}`

      assert.deepEqual(problems, [], context)

      // Nobody left to agree, or only newcomers waiting for a host
      if (inRoom.length === 0) {
        return
      }

      const hosts = new Set(inRoom.map(id => views.get(id)?.room?.members[0]?.peerId))

      assert.equal(hosts.size, 1, `hosts ${[...hosts].join(', ')}${context}`)

      const [host] = hosts

      assert.ok(host && inRoom.includes(host), `host ${host} is not in the room${context}`)
      inRoom.forEach(id => assert.equal(views.get(id)?.isHost, id === host, `${id}${context}`))
    })
  }
})
