import assert from 'node:assert/strict'
import {describe, it, type TestContext} from 'node:test'
import type {PageEvent} from '../transport.ts'
import {invariantViolations, type Model} from '../session-machine.ts'
import {startSession, type Session, type SessionView} from '../session.ts'
import {createNetwork} from './fake-network.ts'
import {createClock} from './clock.ts'
import {race, type Race} from './race.ts'

const seatHoldMs = 40
const seeds = Number(process.env.FUZZ_SEEDS ?? 120)
const firstSeed = Number(process.env.FUZZ_FIRST ?? 1)
const steps = 50
const players = ['a', 'b', 'c', 'd']
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
  leftRoom: boolean
}

const playRoom = async (t: TestContext, seed: number) => {
  const random = generator(seed)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!
  const network = createNetwork()
  const {advance} = createClock(t, () => network.deliverAll())
  const opened: Session<number>[] = []
  t.after(async () => {
    await Promise.all(opened.map(session => session.leave()))
    await network.deliverAll()
  })
  const views = new Map<string, SessionView<Race>>()
  const problems: string[] = []
  const log: string[] = []
  const terms = new Map<string, number>()
  const models = new Map<string, Model<Race, number>>()
  const tabs = new Map<string, Tab>()
  const unnoticed = new Set<string>()
  let reloads = 0

  const observe = (id: string) => (model: Model<Race, number>) => {
    models.set(id, model)
    invariantViolations(model).forEach(problem => problems.push(`${id}: ${problem}`))
    if (model.phase.name === 'hosting' && model.config.self.playerId !== 'a') {
      problems.push(`${id}: a guest became host`)
    }
    const room = 'room' in model.phase ? model.phase.room : null
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
        seatHoldMs,
        restoreGraceMs: 5,
        onChange: view => views.set(id, view)
      },
      network.transport(id),
      observe(id)
    )
    opened.push(session)
    tabs.set(id, {player, session, page: 'shown', leftRoom: false})
  }

  const live = () => [...tabs.keys()]
  // A tab that left the room, or whose page went, has no connection to link to
  const linkable = () => live().filter(id => !tabs.get(id)?.leftRoom && tabs.get(id)?.page !== 'gone')
  const pairs = () =>
    linkable().flatMap((first, index) =>
      linkable()
        .slice(index + 1)
        .map(second => [first, second] as const)
    )
  const connectAll = () => pairs().forEach(([first, second]) => network.connect(first, second))

  players.forEach(player => open(player, player, player === 'a'))
  connectAll()
  await network.deliverAll()

  for (let index = 0; index < steps; index++) {
    const rolled = random()
    const pair = pick(pairs()) as readonly [string, string] | undefined
    const id = pick(live())
    // Without two linkable tabs, nothing can be cut, noticed or connected
    const roll = pair ? rolled : Math.max(rolled, 0.5)
    const [first, second] = pair ?? [id, id]
    const tab = tabs.get(id)!

    if (roll < 0.18) {
      log.push(`cut ${first}-${second}`)
      network.cutLink(first, second)
      unnoticed.add(`${first}>${second}`).add(`${second}>${first}`)
    } else if (roll < 0.36 && unnoticed.size > 0) {
      const link = pick([...unnoticed])
      const [observer, peer] = link.split('>') as [string, string]
      log.push(`${observer} notices ${peer}`)
      unnoticed.delete(link)
      network.detectLoss(observer, peer)
    } else if (roll < 0.5) {
      log.push(`connect ${first}-${second}`)
      unnoticed.delete(`${first}>${second}`)
      unnoticed.delete(`${second}>${first}`)
      network.connect(first, second)
    } else if (roll < 0.68) {
      const event: PageEvent =
        tab.page === 'gone' ? 'shown' : tab.page === 'hidden' ? pick(['back', 'gone'] as const) : pick(['away', 'gone'] as const)
      log.push(`${id} page ${event}`)
      tab.page = event === 'away' ? 'hidden' : event === 'gone' ? 'gone' : 'shown'
      network.page(id, event)
    } else if (roll < 0.74) {
      const next = `${tab.player}${++reloads}`
      const hosted = views.get(id)?.isHost ?? false
      log.push(`${id} reloads as ${next}${hosted ? ', rejoining as host' : ''}`)
      live().forEach(other => {
        network.cutLink(id, other)
        unnoticed.add(`${other}>${id}`)
      })
      tabs.delete(id)
      open(next, tab.player, false, hosted)
      linkable()
        .filter(other => other !== next && random() < 0.7)
        .forEach(other => network.connect(next, other))
    } else if (roll < 0.78) {
      const next = `${tab.player}${++reloads}`
      log.push(`${id} opens a second tab ${next}`)
      open(next, tab.player, false)
      linkable()
        .filter(other => other !== next && random() < 0.7)
        .forEach(other => network.connect(next, other))
    } else if (roll < 0.8 && !tab.leftRoom) {
      log.push(`${id} leaves`)
      tab.leftRoom = true
      void tab.session.leave()
    } else {
      log.push(`${id} moves`)
      tab.session.send({type: 'move', move: pick([1, 2])})
    }

    await network.deliverNextBatch()

    if (random() < 0.5) {
      await advance(Math.floor(random() * 12))
    }
  }
  log.push('heal')
  unnoticed.forEach(link => {
    const [observer, peer] = link.split('>') as [string, string]
    network.detectLoss(observer, peer)
  })
  tabs.forEach((tab, id) => {
    if (tab.page === 'hidden') {
      network.page(id, 'back')
    } else if (tab.page === 'gone') {
      network.page(id, 'shown')
    }
    tab.page = 'shown'
  })
  for (let round = 0; round < 3; round++) {
    await network.deliverAll()
    connectAll()
    await network.deliverAll()
  }
  await advance(seatHoldMs + 1)
  await network.deliverAll()
  const ends = live().map(id => {
    const model = models.get(id)
    const room = model && 'room' in model.phase ? model.phase.room : null
    const members = room?.members.map(member => member.peerId).join(',')
    return `${id}: ${model?.phase.name}${room ? ` [${members}] term ${room.term}` : ''}`
  })
  const inRoom = live().filter(id => !tabs.get(id)?.leftRoom && !views.get(id)?.hostLeft)
  const newcomers = inRoom.every(id => {
    const phase = models.get(id)?.phase
    return phase?.name === 'waiting'
  })

  return {views, inRoom: newcomers ? [] : inRoom, problems, log: [...log, ...ends]}
}

describe('random rooms', () => {
  for (let seed = firstSeed; seed < firstSeed + seeds; seed++) {
    it(`keeps the creator and converges or closes (seed ${seed})`, async t => {
      const {views, inRoom, problems, log} = await playRoom(t, seed)
      const context = `\n${log.join('\n')}`

      assert.deepEqual(problems, [], context)
      if (inRoom.length === 0) {
        return
      }

      const hosts = new Set(inRoom.map(id => views.get(id)?.room?.members[0]?.peerId))

      assert.equal(hosts.size, 1, `hosts ${[...hosts].join(', ')}${context}`)

      const [host] = hosts
      inRoom.forEach(id => assert.equal(views.get(id)?.room?.hostId, 'a', `${id}${context}`))

      assert.ok(host && inRoom.includes(host), `host ${host} is not in the room${context}`)
      inRoom.forEach(id => assert.equal(views.get(id)?.isHost, id === host, `${id}${context}`))
    })
  }
})
