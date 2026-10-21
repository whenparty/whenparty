import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {decodeSnapshot, encode} from '../protocol.ts'
import {applyIntent, createRoomState, isAbsent, joinPlayer, type GameRules} from '../room-state.ts'
import {initialModel, invariantViolations, step, timersOf, viewOf, type Effect, type Event, type Model} from '../session-machine.ts'
import {tab} from './members.ts'
import {race, type Race} from './race.ts'

const config = {self: tab('a'), rules: race, seatHoldMs: 1000, restoreGraceMs: 100}
const guest = (self = 'b', rejoinAsHost = false) => initialModel({...config, self: tab(self)}, {isHost: false, rejoinAsHost}, 0)
const host = () => initialModel(config, {isHost: true, rejoinAsHost: false}, 0)
const room = joinPlayer(joinPlayer(createRoomState(race, tab('a')), tab('b')), tab('c'))
const snapshot = (data = room, sender = 'a'): Event<number> => ({type: 'snapshot', data: encode(data), sender})
const presence = (peerId: string, playerId = peerId, away = false): Event<number> => ({
  type: 'presence',
  sender: peerId,
  data: encode({playerId, away})
})
const run = <State, Move>(model: Model<State, Move>, events: [number, Event<Move>][], peers = ['a', 'b', 'c']) =>
  events.reduce(
    ({model, effects}, [now, event]) => {
      const result = step(model, event, {now, peers: new Set(peers)})
      assert.deepEqual(invariantViolations(result.model), [])
      return {model: result.model, effects: [...effects, ...result.effects]}
    },
    {model, effects: [] as Effect[]}
  )
const hosting = () =>
  run(host(), [
    [0, presence('b')],
    [0, presence('c')]
  ]).model
const following = () => run(guest(), [[0, snapshot()]]).model
const roomOf = <State, Move>(model: Model<State, Move>) => {
  const current = viewOf(model).room
  assert.ok(current)
  return current
}

