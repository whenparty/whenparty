import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {Room} from '../api.ts'
import {testCells, type Check, type Scenario} from './cells.ts'
import {createRooms} from '../rooms.ts'
import {app, code, pageHarness, settle, type PageHarness} from './page-harness.ts'
import {record, start} from './9-tab.states.ts'

type StartTable = typeof start
type StartState = keyof StartTable
type StartEvent = keyof StartTable[StartState]
type StartOutcome = {readonly next: string; readonly reason?: string; readonly effects: readonly string[]}

interface World {
  readonly h: PageHarness
  room: Room | null
  calls: (Room | null)[]
  from: number
}

const otherCode = 'ZZZZZ'

const setupStart = async (state: StartState, branch?: string): Promise<World> => {
  const lock = state === 'lockHeldElsewhere' ? 'elsewhere' : state === 'lockNotGiven' ? 'refused' : 'free'
  const h = pageHarness({lock})
  const w: World = {h, room: null, calls: [], from: 0}
  if (state === 'participantRecord' || state === 'lockHeldElsewhere' || state === 'lockNotGiven' || state === 'leavingRecordRoom') {
    h.putRecord(h.participantRecord())
  }
  if (state === 'ownerRecord') {
    h.putRecord(h.ownerRecord())
  }
  if (state === 'lockHeldHere') {
    w.room = await h.join()
  }
  if (state === 'leavingRecordRoom') {
    w.room = branch === 'the app joins' ? await h.join(null, otherCode) : await h.create()
  }
  w.from = h.mark()
  return w
}

const call = (w: World, room: Room | null): void => {
  w.calls.push(room)
}

const fireStart: {readonly [E in StartEvent]: (w: World) => void} = {
  create: w => call(w, w.h.rooms.create(app, null, w.h.handlers)),
  joinWithRecordCode: w => call(w, w.h.rooms.join(app, code, null, w.h.handlers)),
  joinWithAnotherCode: w => call(w, w.h.rooms.join(app, otherCode, null, w.h.handlers)),
  return: w => call(w, w.h.rooms.return(app, w.h.handlers)),
  signalingOpens: w => w.h.latest().open(),
  signalingCannotOpen: w => w.h.latest().drop()
}

const startEffect: {readonly [name: string]: (w: World) => void} = {
  callFails: w => assert.deepEqual(w.calls, [null]),
  recordStays: w => assert.equal(w.h.record()?.token, 'participant token'),
  appToldReturnAtOnce: w => {
    assert.equal(w.h.namesSince(w.from)[0], 'returning')
    assert.equal(w.h.latest().state, 'opening')
  },
  opensSignaling: w => assert.equal(w.h.transport.connections.length, 1),
  sendsLeaveWithRecordToken: w => assert.equal(w.h.latest().last('leave')?.token, 'participant token'),
  deletesRecord: w => assert.equal(w.h.record(), null)
}

const checkStartNext = (w: World, next: string, reason: string | undefined): void => {
  const h = w.h
  const opened = (): void => {
    if (h.latest().state === 'opening') {
      h.latest().open()
    }
  }
  switch (next) {
    case 'failed':
      return assert.deepEqual(h.told('failed').at(-1), [{reason}])
    case 'lockHeldHere':
      return assert.equal(h.held.size, 1)
    case 'creating':
      opened()
      return assert.equal(h.latest().sent.at(-1)?.t, 'create')
    case 'joiningAsNew':
      opened()
      return assert.equal(h.latest().sent.at(-1)?.t, 'join')
    case 'returningAsParticipant':
      opened()
      return assert.deepEqual([h.latest().sent.at(-1)?.t, h.latest().sent.at(-1)?.term], ['return', undefined])
    case 'returningAsOwner':
      opened()
      return assert.deepEqual([h.latest().sent.at(-1)?.t, h.latest().sent.at(-1)?.term], ['return', 1])
    case 'leavingRecordRoom':
      assert.equal(h.latest().state, 'opening')
      return assert.notEqual(h.record(), null)
  }
  assert.fail(`no check of ${next}`)
}

