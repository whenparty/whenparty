import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {Room} from '../api.ts'
import {testCells, type Check} from './cells.ts'
import type {FakePeer} from './fake-transport.ts'
import {app, code, ownerWithParticipant, pageHarness, type PageHarness} from './page-harness.ts'
import {table} from './7-texts.states.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = {readonly send?: string; readonly arrival?: string}

interface World {
  readonly h: PageHarness
  readonly room: Room
  readonly peer: FakePeer | null
  readonly owner: boolean
}

const setup = async (state: State): Promise<World> => {
  const h = pageHarness()
  switch (state) {
    case 'participantNotInRoom': {
      const {room, peer} = await h.letIn()
      peer.open()
      return {h, room, peer, owner: false}
    }
    case 'participantInRoom': {
      const {room, peer} = await h.inRoom()
      return {h, room, peer, owner: false}
    }
    case 'ended': {
      const {room, peer} = await h.inRoom()
      peer.receive('e{"reason":"room closed"}')
      return {h, room, peer, owner: false}
    }
    case 'ownerNumberOpen': {
      const {room, peer} = await ownerWithParticipant(h)
      return {h, room, peer, owner: true}
    }
    case 'ownerNumberNotOpen': {
      const room = await h.owning()
      h.latest().receive({t: 'ask', app, code, n: 2, data: null})
      h.requests.at(-1)?.letIn()
      h.latest().receive({t: 'named', app, code, n: 2, peer: 'participant peer'})
      const peer = h.latest().call('participant peer')
      peer.open()
      return {h, room, peer, owner: true}
    }
    case 'ownerNumberUnknownOrRemoved': {
      const room = await h.owning()
      return {h, room, peer: null, owner: true}
    }
  }
}

const fire: {readonly [E in Event]: (w: World) => boolean | null} = {
  appSendsText: w => (w.owner ? w.room.sendTo(2, 'hello') : w.room.send('hello')),
  appSendsNonText: w => (w.owner ? w.room.sendTo(2, 42) : w.room.send(42)),
  appSendsToAll: w => w.room.send('hello'),
  textArrives: w => {
    w.peer?.receive('thello')
    return null
  },
  foreignFormArrives: w => {
    w.peer?.receive('x{}')
    w.peer?.receive('')
    return null
  }
}

const scenario =
  (state: State, event: Event): Check<Outcome> =>
  async outcome => {
    const w = await setup(state)
    const sentBefore = w.peer?.sent.length ?? 0
    const result = fire[event](w)
    const sentTexts = (w.peer?.sent.slice(sentBefore) ?? []).filter(text => text === 'thello')
    if (outcome.send === 'sent') {
      assert.deepEqual([result, sentTexts], [true, ['thello']])
    } else if (outcome.send === 'callFails') {
      assert.deepEqual([result, sentTexts], [false, []])
    } else if (outcome.send === 'skipped') {
      assert.deepEqual([result, sentTexts], [true, []])
    }
    if (outcome.arrival === 'appGetsTextWithSenderNumber') {
      assert.deepEqual(w.h.told('text'), [['hello', w.owner ? 2 : 1]])
    } else if (outcome.arrival === 'dropped') {
      assert.deepEqual(w.h.told('text'), [])
    }
  }

const forState = (state: State) =>
  Object.fromEntries((Object.keys(table[state]) as Event[]).map(event => [event, scenario(state, event)])) as {
    readonly [E in Event]: Check<Outcome>
  }

testCells<Table, Outcome>('texts', table, {
  participantNotInRoom: forState('participantNotInRoom'),
  participantInRoom: forState('participantInRoom'),
  ownerNumberOpen: forState('ownerNumberOpen'),
  ownerNumberNotOpen: forState('ownerNumberNotOpen'),
  ownerNumberUnknownOrRemoved: forState('ownerNumberUnknownOrRemoved'),
  ended: forState('ended')
})

test('7-1 a text has at most 65,024 bytes of UTF-8 without lone surrogates', async () => {
  const h = pageHarness()
  const {room} = await h.inRoom()
  assert.ok(room.send('x'.repeat(65_024)))
  assert.ok(room.send('é'.repeat(32_512)))
  assert.equal(room.send('x'.repeat(65_025)), false)
  assert.equal(room.send('é'.repeat(32_512) + 'x'), false)
  assert.equal(room.send('\ud800'), false)
})

test('7-2 7-4 the owner page sends a text to all participants whose connections are open, in the order sent', async () => {
  const h = pageHarness()
  const {room, peer} = await ownerWithParticipant(h)
  assert.ok(room.send('one'))
  assert.ok(room.send('two'))
  assert.deepEqual(peer.sent.slice(-2), ['tone', 'ttwo'])
  peer.receive('tthree')
  peer.receive('tfour')
  assert.deepEqual(h.told('text'), [
    ['three', 2],
    ['four', 2]
  ])
})

test('7-3 sending fails after the app left', async () => {
  const h = pageHarness()
  const {room} = await ownerWithParticipant(h)
  room.leave()
  assert.equal(room.send('hello'), false)
  assert.equal(room.sendTo(2, 'hello'), false)
})