describe('fixed room creator', () => {
  it('waits for the creator until the exact deadline without promoting a guest', () => {
    const lost = run(following(), [[100, {type: 'peerLeft', peerId: 'a'}]]).model
    const early = run(lost, [[1099, {type: 'deadline', key: 'host'}]]).model
    assert.equal(viewOf(early).isHost, false)
    assert.equal(viewOf(early).waitingForHost, true)
    assert.equal(timersOf(early).get('host'), 1100)
    const ended = run(early, [[1100, snapshot()]]).model
    assert.equal(viewOf(ended).hostLeft, true)
    assert.equal(viewOf(ended).isHost, false)
    assert.equal(roomOf(ended).hostId, 'a')
    assert.deepEqual([...timersOf(ended)], [])
    assert.deepEqual(
      run(ended, [
        [1101, snapshot()],
        [1102, {type: 'page', event: 'back'}]
      ]).model,
      ended
    )
  })

  it('requires a snapshot to confirm the creator returned and cancels the old deadline', () => {
    const returned = run(following(), [
      [100, {type: 'peerLeft', peerId: 'a'}],
      [1090, {type: 'peerJoined', peerId: 'a'}],
      [1090, presence('a')]
    ]).model
    assert.equal(timersOf(returned).get('host'), 1100)
    const back = run(returned, [
      [1099, snapshot()],
      [1100, {type: 'deadline', key: 'host'}]
    ]).model
    assert.equal(viewOf(back).hostLeft, false)
    assert.equal(viewOf(back).waitingForHost, false)
  })

  it('closes immediately when the creator explicitly leaves', () => {
    const ended = run(following(), [[1, {type: 'bye', sender: 'a'}]]).model
    assert.equal(viewOf(ended).hostLeft, true)
    assert.equal(viewOf(ended).isHost, false)
  })

  it('rejects another player claiming to host and an older creator connection', () => {
    const impostor = {...room, hostId: 'c', term: 99}
    assert.deepEqual(run(following(), [[1, snapshot(impostor, 'c')]]).model, following())
    const reloaded = joinPlayer(room, tab('a2', 'a'))
    const current = run(following(), [
      [1, snapshot(reloaded, 'a2')],
      [2, snapshot()]
    ]).model
    assert.equal(roomOf(current).hostId, 'a')
    assert.equal(roomOf(current).members[0]?.peerId, 'a2')
  })

  it('restores only the creator from retained state without inventing a fresh game', () => {
    const played = applyIntent(race, room, 'a', {type: 'move', move: 2, id: 1})
    const retained = run(guest(), [
      [0, snapshot(played)],
      [10, presence('a2', 'a')]
    ]).model
    const offers = run(retained, [[11, {type: 'peerLeft', peerId: 'a'}]], ['a2', 'c']).effects
    const offer = offers.find(effect => effect.type === 'send' && effect.action === 'snapshot' && effect.target === 'a2')
    assert.ok(offer?.type === 'send')
    const creator = initialModel({...config, self: tab('a2', 'a')}, {isHost: false, rejoinAsHost: true}, 0)
    const back = run(creator, [[20, {type: 'snapshot', data: offer.data, sender: 'b'}]]).model
    assert.equal(viewOf(back).isHost, true)
    assert.deepEqual(roomOf(back).game, played.game)
    assert.equal(roomOf(back).term, 1)
    const unanswered = run(creator, [[1000, {type: 'deadline', key: 'host'}]]).model
    assert.equal(viewOf(unanswered).hostLeft, true)
    assert.equal(viewOf(unanswered).room, null)
  })

  it('hosts a fresh room when a reloaded creator is linked to nobody, and waits on while linked', () => {
    const creator = initialModel({...config, self: tab('a2', 'a')}, {isHost: false, rejoinAsHost: true}, 0)
    assert.equal(timersOf(creator).get('host'), 100)
    const alone = run(creator, [[100, {type: 'deadline', key: 'host'}]], []).model
    assert.equal(viewOf(alone).isHost, true)
    assert.equal(roomOf(alone).hostId, 'a')
    assert.deepEqual(roomOf(alone).game, race.createState())

    const linked = run(creator, [[100, {type: 'deadline', key: 'host'}]], ['b']).model
    assert.equal(viewOf(linked).isHost, false)
    assert.equal(viewOf(linked).waitingForHost, true)
    assert.equal(timersOf(linked).get('host'), 1000)
    assert.equal(viewOf(run(linked, [[500, {type: 'deadline', key: 'host'}]], []).model).isHost, false)
  })

  it('takes a newer snapshot that names this tab as host, whoever relays it', () => {
    const stepped = run(hosting(), [[10, snapshot(joinPlayer(room, tab('a2', 'a')), 'a2')]], ['a2', 'b', 'c']).model
    assert.equal(viewOf(stepped).isHost, false)
    const back = joinPlayer(joinPlayer(room, tab('a2', 'a')), tab('a'))
    assert.equal(back.term, 2)
    const taken = run(stepped, [[20, snapshot(back, 'a3')]], ['a2', 'a3', 'b', 'c']).model
    assert.equal(viewOf(taken).isHost, true)
    assert.equal(roomOf(taken).term, 2)
    const stale = run(stepped, [[20, snapshot({...back, term: 1}, 'a3')]], ['a2', 'a3', 'b', 'c']).model
    assert.equal(viewOf(stale).isHost, false)
  })

  it("hands the room to the creator's second tab through its snapshot, and the old tab follows", () => {
    const {model: oldTab, effects} = run(hosting(), [[10, presence('a2', 'a')]], ['b', 'c', 'a2'])
    assert.equal(viewOf(oldTab).isHost, true)
    const offer = effects.find(effect => effect.type === 'send' && effect.action === 'snapshot')
    assert.ok(offer?.type === 'send')

    const newTab = initialModel({...config, self: tab('a2', 'a')}, {isHost: false, rejoinAsHost: false}, 10)
    const {model: taken, effects: taking} = run(newTab, [[11, {type: 'snapshot', data: offer.data, sender: 'a'}]], ['a', 'b', 'c'])
    assert.equal(viewOf(taken).isHost, true)
    assert.equal(roomOf(taken).term, 1)
    assert.deepEqual(roomOf(taken).reservations, {})
    const handover = taking.find(effect => effect.type === 'send' && effect.action === 'snapshot')
    assert.ok(handover?.type === 'send')
    const followed = run(oldTab, [[12, {type: 'snapshot', data: handover.data, sender: 'a2'}]], ['b', 'c', 'a2']).model
    assert.equal(viewOf(followed).isHost, false)
    assert.equal(viewOf(followed).inControl, false)
    assert.equal(roomOf(run(taken, [[12, {type: 'intent', sender: 'b', data: encode({type: 'move', move: 1, id: 1})}]]).model).handled.b, 1)
  })

  it("hosts again from the creator's older tab when the controlling tab is lost, once it is visible", () => {
    const older = run(hosting(), [[10, snapshot(joinPlayer(room, tab('a2', 'a')), 'a2')]], ['a2', 'b', 'c']).model
    assert.equal(viewOf(older).isHost, false)
    const {model: reclaimed, effects} = run(older, [[20, {type: 'peerLeft', peerId: 'a2'}]], ['b', 'c'])
    assert.equal(viewOf(reclaimed).isHost, true)
    assert.equal(roomOf(reclaimed).term, 2)
    assert.deepEqual(roomOf(reclaimed).reservations, {})
    assert.ok(effects.some(effect => effect.type === 'send' && effect.action === 'snapshot' && !effect.target))

    const hidden = run(
      older,
      [
        [15, {type: 'page', event: 'away'}],
        [20, {type: 'peerLeft', peerId: 'a2'}]
      ],
      ['b', 'c']
    ).model
    assert.equal(viewOf(hidden).isHost, false)
    assert.equal(viewOf(hidden).waitingForHost, true)
    assert.equal(viewOf(run(hidden, [[30, {type: 'page', event: 'back'}]], ['b', 'c']).model).isHost, true)
  })

  it('keeps a hidden second tab of the creator from taking over until it is shown', () => {
    const hiddenTab = run(
      initialModel({...config, self: tab('a2', 'a')}, {isHost: false, rejoinAsHost: false}, 0),
      [[1, {type: 'page', event: 'away'}]],
      ['a', 'b']
    ).model
    assert.equal(run(hiddenTab, [[2, snapshot()]], ['a', 'b']).model.phase.name, 'waiting')
    const shown = run(
      hiddenTab,
      [
        [3, {type: 'page', event: 'back'}],
        [4, snapshot()]
      ],
      ['a', 'b']
    ).model
    assert.equal(viewOf(shown).isHost, true)
  })

  it('settles two tabs of the creator hosting the same term in favour of the lower connection ID', () => {
    const restored = run(
      initialModel({...config, self: tab('a2', 'a')}, {isHost: false, rejoinAsHost: true}, 0),
      [[1, snapshot(room, 'b')]],
      ['a1', 'a3', 'b']
    ).model
    assert.equal(viewOf(restored).isHost, true)
    assert.equal(roomOf(restored).term, 1)
    const lower = run(restored, [[2, snapshot(joinPlayer(room, tab('a1', 'a')), 'a1')]], ['a1', 'a3', 'b']).model
    assert.equal(viewOf(lower).isHost, false)
    assert.equal(roomOf(lower).members.find(member => member.playerId === 'a')?.peerId, 'a1')
    const {model: higher, effects} = run(restored, [[2, snapshot(joinPlayer(room, tab('a3', 'a')), 'a3')]], ['a1', 'a3', 'b'])
    assert.equal(viewOf(higher).isHost, true)
    assert.equal(roomOf(higher).term, 2)
    assert.ok(effects.some(effect => effect.type === 'send' && effect.action === 'snapshot' && !effect.target))
  })
})