const startScenario = (state: StartState, event: StartEvent): Scenario<StartOutcome> => {
  const run =
    (branch?: string): Check<StartOutcome> =>
    async outcome => {
      const w = await setupStart(state, branch)
      fireStart[event](w)
      await settle()
      for (const name of outcome.effects) {
        assert.ok(startEffect[name], `no check of ${name}`)
        startEffect[name](w)
      }
      checkStartNext(w, outcome.next, outcome.reason)
    }
  const cell = start[state][event]
  if ('ids' in cell && 'branches' in cell.outcome) {
    return Object.fromEntries(cell.outcome.branches.map(branch => [branch.when, run(branch.when)]))
  }
  return run()
}

const startScenarios = (state: StartState) =>
  Object.fromEntries((Object.keys(start[state]) as StartEvent[]).map(event => [event, startScenario(state, event)])) as {
    readonly [E in StartEvent]: Scenario<StartOutcome>
  }

testCells<StartTable, StartOutcome>('start', start, {
  lockHeldElsewhere: startScenarios('lockHeldElsewhere'),
  lockNotGiven: startScenarios('lockNotGiven'),
  lockHeldHere: startScenarios('lockHeldHere'),
  noRecord: startScenarios('noRecord'),
  participantRecord: startScenarios('participantRecord'),
  ownerRecord: startScenarios('ownerRecord'),
  leavingRecordRoom: startScenarios('leavingRecordRoom')
})

type RecordTable = typeof record
type RecordState = keyof RecordTable
type RecordEvent = keyof RecordTable[RecordState]
type RecordOutcome = {readonly next: RecordState; readonly effects: readonly string[]}

interface RecordWorld {
  readonly h: PageHarness
  readonly room: Room
  result: boolean | null
  writes: number
}

const setupRecord = async (state: RecordState): Promise<RecordWorld> => {
  const h = pageHarness()
  const room = state === 'written' ? (await h.inRoom()).room : await h.asked()
  return {h, room, result: null, writes: h.storage.writes}
}

const fireRecord: {readonly [E in RecordEvent]: (w: RecordWorld) => void | Promise<void>} = {
  appGivesRecordData: w => {
    w.result = w.room.setRecordData({level: 3})
  },
  appGivesNonJson: w => {
    w.result = w.room.setRecordData(new Map())
  },
  firstWrite: async w => {
    w.room.setRecordData({level: 3})
    w.h.latest().answer('let in', {token: 'participant token', n: 2, wait: 600, owner: 'owner peer'}, 'join')
    const peer = w.h.latest().peers.at(-1)
    peer?.open()
    peer?.receive('c')
    await settle()
  },
  keptValueChanges: async w => {
    w.h
      .latest()
      .peers.at(-1)
      ?.drop('broken', w.h.clock.now() - 1_000)
    await settle()
  },
  writeFails: async w => {
    w.h.storage.failWrites = true
    w.result = w.room.setRecordData({level: 4})
    w.h
      .latest()
      .peers.at(-1)
      ?.drop('broken', w.h.clock.now() - 1_000)
    await settle()
  }
}

const recordEffect: {readonly [name: string]: (w: RecordWorld) => void} = {
  keepsDataInMemory: w => {
    assert.deepEqual([w.result, w.h.record()], [true, null])
  },
  writesWholeRecord: w => {
    const kept = w.h.record()
    assert.deepEqual([kept?.code, kept?.token, kept?.number, kept?.wait], [code, 'participant token', 2, 600])
  },
  writesBeforeCallReturns: w => assert.deepEqual([w.result, w.h.record()?.data], [true, {level: 3}]),
  callFails: w => assert.equal(w.result, false),
  goesOnFromMemory: w => {
    assert.equal(w.h.record()?.data, undefined)
    assert.deepEqual(w.h.told('ownerLost'), [[]])
    assert.ok(w.h.latest().state !== 'closed' || w.h.transport.connections.length > 1)
  }
}

const recordScenario =
  (state: RecordState, event: RecordEvent): Check<RecordOutcome> =>
  async outcome => {
    const w = await setupRecord(state)
    await fireRecord[event](w)
    for (const name of outcome.effects) {
      assert.ok(recordEffect[name], `no check of ${name}`)
      recordEffect[name](w)
    }
    if (event === 'firstWrite') {
      assert.deepEqual(w.h.record()?.data, {level: 3})
    }
    assert.equal(w.h.record() !== null, outcome.next === 'written')
  }

