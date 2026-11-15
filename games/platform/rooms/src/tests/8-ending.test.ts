import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {Room} from '../api.ts'
import {testCells, type Check} from './cells.ts'
import type {FakePeer, FakeSignaling} from './fake-transport.ts'
import {app, code, ownerPeer, ownerWithParticipant, pageHarness, settle, type PageHarness} from './page-harness.ts'
import {table} from './8-ending.states.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = {readonly next: State; readonly reason?: string; readonly effects: readonly string[]}

interface World {
  readonly h: PageHarness
  readonly room: Room
  readonly peer: FakePeer | null
  readonly old: FakeSignaling | null
  from: number
}

const reopen = async (h: PageHarness, peer: FakePeer | null): Promise<void> => {
  h.latest().drop()
  peer?.drop()
  await settle()
}

const setup = async (state: State, event: Event): Promise<World> => {
  const h = pageHarness()
  const outdated = event === 'outdatedRefusal'
  const make = async (): Promise<{readonly room: Room; readonly peer: FakePeer | null}> => {
    switch (state) {
      case 'creating': {
        const room = await h.create()
        if (!outdated) {
          h.latest().open()
        }
        return {room, peer: null}
      }
      case 'joiningWithoutToken':
        return outdated ? {room: await h.join(), peer: null} : {room: await h.asked(), peer: null}
      case 'participantEntering': {
        const entered = await h.letIn()
        entered.peer.open()
        if (outdated) {
          await reopen(h, entered.peer)
        }
        return entered
      }
      case 'participantInRoom':
      case 'done': {
        const entered = await h.inRoom()
        if (outdated) {
          await reopen(h, entered.peer)
        }
        if (state === 'done') {
          entered.room.leave()
        }
        return entered
      }
      case 'ownerWithToken': {
        const {room, peer} = await ownerWithParticipant(h)
        if (outdated) {
          h.latest().drop()
        }
        return {room, peer}
      }
    }
  }
  const {room, peer} = await make()
  return {h, room, peer, old: h.transport.connections[0] ?? null, from: h.mark()}
}

const fire: {readonly [E in Event]: (w: World, state: State) => void | Promise<void>} = {
  appLeaves: w => w.room.leave(),
  failsWithReason: (w, state) => {
    if (state === 'creating') {
      w.h.latest().answer('answer', {a: 'busy'}, 'create')
    } else if (state === 'joiningWithoutToken') {
      w.h.latest().answer('answer', {a: 'no room'}, 'join')
    } else if (state === 'participantEntering') {
      w.h.clock.advance(45_000)
    } else {
      w.old?.receive({t: 'answer', r: 1, a: 'busy'})
    }
  },
  roomEnds: (w, state) => {
    if (state === 'ownerWithToken') {
      w.h.latest().receive({t: 'closed', app, code})
    } else {
      w.peer?.handlers.text?.('e{"reason":"room closed"}')
    }
  },
  outdatedRefusal: w => w.h.latest().outdated('server'),
  ownerSendsOutdated: w => w.peer?.receive('e{"reason":"outdated","older":"page"}'),
  lateAnswerOrEvent: w => {
    w.old?.receive({t: 'owner', r: 2, peer: ownerPeer})
    w.peer?.handlers.closed?.({reason: 'broken', lastArrivalAt: w.h.clock.now()})
  }
}

const reasonOf = (w: World): unknown => [...w.h.told('failed'), ...w.h.told('ended')].at(-1)?.[0]

const effect: {readonly [name: string]: (w: World) => void} = {
  withdrawsJoinRequestIfSignalingOpen: w => assert.ok(w.h.latest().last('withdraw')),
  tellsServerLeaveIfSignalingOpen: w => assert.ok(w.h.transport.connections.some(connection => connection.last('leave')?.token)),
  tellsOwnerLeaveIfPeerConnectionOpen: w => assert.equal(w.peer?.sent.at(-1), 'l'),
  sendsRoomClosedToParticipants: w => assert.equal(w.peer?.sent.at(-1), 'e{"reason":"room closed"}'),
  sendsOutdatedWithSideToParticipants: w => assert.equal(w.peer?.sent.at(-1), 'e{"reason":"outdated","older":"server"}'),
  appToldReasonOnce: w => assert.equal(w.h.namesSince(w.from).filter(name => name === 'failed' || name === 'ended').length, 1),
  appToldOlderSide: w => assert.ok(['server', 'owner'].includes(String((reasonOf(w) as {readonly older?: string}).older))),
  deletesRecord: w => assert.equal(w.h.record(), null),
  closesConnections: w => {
    assert.ok(w.h.transport.connections.every(connection => connection.state === 'closed'))
    assert.ok(w.peer === null || w.peer.state === 'closed')
  },
  letsLockGo: w => assert.equal(w.h.held.size, 0),
  ignoresIt: w => assert.deepEqual(w.h.namesSince(w.from), [])
}

const scenario =
  (state: State, event: Event): Check<Outcome> =>
  async outcome => {
    const w = await setup(state, event)
    await fire[event](w, state)
    await settle()
    for (const name of outcome.effects) {
      assert.ok(effect[name], `no check of ${name}`)
      effect[name](w)
    }
    if (outcome.reason === 'outdated') {
      assert.equal((reasonOf(w) as {readonly reason?: string}).reason, 'outdated')
    }
    if (!outcome.effects.includes('appToldReasonOnce')) {
      assert.deepEqual(w.h.namesSince(w.from), [])
    }
    if (outcome.next === 'done') {
      assert.equal(w.room.send('hello'), false)
      assert.equal(w.h.held.size, 0)
    }
  }

const forState = (state: State) =>
  Object.fromEntries((Object.keys(table[state]) as Event[]).map(event => [event, scenario(state, event)])) as {
    readonly [E in Event]: Check<Outcome>
  }

testCells<Table, Outcome>('ending', table, {
  creating: forState('creating'),
  joiningWithoutToken: forState('joiningWithoutToken'),
  participantEntering: forState('participantEntering'),
  participantInRoom: forState('participantInRoom'),
  ownerWithToken: forState('ownerWithToken'),
  done: forState('done')
})

test('8-4 when joining fails after the page was let in, the page closes its connections and writes no record', async () => {
  const h = pageHarness()
  const {peer} = await h.letIn()
  h.clock.advance(45_000)
  assert.deepEqual(h.told('failed'), [[{reason: 'unreachable'}]])
  assert.equal(peer.state, 'closed')
  assert.equal(h.record(), null)
  assert.equal(h.held.size, 0)
})

test('8-6 a participant told "outdated" by the owner page learns that the owner page is older', async () => {
  const h = pageHarness()
  const {peer} = await h.inRoom()
  peer.receive('e{"reason":"outdated","older":"page"}')
  assert.deepEqual(h.told('ended'), [[{reason: 'outdated', older: 'owner'}]])
})