describe('one absence rule', () => {
  for (const event of [{type: 'peerLeft', peerId: 'b'}, presence('b', 'b', true)] as Event<number>[]) {
    it(`keeps the same seat until expiry after ${event.type}`, () => {
      const lost = run(hosting(), [
        [100, event],
        [200, event],
        [1090, {type: 'peerJoined', peerId: 'b'}]
      ]).model
      assert.equal(timersOf(lost).get('hold:b'), 1100)
      assert.equal(isAbsent(roomOf(lost), 'b'), true)
      assert.equal(roomOf(lost).seats.B, 'b')
      const ended = run(lost, [[1100, {type: 'deadline', key: 'hold:b'}]]).model
      assert.equal(roomOf(ended).seats.B, 'c')
      assert.equal(
        roomOf(ended).members.some(member => member.playerId === 'b'),
        false
      )
    })
  }

  it('restores before expiry and gives every later absence a new full wait', () => {
    const back = run(hosting(), [
      [100, presence('b', 'b', true)],
      [1099, presence('b2', 'b')]
    ]).model
    assert.equal(roomOf(back).seats.B, 'b')
    assert.deepEqual(roomOf(back).reservations, {})
    const lostAgain = run(back, [[1500, {type: 'peerLeft', peerId: 'b2'}]]).model
    assert.equal(timersOf(lostAgain).get('hold:b'), 2500)
  })

  it('expires before a late return and does not act on a superseded connection', () => {
    const lost = run(hosting(), [[100, {type: 'peerLeft', peerId: 'b'}]]).model
    const late = run(lost, [[1100, presence('b2', 'b')]]).model
    assert.equal(roomOf(late).seats.B, 'c')
    const back = run(hosting(), [
      [100, presence('b2', 'b')],
      [101, {type: 'peerLeft', peerId: 'b'}]
    ]).model
    assert.deepEqual(roomOf(back).reservations, {})
    assert.equal(roomOf(back).members.find(member => member.playerId === 'b')?.peerId, 'b2')
  })

  it('ends the room if its creator stays hidden, and resumes on an earlier return', () => {
    const hidden = run(hosting(), [[100, {type: 'page', event: 'away'}]]).model
    assert.equal(timersOf(hidden).get('hold:a'), 1100)
    const ended = run(hidden, [[1100, {type: 'page', event: 'back'}]]).model
    assert.equal(viewOf(ended).hostLeft, true)
    const returned = run(hidden, [[1099, {type: 'page', event: 'back'}]]).model
    assert.deepEqual(roomOf(returned).reservations, {})
    assert.equal(viewOf(returned).isHost, true)
  })

  it('retains deadlines across page restoration and ignores the detached connection', () => {
    const lost = run(hosting(), [
      [100, {type: 'peerLeft', peerId: 'b'}],
      [200, {type: 'page', event: 'gone'}]
    ]).model
    assert.deepEqual([...timersOf(lost)], [])
    assert.deepEqual(run(lost, [[300, presence('b')]]).model, lost)
    const returned = run(lost, [[400, {type: 'page', event: 'shown'}]]).model
    assert.equal(timersOf(returned).get('hold:b'), 1100)
    assert.equal(viewOf(returned).isHost, true)
  })

  it('moves a player to its other linked tab when the controlling one drops, instead of reserving', () => {
    const switched = run(hosting(), [[10, presence('b2', 'b')]], ['b', 'b2', 'c']).model
    assert.equal(roomOf(switched).members.find(member => member.playerId === 'b')?.peerId, 'b2')
    const moved = run(switched, [[20, {type: 'peerLeft', peerId: 'b2'}]], ['b', 'c']).model
    assert.equal(roomOf(moved).members.find(member => member.playerId === 'b')?.peerId, 'b')
    assert.deepEqual(roomOf(moved).reservations, {})
    assert.deepEqual([...timersOf(moved)], [])
    const played = run(moved, [[30, {type: 'intent', sender: 'b', data: encode({type: 'move', move: 1, id: 1})}]], ['b', 'c']).model
    assert.equal(roomOf(played).handled.b, 1)
    const unlinked = run(switched, [[20, {type: 'peerLeft', peerId: 'b2'}]], ['c']).model
    assert.equal(timersOf(unlinked).get('hold:b'), 1020)
  })

  it('lets a hidden tab announce itself without taking control of its player', () => {
    const creatorHidden = run(hosting(), [[10, presence('a2', 'a', true)]], ['a2', 'b', 'c']).model
    assert.equal(viewOf(creatorHidden).isHost, true)
    assert.deepEqual(roomOf(creatorHidden).reservations, {})
    assert.equal(roomOf(creatorHidden).term, 0)
    const guestHidden = run(hosting(), [[10, presence('b2', 'b', true)]], ['b', 'b2', 'c']).model
    assert.equal(roomOf(guestHidden).members.find(member => member.playerId === 'b')?.peerId, 'b')
    assert.deepEqual(roomOf(guestHidden).reservations, {})
    const shown = run(guestHidden, [[20, presence('b2', 'b')]], ['b', 'b2', 'c']).model
    assert.equal(roomOf(shown).members.find(member => member.playerId === 'b')?.peerId, 'b2')
  })

  it('removes an explicitly leaving player even when its old tab remains', () => {
    const left = run(hosting(), [
      [100, presence('b2', 'b')],
      [200, {type: 'bye', sender: 'b2'}]
    ]).model
    assert.equal(roomOf(left).seats.B, 'c')
    assert.equal(
      roomOf(left).members.some(member => member.playerId === 'b'),
      false
    )
  })
})