const recordScenarios = (state: RecordState) =>
  Object.fromEntries((Object.keys(record[state]) as RecordEvent[]).map(event => [event, recordScenario(state, event)])) as {
    readonly [E in RecordEvent]: Check<RecordOutcome>
  }

testCells<RecordTable, RecordOutcome>('record', record, {
  beforeFirstWrite: recordScenarios('beforeFirstWrite'),
  written: recordScenarios('written')
})

test('9-3 a page lets the lock go when it goes into the back/forward cache, and reloads when it comes back', async () => {
  const h = pageHarness()
  await h.inRoom()
  assert.equal(h.held.size, 1)
  h.hide(false)
  assert.equal(h.held.size, 1)
  h.hide(true)
  assert.equal(h.held.size, 0)
  h.show(false)
  assert.equal(h.reloads(), 0)
  h.show(true)
  assert.equal(h.reloads(), 1)
})

test('9-3 a page that goes into the back/forward cache while it leaves the room of its record lets the lock go', async () => {
  const h = pageHarness()
  h.putRecord(h.participantRecord())
  await h.join(null, otherCode)
  assert.equal(h.held.size, 1)
  h.hide(true)
  assert.equal(h.held.size, 0)
})

test('9-3 a page holds the lock until the room ends for it', async () => {
  const h = pageHarness()
  const {peer} = await h.inRoom()
  assert.equal(h.rooms.create(app, null, h.handlers), null)
  peer.receive('e{"reason":"room closed"}')
  assert.equal(h.held.size, 0)
  assert.ok(h.rooms.create(app, null, h.handlers))
})

test('9-4 a record that cannot be read, or is not in the form that the module writes, counts as no record', async () => {
  for (const text of ['{', '{"role":"participant"}', '{"role":"guest","code":"BCDFG","token":"t","number":2,"wait":600}', '42']) {
    const h = pageHarness()
    h.storage.items.set('whenparty:rooms:tictactoe', text)
    h.rooms.return(app, h.handlers)
    await settle()
    assert.deepEqual(h.told('failed'), [[{reason: 'no room'}]], text)
  }
})

test('9-4 the record of the app ID is kept under its key and written as a whole', async () => {
  const h = pageHarness()
  await h.inRoom()
  assert.deepEqual(Object.keys(h.record() ?? {}).sort(), ['code', 'number', 'ownerLostSince', 'role', 'token', 'wait'])
  assert.deepEqual([...h.storage.items.keys()], ['whenparty:rooms:tictactoe'])
})

test('9-4 the owner page writes the record when a return gets another term', async () => {
  const h = pageHarness()
  h.putRecord(h.ownerRecord())
  h.rooms.return(app, h.handlers)
  await settle()
  h.latest().open()
  h.latest().answer('term', {term: 4}, 'return')
  assert.equal(h.record()?.term, 4)
})

test('9-8 9-7 a return tells the app the record data of the record, and then keeps the value that the app gave before', async () => {
  const h = pageHarness()
  h.putRecord(h.participantRecord({data: {score: 1}}))
  const room = h.rooms.return(app, h.handlers)
  assert.equal(room?.setRecordData({score: 2}), true)
  await settle()
  assert.deepEqual(h.told('returning'), [['participant', 2, {score: 1}]])
  assert.deepEqual(h.record()?.data, {score: 2})
})

test('9-8 a return from the record tells the app the role, the number and the record data before it opens a signaling connection', async () => {
  const h = pageHarness()
  h.putRecord(h.participantRecord({number: 5, data: {score: [1, 2]}}))
  h.rooms.return(app, h.handlers)
  await settle()
  assert.deepEqual(h.told('returning'), [['participant', 5, {score: [1, 2]}]])
  assert.equal(h.latest().state, 'opening')
})

test('9-1 9-2 two pages of one browser share the lock of an app ID', async () => {
  const h = pageHarness()
  await h.inRoom()
  const other = createRooms(h.env)
  const failures: unknown[] = []
  other.create(app, null, {failed: failure => void failures.push(failure)})
  await settle()
  assert.deepEqual(failures, [{reason: 'open elsewhere'}])
  assert.equal(h.record()?.token, 'participant token')
})
