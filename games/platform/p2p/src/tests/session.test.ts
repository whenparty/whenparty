import assert from 'node:assert/strict'
import {setTimeout as sleep} from 'node:timers/promises'
import {describe, it} from 'node:test'
import type {GameRules} from '../room-state.ts'
import {startSession, type SessionOptions, type SessionView} from '../session.ts'
import {createNetwork} from './fake-network.ts'

// Three seats that move in turn, so every move shows up in the state
interface Turns {
  moves: string[]
  turn: number
}

const seats = ['A', 'B', 'C']

const turns: GameRules<Turns, 'go'> = {
  seats,
  createState: () => ({moves: [], turn: 0}),
  applyMove: (state, seat) =>
    seat === seats[state.turn] ? {moves: [...state.moves, seat], turn: (state.turn + 1) % seats.length} : null,
  isOver: () => false,
  isMove: (value): value is 'go' => value === 'go',
  isState: (value): value is Turns =>
    typeof value === 'object' && value !== null && Array.isArray((value as Turns).moves)
}

const takeoverDelayMs = 5

// Host a, then guests b and c, seated A, B and C
const startRoom = async (options: Partial<SessionOptions<Turns, 'go'>> = {}) => {
  const network = createNetwork()
  const views = new Map<string, SessionView<Turns>>()
  const start = (selfId: string, isHost: boolean, more: Partial<SessionOptions<Turns, 'go'>> = {}) =>
    startSession(
      {
        appId: 'test',
        code: 'ROOM',
        playerId: selfId,
        isHost,
        rules: turns,
        takeoverDelayMs,
        onChange: view => views.set(selfId, view),
        ...options,
        ...more
      },
      network.transport(selfId)
    )
  const sessions = {a: start('a', true), b: start('b', false), c: start('c', false)}
  const seatsOf = (selfId: string) => views.get(selfId)?.room?.seats

  network.connect('a', 'b')
  network.connect('a', 'c')
  network.connect('b', 'c')
  await network.settle()

  // Hosts and members are read as players: in these tests a tab is named after its player
  // unless it is given one
  const hostOf = (selfId: string) => views.get(selfId)?.room?.members[0]?.playerId
  const movesOf = (selfId: string) => views.get(selfId)?.room?.game.moves
  const handledOf = (selfId: string, sender: string) => views.get(selfId)?.room?.handled[sender]
  const membersOf = (selfId: string) => views.get(selfId)?.room?.members.map(member => member.playerId)

  return {network, sessions, views, start, hostOf, movesOf, handledOf, membersOf, seatsOf}
}

const go = {type: 'move', move: 'go'} as const