describe('restoring a paused game', () => {
  interface Pausing {
    paused: string[]
  }
  const pausing: GameRules<Pausing, number> = {
    seats: ['A', 'B'],
    createState: () => ({paused: []}),
    applyMove: state => state,
    isOver: () => false,
    isMove: (value): value is number => value === 1,
    isState: (value): value is Pausing => typeof value === 'object' && value !== null && Array.isArray((value as Pausing).paused),
    onPresence: (state, seat, presence) => ({
      paused: presence === 'lost' ? [...state.paused, seat] : state.paused.filter(each => each !== seat)
    })
  }
  const pausingConfig = {...config, rules: pausing}

  it('tells the game its creator is back when the creator restores from a guest that saw it go', () => {
    const hostRoom = createRoomState(pausing, tab('a'))
    const guest = run(
      initialModel({...pausingConfig, self: tab('b')}, {isHost: false, rejoinAsHost: false}, 0),
      [
        [0, {type: 'snapshot', data: encode(joinPlayer(hostRoom, tab('b'))), sender: 'a'}],
        [10, {type: 'peerLeft', peerId: 'a'}]
      ],
      ['b']
    ).model
    const offered = viewOf(guest).room
    assert.ok(offered)
    assert.deepEqual(offered.game.paused, ['A'])

    const creator = initialModel({...pausingConfig, self: tab('a2', 'a')}, {isHost: false, rejoinAsHost: true}, 20)
    const {model: restored, effects} = run(creator, [[20, {type: 'snapshot', data: encode(offered), sender: 'b'}]], ['b'])
    assert.equal(viewOf(restored).isHost, true)
    assert.deepEqual(roomOf(restored).reservations, {})
    assert.deepEqual(roomOf(restored).game.paused, [])
    const broadcast = effects.find(effect => effect.type === 'send' && effect.action === 'snapshot')
    assert.ok(broadcast?.type === 'send')
    assert.deepEqual(decodeSnapshot(pausing, broadcast.data)?.game.paused, [])
  })
})

describe('game deadlines', () => {
  const timed: GameRules<Race, number> = {
    ...race,
    deadlinesOf: (state): Record<string, number> => (state.winner === null ? {turn: 500} : {}),
    onDeadline: state => ({...state, winner: state.turn === 'A' ? 'B' : 'A'})
  }

  it('keeps a timer for each deadline of the game and broadcasts what firing it did', () => {
    const model = run(initialModel({...config, rules: timed}, {isHost: true, rejoinAsHost: false}, 0), [[0, presence('b')]], ['b']).model
    assert.equal(timersOf(model).get('game:turn'), 500)
    assert.equal(roomOf(run(model, [[499, {type: 'deadline', key: 'game:turn'}]], ['b']).model).game.winner, null)
    const {model: fired, effects} = run(model, [[500, {type: 'deadline', key: 'game:turn'}]], ['b'])
    assert.equal(roomOf(fired).game.winner, 'B')
    assert.equal(timersOf(fired).has('game:turn'), false)
    assert.ok(effects.some(effect => effect.type === 'send' && effect.action === 'snapshot' && !effect.target))
  })
})

describe('delivery', () => {
  it('ignores intents from a connection that no longer controls its player', () => {
    const switched = run(
      hosting(),
      [
        [5, {type: 'send', intent: {type: 'move', move: 2}}],
        [10, presence('b2', 'b')]
      ],
      ['b', 'b2', 'c']
    ).model
    const stale = run(switched, [[20, {type: 'intent', sender: 'b', data: encode({type: 'move', move: 1, id: 1})}]], ['b', 'b2', 'c'])
    assert.deepEqual(stale.model, switched)
    assert.deepEqual(stale.effects, [])
    const current = run(
      switched,
      [[20, {type: 'intent', sender: 'b2', data: encode({type: 'move', move: 1, id: 1})}]],
      ['b', 'b2', 'c']
    ).model
    assert.equal(roomOf(current).game.total, 3)
  })

  it('acknowledges a rejected move without broadcasting it to everybody', () => {
    const before = hosting()
    const {model, effects} = run(before, [[1, {type: 'intent', sender: 'b', data: encode({type: 'move', move: 1, id: 1})}]])
    assert.deepEqual(roomOf(model).game, roomOf(before).game)
    const sent = effects.filter(effect => effect.type === 'send')
    assert.equal(sent.length, 1)
    assert.equal(sent[0]?.target, 'b')
    assert.equal(decodeSnapshot(race, sent[0]?.data)?.handled.b, 1)
  })

  it('retries an unacknowledged intent on return until a snapshot acknowledges it', () => {
    const intent = {type: 'move', move: 1, id: 1} as const
    const played = applyIntent(race, room, 'a', {type: 'move', move: 2, id: 1})
    const pending = run(guest(), [
      [0, snapshot(played)],
      [1, {type: 'send', intent}],
      [2, {type: 'peerLeft', peerId: 'a'}]
    ]).model
    const retried = run(pending, [[3, snapshot(played)]])
    assert.ok(retried.effects.some(effect => effect.type === 'send' && effect.action === 'intent'))
    const handled = applyIntent(race, played, 'b', intent)
    const acknowledged = run(retried.model, [
      [4, snapshot(handled)],
      [5, snapshot(handled)]
    ])
    assert.equal(
      acknowledged.effects.some(effect => effect.type === 'send' && effect.action === 'intent'),
      false
    )
  })

  it('rejects durations that cannot cross the wire without opening a broken session', () => {
    for (const bad of [-1, 2500.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => initialModel({...config, seatHoldMs: bad}, {isHost: true, rejoinAsHost: false}, 0), RangeError)
      assert.throws(() => initialModel({...config, restoreGraceMs: bad}, {isHost: true, rejoinAsHost: false}, 0), RangeError)
    }
  })
})