describe('startSession', () => {
  it('hands the room to the next member after the pause, and the others follow', async () => {
    const {network, sessions, hostOf, movesOf} = await startRoom()

    sessions.a.send(go)
    await network.settle()
    network.cut('a', 'b')
    network.cut('a', 'c')
    network.notice('b', 'a')
    network.notice('c', 'a')
    await sleep(takeoverDelayMs * 4)
    await network.settle()

    assert.equal(hostOf('b'), 'b')
    assert.equal(hostOf('c'), 'b')
    assert.deepEqual(movesOf('c'), ['A'])
  })

  it('keeps the old host when it comes back within the pause', async () => {
    const {network, hostOf} = await startRoom()

    network.cut('a', 'b')
    network.notice('b', 'a')
    network.connect('a', 'b')
    await sleep(takeoverDelayMs * 4)
    await network.settle()

    assert.equal(hostOf('b'), 'a')
    assert.equal(hostOf('c'), 'a')
  })

  it('follows a new host before noticing the old one gone, and resends', async () => {
    const {network, sessions, hostOf, movesOf, handledOf} = await startRoom()

    sessions.a.send(go)
    await network.settle()
    sessions.b.send(go)
    await network.settle()

    // It's c's turn. The host's links drop, but only b notices for now.
    network.cut('a', 'b')
    network.cut('a', 'c')
    network.notice('b', 'a')
    sessions.c.send(go)
    await sleep(takeoverDelayMs * 4)
    await network.settle()

    // c's move went to a and was lost. c follows b right away and sends it again, and b applies
    // it: a keeps its seat for now, so the room is still full.
    assert.equal(hostOf('b'), 'b')
    assert.equal(hostOf('c'), 'b')
    assert.equal(handledOf('b', 'c'), 1)
    assert.equal(handledOf('c', 'c'), 1)
    assert.deepEqual(movesOf('c'), ['A', 'B', 'C'])
  })

  it('moves everyone to the new host after a short blip at the old one', async () => {
    const {network, sessions, views, hostOf, movesOf} = await startRoom()

    sessions.a.send(go)
    await network.settle()

    // Only the a-b link drops, and only b notices. c never loses a.
    network.cut('a', 'b')
    network.notice('b', 'a')
    await sleep(takeoverDelayMs * 4)
    await network.settle()
    network.connect('a', 'b')
    await network.settle()

    for (const selfId of ['a', 'b', 'c']) {
      assert.equal(hostOf(selfId), 'b', selfId)
      assert.equal(views.get(selfId)?.room?.term, 1, selfId)
      assert.equal(views.get(selfId)?.isHost, selfId === 'b', selfId)
    }

    // a is back in its old seat, so the room is full and c's move counts
    sessions.b.send(go)
    await network.settle()
    sessions.c.send(go)
    await network.settle()

    assert.deepEqual(movesOf('b'), ['A', 'B', 'C'])
    assert.deepEqual(movesOf('c'), ['A', 'B', 'C'])
  })
  it('moves everyone to the new host when the old one noticed the blip first', async () => {
    const {network, sessions, views, hostOf} = await startRoom()

    sessions.a.send(go)
    await network.settle()

    // Both ends of the a-b link notice. a keeps b as a member for a while, so c still counts b as
    // next in line when b's snapshot arrives.
    network.cut('a', 'b')
    network.notice('a', 'b')
    network.notice('b', 'a')
    await sleep(takeoverDelayMs * 4)
    await network.settle()
    network.connect('a', 'b')
    await network.settle()

    for (const selfId of ['a', 'b', 'c']) {
      assert.equal(hostOf(selfId), 'b', selfId)
      assert.equal(views.get(selfId)?.room?.term, 1, selfId)
    }
  })

  it('drops a member whose link dropped only after twice the pause', async () => {
    const {network, membersOf} = await startRoom()

    network.cut('a', 'c')
    network.notice('a', 'c')
    await network.settle()

    assert.deepEqual(membersOf('a'), ['a', 'b', 'c'])

    await sleep(takeoverDelayMs * 4)
    await network.settle()

    assert.deepEqual(membersOf('a'), ['a', 'b'])
    assert.deepEqual(membersOf('b'), ['a', 'b'])
  })

  it('keeps the place and seat of a member that comes back in time', async () => {
    const {network, views, membersOf} = await startRoom()

    // Only a notices, so b doesn't take over. Dropped and added again, b would be last.
    network.cut('a', 'b')
    network.notice('a', 'b')
    network.connect('a', 'b')
    await sleep(takeoverDelayMs * 4)
    await network.settle()

    assert.deepEqual(membersOf('a'), ['a', 'b', 'c'])
    assert.equal(views.get('a')?.room?.seats.B, 'b')
  })

  it('drops a member that says goodbye at once', async () => {
    const {network, sessions, views, membersOf} = await startRoom()

    await sessions.c.leave()
    await network.settle()

    assert.deepEqual(membersOf('a'), ['a', 'b'])
    assert.equal(views.get('a')?.room?.seats.C, null)
  })

  it('gives a reloaded player its seat back at once, and lets the new tab play', async () => {
    const {network, sessions, views, start, movesOf, seatsOf} = await startRoom()

    // c's tab reloads: its old connection just goes quiet, and c2 joins as the same player
    network.cut('a', 'c')
    network.cut('b', 'c')
    network.notice('a', 'c')
    network.notice('b', 'c')
    const c2 = start('c2', false, {playerId: 'c'})
    network.connect('a', 'c2')
    network.connect('b', 'c2')
    await network.settle()

    assert.equal(seatsOf('a')?.C, 'c')
    assert.equal(views.get('c2')?.inControl, true)

    sessions.a.send(go)
    await network.settle()
    sessions.b.send(go)
    await network.settle()
    c2.send(go)
    await network.settle()

    assert.deepEqual(movesOf('c2'), ['A', 'B', 'C'])

    // The old connection is never dropped as the player
    await sleep(takeoverDelayMs * 4)
    await network.settle()

    assert.equal(seatsOf('a')?.C, 'c')
  })

  it('lets a second tab of a player take over its seat, and the first tab only watches', async () => {
    const {network, sessions, views, start, movesOf, seatsOf} = await startRoom()

    sessions.a.send(go)
    await network.settle()
    sessions.b.send(go)
    await network.settle()
    const c2 = start('c2', false, {playerId: 'c'})
    network.connect('a', 'c2')
    network.connect('b', 'c2')
    network.connect('c', 'c2')
    await network.settle()

    assert.equal(seatsOf('a')?.C, 'c')
    assert.equal(views.get('c')?.inControl, false)
    assert.equal(views.get('c2')?.inControl, true)
    assert.deepEqual(movesOf('c2'), ['A', 'B'])

    // The host ignores the old tab and plays with the new one
    sessions.c.send(go)
    await network.settle()

    assert.deepEqual(movesOf('a'), ['A', 'B'])

    c2.send(go)
    await network.settle()

    assert.deepEqual(movesOf('a'), ['A', 'B', 'C'])
    assert.deepEqual(movesOf('c'), ['A', 'B', 'C'])
  })

  it("hands the room to the host's second tab, and everyone follows", async () => {
    const {network, views, start, hostOf} = await startRoom()

    start('a2', false, {playerId: 'a'})
    network.connect('a', 'a2')
    network.connect('b', 'a2')
    network.connect('c', 'a2')
    await network.settle()

    for (const selfId of ['a', 'a2', 'b', 'c']) {
      assert.equal(views.get(selfId)?.room?.members[0]?.peerId, 'a2', selfId)
      assert.equal(views.get(selfId)?.room?.term, 1, selfId)
      assert.equal(views.get(selfId)?.isHost, selfId === 'a2', selfId)
    }
    assert.equal(hostOf('b'), 'a')
    assert.equal(views.get('a')?.inControl, false)
  })

  it('says goodbye only when it leaves on purpose, not when the page unloads', async () => {
    const {network, sessions, membersOf} = await startRoom()

    network.page('c', 'leaving')

    assert.equal(network.sends('c', 'bye'), 0)

    await sessions.c.leave()
    await network.settle()

    assert.equal(network.sends('c', 'bye'), 1)
    assert.deepEqual(membersOf('a'), ['a', 'b'])
  })

  it('joins again when the page stays after beforeunload, and finds its seat', async () => {
    const {network, hostOf, seatsOf} = await startRoom()

    // The user cancels leaving. Trystero left the room, so c joins it again.
    network.page('c', 'leaving')
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    assert.equal(network.joins('c'), 2)

    network.connect('a', 'c')
    network.connect('b', 'c')
    await network.settle()

    assert.equal(hostOf('c'), 'a')
    assert.equal(seatsOf('a')?.C, 'c')
  })

  it('does not join again when the page goes after beforeunload', async () => {
    const {network} = await startRoom()

    network.page('c', 'leaving')
    network.page('c', 'gone')
    await sleep(takeoverDelayMs * 3)

    assert.equal(network.joins('c'), 1)
  })

  it('comes back from the back-forward cache as a guest of the room under its new host', async () => {
    const {network, views, hostOf} = await startRoom()

    // The host's page goes into the cache and its links close. b takes over after the pause.
    network.page('a', 'gone')
    await network.settle()
    network.cut('a', 'b')
    network.cut('a', 'c')
    network.notice('b', 'a')
    network.notice('c', 'a')
    await sleep(takeoverDelayMs * 2)
    await network.settle()

    assert.equal(hostOf('b'), 'b')

    // a joins again once it has left, and meets the others
    network.page('a', 'shown')
    await network.settle()
    network.connect('a', 'b')
    network.connect('a', 'c')
    await network.settle()
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    assert.equal(network.joins('a'), 2)
    assert.equal(hostOf('a'), 'b')
    assert.equal(views.get('a')?.isHost, false)
  })

  it('holds the seat of a member that stepped away and lost its link, until awayHoldMs', async () => {
    const {network, membersOf, seatsOf} = await startRoom({awayHoldMs: takeoverDelayMs * 8})

    // c's phone hides the page, then freezes it, and its links drop
    network.page('c', 'away')
    await network.settle()
    network.cut('a', 'c')
    network.cut('b', 'c')
    network.notice('a', 'c')
    network.notice('b', 'c')
    await sleep(takeoverDelayMs * 4)
    await network.settle()

    // Twice the pause has passed, but c still has its seat
    assert.deepEqual(membersOf('a'), ['a', 'b', 'c'])
    assert.equal(seatsOf('a')?.C, 'c')

    await sleep(takeoverDelayMs * 6)
    await network.settle()

    assert.deepEqual(membersOf('a'), ['a', 'b'])
  })

  it('gives a member that stepped away its seat back when it returns', async () => {
    const {network, sessions, movesOf, seatsOf} = await startRoom({awayHoldMs: takeoverDelayMs * 8})

    network.page('c', 'away')
    await network.settle()
    network.cut('a', 'c')
    network.notice('a', 'c')
    await sleep(takeoverDelayMs * 4)
    network.connect('a', 'c')
    network.page('c', 'back')
    await network.settle()

    assert.equal(seatsOf('a')?.C, 'c')

    sessions.a.send(go)
    await network.settle()
    sessions.b.send(go)
    await network.settle()
    sessions.c.send(go)
    await network.settle()

    assert.deepEqual(movesOf('c'), ['A', 'B', 'C'])
  })

  it('holds a member that came back for the normal pause again, even if its word was lost', async () => {
    const {network, membersOf} = await startRoom({awayHoldMs: takeoverDelayMs * 100})

    // c says it is away, loses its links, and says it is back while they are still down
    network.page('c', 'away')
    await network.settle()
    network.cut('a', 'c')
    network.notice('a', 'c')
    network.page('c', 'back')
    // Its links come back, and it tells a again as they join
    network.connect('a', 'c')
    await network.settle()

    network.cut('a', 'c')
    network.notice('a', 'c')
    await sleep(takeoverDelayMs * 4)
    await network.settle()

    assert.deepEqual(membersOf('a'), ['a', 'b'])
  })

  it("keeps the old host's seat on a handover, and drops it only after the wait", async () => {
    const {network, views, hostOf, membersOf, seatsOf} = await startRoom()

    network.cut('a', 'b')
    network.cut('a', 'c')
    network.notice('b', 'a')
    network.notice('c', 'a')
    await sleep(takeoverDelayMs * 2)
    await network.settle()

    // b hosts. a is last in line, in its seat, and everyone sees it is offline.
    assert.equal(hostOf('c'), 'b')
    assert.deepEqual(membersOf('b'), ['b', 'c', 'a'])
    assert.equal(seatsOf('c')?.A, 'a')
    assert.deepEqual(views.get('c')?.room?.absent, {a: 'offline'})

    await sleep(takeoverDelayMs * 3)
    await network.settle()

    assert.deepEqual(membersOf('c'), ['b', 'c'])
    assert.equal(seatsOf('c')?.A, null)
  })

  it('tells everyone who stepped away or lost the connection', async () => {
    const {network, views} = await startRoom({awayHoldMs: takeoverDelayMs * 100})
    const absentFor = (selfId: string) => views.get(selfId)?.room?.absent

    network.page('c', 'away')
    await network.settle()

    assert.deepEqual(absentFor('b'), {c: 'away'})

    network.cut('a', 'c')
    network.notice('a', 'c')
    await network.settle()

    assert.deepEqual(absentFor('b'), {c: 'offline'})

    network.connect('a', 'c')
    await network.settle()

    assert.deepEqual(absentFor('b'), {c: 'away'})

    network.page('c', 'back')
    await network.settle()

    assert.deepEqual(absentFor('b'), {})
    assert.deepEqual(absentFor('c'), {})
  })

  it('gives a link that keeps dropping one wait in all', async () => {
    const pause = 40
    const {network, membersOf} = await startRoom({takeoverDelayMs: pause})

    // c drops, comes back within the wait, and drops again as the wait runs out
    network.cut('a', 'c')
    network.notice('a', 'c')
    await sleep(pause)
    network.connect('a', 'c')
    await network.settle()
    await sleep(pause)
    network.cut('a', 'c')
    network.notice('a', 'c')
    await network.settle()

    assert.deepEqual(membersOf('a'), ['a', 'b'])
  })

  it('gives a link that held for a while a fresh wait when it drops again', async () => {
    const pause = 40
    const {network, membersOf} = await startRoom({takeoverDelayMs: pause})

    network.cut('a', 'c')
    network.notice('a', 'c')
    await sleep(pause)
    network.connect('a', 'c')
    await network.settle()
    await sleep(pause * 3)
    network.cut('a', 'c')
    network.notice('a', 'c')
    await network.settle()

    assert.deepEqual(membersOf('a'), ['a', 'b', 'c'])

    await sleep(pause * 3)
    await network.settle()

    assert.deepEqual(membersOf('a'), ['a', 'b'])
  })

  it('hands the room over from a host that stepped away, and keeps its seat', async () => {
    const {network, sessions, views, hostOf, movesOf, membersOf, seatsOf} = await startRoom({awayHoldMs: takeoverDelayMs * 8})

    sessions.a.send(go)
    await network.settle()
    network.page('a', 'away')
    await network.settle()
    network.cut('a', 'b')
    network.cut('a', 'c')
    network.notice('b', 'a')
    network.notice('c', 'a')
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    // b hosts now, so b and c can go on. a keeps seat A, last in line.
    assert.equal(hostOf('c'), 'b')
    assert.deepEqual(membersOf('b'), ['b', 'c', 'a'])
    assert.equal(seatsOf('b')?.A, 'a')

    // a comes back, follows b, and its seat is still there
    network.connect('a', 'b')
    network.connect('a', 'c')
    network.page('a', 'back')
    await network.settle()

    assert.equal(hostOf('a'), 'b')
    assert.equal(views.get('a')?.isHost, false)
    assert.equal(seatsOf('b')?.A, 'a')
    assert.deepEqual(movesOf('a'), ['A'])
  })

  it('folds a room started under the code into the older room, which keeps its game', async () => {
    const {network, sessions, views, start, hostOf, movesOf} = await startRoom()

    sessions.a.send(go)
    await network.settle()
    // '0' sorts before every other peer ID, so only the mark can make it lose
    start('0', true, {provisional: true})
    network.connect('0', 'a')
    network.connect('0', 'b')
    network.connect('0', 'c')
    await network.settle()

    for (const selfId of ['0', 'a', 'b', 'c']) {
      assert.equal(hostOf(selfId), 'a', selfId)
      assert.deepEqual(movesOf(selfId), ['A'], selfId)
    }
    assert.equal(views.get('0')?.isHost, false)
  })

  it('joins again instead of taking over after being away, so the host keeps what it did meanwhile', async () => {
    const {network, sessions, views, hostOf, movesOf, seatsOf} = await startRoom()

    // b is next in line. Its phone hides and freezes the page, and its links drop.
    network.page('b', 'away')
    await network.settle()
    network.cut('a', 'b')
    network.cut('b', 'c')
    network.notice('a', 'b')
    network.notice('c', 'b')
    // a moves while b is frozen
    sessions.a.send(go)
    await network.settle()

    // b comes back and only now notices its links are gone
    network.page('b', 'back')
    network.notice('b', 'a')
    network.notice('b', 'c')
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    assert.equal(network.joins('b'), 2)

    network.connect('a', 'b')
    network.connect('b', 'c')
    await network.settle()

    for (const selfId of ['a', 'b', 'c']) {
      assert.equal(hostOf(selfId), 'a', selfId)
      assert.deepEqual(movesOf(selfId), ['A'], selfId)
    }
    assert.equal(seatsOf('a')?.A, 'a')
    assert.equal(views.get('b')?.isHost, false)
  })

  it('hosts the game as it was after being away, when nobody else is left', async () => {
    const {network, sessions, views, membersOf, movesOf} = await startRoom()

    sessions.a.send(go)
    await network.settle()
    network.page('b', 'away')
    await network.settle()
    network.cut('a', 'b')
    network.cut('b', 'c')
    network.page('b', 'back')
    network.notice('b', 'a')
    network.notice('b', 'c')
    await sleep(takeoverDelayMs * 4)
    await network.settle()

    assert.equal(views.get('b')?.isHost, true)
    assert.deepEqual(membersOf('b'), ['b'])
    assert.deepEqual(movesOf('b'), ['A'])
    assert.equal(views.get('b')?.room?.origin, 'resumed')
  })

  it('sends its pending intent again after joining again', async () => {
    const {network, sessions, movesOf} = await startRoom()

    sessions.a.send(go)
    await network.settle()
    sessions.b.send(go)
    await network.settle()

    // c's link to a drops before its move gets there. b still sees a, so nobody takes over.
    network.cut('a', 'c')
    sessions.c.send(go)
    network.notice('c', 'a')
    await sleep(takeoverDelayMs * 6)
    await network.settle()

    network.connect('a', 'c')
    network.connect('b', 'c')
    await network.settle()

    assert.deepEqual(movesOf('a'), ['A', 'B', 'C'])
    assert.deepEqual(movesOf('c'), ['A', 'B', 'C'])
  })

  it('joins again instead of following its host to a host it has no link to', async () => {
    const {network, start, hostOf} = await startRoom()

    // Two hosts of term 1, b and c, as in the merge below. e reaches c only.
    network.cut('a', 'b')
    network.cut('a', 'c')
    network.cut('b', 'c')
    network.notice('b', 'a')
    network.notice('c', 'a')
    network.notice('c', 'b')
    await sleep(takeoverDelayMs * 3)
    await network.settle()
    start('e', false)
    network.connect('c', 'e')
    await network.settle()

    assert.equal(hostOf('e'), 'c')

    // c steps down for b, which e can't reach
    network.connect('b', 'c')
    await network.settle()

    assert.equal(network.joins('e'), 2)
    assert.equal(hostOf('e'), undefined)
  })

  it('merges two hosts of the same term, and the guests of the one that steps down follow', async () => {
    const {network, views, start, hostOf, membersOf} = await startRoom()

    // b and c each lose a and each other, so both take over: two hosts of term 1
    network.cut('a', 'b')
    network.cut('a', 'c')
    network.cut('b', 'c')
    network.notice('b', 'a')
    network.notice('c', 'a')
    network.notice('c', 'b')
    await sleep(takeoverDelayMs * 4)
    await network.settle()

    assert.equal(hostOf('b'), 'b')
    assert.equal(hostOf('c'), 'c')

    // A newcomer hears c first, and then b can't win it over on its own
    start('e', false)
    network.connect('c', 'e')
    await network.settle()
    network.connect('b', 'e')
    await network.settle()

    assert.equal(hostOf('e'), 'c')

    // b and c meet again. b keeps the room with a newer term, c steps down and hands e over.
    network.connect('b', 'c')
    await network.settle()

    for (const selfId of ['b', 'c', 'e']) {
      assert.equal(hostOf(selfId), 'b', selfId)
      assert.equal(views.get(selfId)?.room?.term, 2, selfId)
    }
    assert.deepEqual(membersOf('b')?.toSorted(), ['b', 'c', 'e'])
  })

  it('sends its pending intent again to the host its own host hands it to', async () => {
    const {network, start, hostOf, movesOf} = await startRoom()

    // Two hosts of term 1, b and c, as above, that dropped a by now. e hears c first, and has seat A in both rooms.
    network.cut('a', 'b')
    network.cut('a', 'c')
    network.cut('b', 'c')
    network.notice('b', 'a')
    network.notice('c', 'a')
    network.notice('c', 'b')
    await sleep(takeoverDelayMs * 4)
    await network.settle()
    const e = start('e', false)
    network.connect('c', 'e')
    network.connect('b', 'e')
    await network.settle()

    // b and c meet (a turn to exchange presences, one for their snapshots), and b wins the tie.
    // e's move reaches c just after c stepped down, so c ignores it, and b never saw it. c hands e
    // over to b, and e sends the move again.
    network.connect('b', 'c')
    await network.turn()
    await network.turn()
    e.send(go)
    await network.settle()

    assert.equal(hostOf('e'), 'b')
    assert.deepEqual(movesOf('b'), ['A'])
    assert.deepEqual(movesOf('e'), ['A'])
  })

  it('answers a rejected intent to its sender alone', async () => {
    const {network, sessions, handledOf} = await startRoom()

    // It is A's turn, so b's move is rejected
    sessions.b.send(go)
    await network.settle()

    assert.equal(handledOf('a', 'b'), 1)
    assert.equal(handledOf('b', 'b'), 1)
    assert.equal(handledOf('c', 'b'), undefined)
  })

  it('stays out of the room after leave(), whatever it hears while it is still leaving', async () => {
    const {network, sessions, views} = await startRoom()
    const before = views.get('c')

    // c leaves. Before it is out, its link to the host drops: it must neither wait for the next
    // member in line, nor join the room again when that member never shows up.
    const left = sessions.c.leave()
    network.notice('c', 'a')
    await sleep(takeoverDelayMs * 6)
    await network.settle()

    assert.equal(network.joins('c'), 1)
    assert.equal(views.get('c'), before)
    assert.equal(sessions.c.leave(), left)
  })

  it('hands the room over at once when the host says goodbye', async () => {
    // A pause far longer than the test: only a goodbye can skip it
    const {network, sessions, hostOf} = await startRoom({takeoverDelayMs: 60_000})

    await sessions.a.leave()
    await network.settle()

    assert.equal(hostOf('b'), 'b')
    assert.equal(hostOf('c'), 'b')
  })

  it('joins again when the next member never takes over, and keeps its seat', async () => {
    const {network, views, hostOf, seatsOf} = await startRoom()

    // Only c loses a. b still sees a, so it never takes over.
    network.cut('a', 'c')
    network.notice('c', 'a')
    await network.settle()

    assert.equal(views.get('c')?.switchingHost, true)

    await sleep(takeoverDelayMs * 6)
    await network.settle()

    assert.equal(network.joins('c'), 2)
    assert.equal(views.get('c')?.room, null)

    network.connect('a', 'c')
    network.connect('b', 'c')
    await network.settle()

    assert.equal(hostOf('c'), 'a')
    assert.equal(views.get('c')?.switchingHost, false)
    assert.equal(seatsOf('a')?.C, 'c')
  })

  it('tells the page about a peer it could not connect to, until it connects', async () => {
    const {network, views, start} = await startRoom()

    start('d', false)
    network.fail('d', 'a')
    await network.settle()

    assert.equal(views.get('d')?.unreachable, true)
    assert.equal(views.get('d')?.room, null)

    network.connect('a', 'd')
    await network.settle()

    assert.equal(views.get('d')?.unreachable, false)
    assert.equal(views.get('d')?.room?.members[0]?.playerId, 'a')
  })

  it('ignores a failure to connect to a peer it is connected to', async () => {
    const {network, views} = await startRoom()

    network.fail('b', 'a')
    await network.settle()

    assert.equal(views.get('b')?.unreachable, false)
  })

  it('hosts the room again when no snapshot comes in time, even with other guests around', async () => {
    const {network, views, start, hostOf} = await startRoom()

    // Two guests find each other and nobody else: a reloaded host and a member that lost it
    start('d', false, {rejoinAsHost: true})
    start('e', false)
    network.connect('d', 'e')
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    assert.equal(views.get('d')?.isHost, true)
    assert.equal(views.get('d')?.room?.origin, 'fresh')
    assert.equal(hostOf('e'), 'd')
  })

  it('resumes the game rather than starting over, when a reloaded host meets a member that hosts again', async () => {
    const {network, sessions, views, start, hostOf, movesOf} = await startRoom()

    sessions.a.send(go)
    await network.settle()
    // b's phone hides and freezes, and a reloads meanwhile. b comes back and finds only a2, which
    // knows nothing of the game.
    network.page('b', 'away')
    await network.settle()
    network.cut('a', 'b')
    network.cut('b', 'c')
    network.page('b', 'back')
    network.notice('b', 'a')
    network.notice('b', 'c')
    await network.settle()
    start('a2', false, {playerId: 'a', rejoinAsHost: true})
    network.connect('a2', 'b')
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    for (const selfId of ['a2', 'b']) {
      assert.equal(hostOf(selfId), 'b', selfId)
      assert.deepEqual(movesOf(selfId), ['A'], selfId)
    }
    assert.equal(views.get('b')?.room?.origin, 'resumed')
    assert.equal(views.get('a2')?.isHost, false)
  })

  it('moves a player back to its other tab when the controlling one goes, instead of dropping it', async () => {
    const {network, sessions, views, start, movesOf, membersOf, seatsOf} = await startRoom()

    start('c2', false, {playerId: 'c'})
    network.connect('a', 'c2')
    network.connect('b', 'c2')
    network.connect('c', 'c2')
    await network.settle()

    assert.equal(views.get('c')?.inControl, false)

    network.cut('a', 'c2')
    network.cut('b', 'c2')
    network.cut('c', 'c2')
    network.notice('a', 'c2')
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    assert.deepEqual(membersOf('a'), ['a', 'b', 'c'])
    assert.equal(seatsOf('a')?.C, 'c')
    assert.equal(views.get('c')?.inControl, true)

    sessions.a.send(go)
    await network.settle()
    sessions.b.send(go)
    await network.settle()
    sessions.c.send(go)
    await network.settle()

    assert.deepEqual(movesOf('c'), ['A', 'B', 'C'])
  })

  it('holds a member the old host marked away, even if its word never reached the new host', async () => {
    const {network, membersOf} = await startRoom({awayHoldMs: takeoverDelayMs * 100})

    // c says it is away while its link to b is down, so only a hears it and marks it in the room
    network.cut('b', 'c')
    network.page('c', 'away')
    await network.settle()
    network.cut('a', 'b')
    network.cut('a', 'c')
    network.notice('b', 'a')
    network.notice('b', 'c')
    await sleep(takeoverDelayMs * 5)
    await network.settle()

    // a, which just dropped, is gone by now; c is held for awayHoldMs
    assert.deepEqual(membersOf('b'), ['b', 'c'])
  })

  it('tells everyone when the host itself steps away', async () => {
    const {network, views} = await startRoom()

    network.page('a', 'away')
    await network.settle()

    assert.deepEqual(views.get('b')?.room?.absent, {a: 'away'})

    network.page('a', 'back')
    await network.settle()

    assert.deepEqual(views.get('b')?.room?.absent, {})
  })

  it('keeps showing what it showed when the page goes', async () => {
    const {network, views} = await startRoom()
    const before = views.get('a')

    // A title remembers that it hosts from the view, so a reloaded tab hosts again
    network.page('a', 'leaving')
    network.page('a', 'gone')
    await network.settle()

    assert.equal(views.get('a'), before)
    assert.equal(views.get('a')?.isHost, true)
  })

  it('leaves the room when the page goes, so the others hear at once', async () => {
    const {network, views, membersOf} = await startRoom()

    network.page('c', 'gone')
    await network.settle()

    assert.deepEqual(views.get('a')?.room?.absent, {c: 'offline'})
    assert.deepEqual(membersOf('a'), ['a', 'b', 'c'])
  })

  it('hosts the room again after a reload when nobody is in it', async () => {
    const {network, views, start, membersOf} = await startRoom()

    start('z', false, {rejoinAsHost: true})
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    assert.equal(views.get('z')?.isHost, true)
    assert.deepEqual(membersOf('z'), ['z'])
    assert.equal(views.get('z')?.room?.origin, 'fresh')
  })

  it('follows the room under its new host after taking it back too early', async () => {
    const {network, sessions, views, start, hostOf, membersOf} = await startRoom()

    // a leaves, which hands the room to b, and comes back as a2 that meets nobody in time
    await sessions.a.leave()
    await network.settle()
    start('a2', false, {playerId: 'a', rejoinAsHost: true})
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    assert.equal(views.get('a2')?.isHost, true)

    network.connect('a2', 'b')
    network.connect('a2', 'c')
    await network.settle()

    for (const selfId of ['a2', 'b', 'c']) {
      assert.equal(hostOf(selfId), 'b', selfId)
    }
    assert.deepEqual(membersOf('b'), ['b', 'c', 'a'])
  })

  it('takes over when it becomes next in line while it waits for the member ahead of it', async () => {
    const {network, views, hostOf} = await startRoom()

    // a and b both go. c hears of a first, and of b only as its wait for b nearly runs out.
    network.cut('a', 'b')
    network.cut('a', 'c')
    network.cut('b', 'c')
    network.notice('c', 'a')
    await sleep(takeoverDelayMs * 3.5)
    network.notice('c', 'b')
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    // The wait for b ended with it: c hosts what is left instead of joining an empty room again
    assert.equal(network.joins('c'), 1)
    assert.equal(views.get('c')?.isHost, true)
    assert.equal(hostOf('c'), 'c')
  })

  it('joins again after a cancelled unload, even if a snapshot came in meanwhile', async () => {
    const {network, sessions} = await startRoom()

    network.page('c', 'leaving')
    sessions.a.send(go)
    await network.settle()
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    assert.equal(network.joins('c'), 2)
  })

  it('joins again when the link to its host comes back but the host no longer answers', async () => {
    const {network, views, hostOf} = await startRoom()

    // c loses a and b without noticing. a's page goes into the cache, and only b hears it go and
    // takes over.
    network.cut('a', 'c')
    network.cut('b', 'c')
    network.page('a', 'gone')
    await network.settle()
    await sleep(takeoverDelayMs * 2)
    await network.settle()

    assert.equal(hostOf('b'), 'b')

    // a comes back as b's guest. c sees a link to a come up, as if a were still its host.
    network.page('a', 'shown')
    await network.settle()
    network.connect('a', 'b')
    network.connect('a', 'c')
    await network.settle()

    assert.equal(hostOf('a'), 'b')
    assert.equal(hostOf('c'), 'a')

    // a never answers as a host, so c joins again and finds b
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    assert.equal(network.joins('c'), 2)

    network.connect('b', 'c')
    network.connect('a', 'c')
    await network.settle()

    assert.equal(hostOf('c'), 'b')
    assert.equal(views.get('c')?.isHost, false)
  })

  it('hosts the game again when the host went while every guest was away from the room', async () => {
    const {network, sessions, views, hostOf, movesOf} = await startRoom()

    sessions.a.send(go)
    await network.settle()
    // b and c go into the cache, and a leaves meanwhile. When b and c are back, nobody hosts.
    network.page('b', 'gone')
    network.page('c', 'gone')
    await network.settle()
    await sessions.a.leave()
    network.page('b', 'shown')
    network.page('c', 'shown')
    await network.settle()
    network.connect('b', 'c')
    await network.settle()
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    // Still waiting: a host would have answered by now, but give it time
    assert.equal(hostOf('b'), undefined)

    await sleep(takeoverDelayMs * 3)
    await network.settle()

    // One of them hosts the game as they left it, as a fresh room, and the other follows
    const host = hostOf('b')

    assert.ok(host === 'b' || host === 'c')
    assert.equal(hostOf('c'), host)
    assert.equal(views.get(host)?.isHost, true)
    assert.equal(views.get(host)?.room?.origin, 'fresh')
    assert.deepEqual(movesOf('b'), ['A'])
  })

  it('waits for a host after joining again if a peer it found could not be connected to', async () => {
    const {network, sessions, views} = await startRoom()

    network.page('c', 'gone')
    await network.settle()
    network.page('c', 'shown')
    await network.settle()
    network.fail('c', 'a')
    await sleep(takeoverDelayMs * 8)
    await network.settle()

    assert.equal(views.get('c')?.room, null)
    assert.equal(views.get('c')?.unreachable, true)

    // It would look again every few pauses for good
    await sessions.c.leave()
  })

  it('stays a guest after a reload when it meets the room in time', async () => {
    const {network, views, start, hostOf} = await startRoom()

    start('z', false, {rejoinAsHost: true})
    network.connect('a', 'z')
    await network.settle()
    await sleep(takeoverDelayMs * 3)
    await network.settle()

    assert.equal(hostOf('z'), 'a')
    assert.equal(views.get('z')?.isHost, false)
  })
})
