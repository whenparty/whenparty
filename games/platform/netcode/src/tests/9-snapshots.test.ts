import assert from 'node:assert/strict'
import {test} from 'node:test'
import {
  harness,
  hosting,
  joinedPage,
  lastSnapshot,
  playingPage,
  running,
  since,
  snapshots,
  snapshotText,
  snapshotValue,
  versions
} from './harness.ts'

test('9-1 a page drops a snapshot in which a number has another form', () => {
  for (const fields of [
    {n: 0},
    {term: 0},
    {term: 2_147_483_648},
    {match: [1, -1] as const},
    {time: -1},
    {seats: [1, 2.5]},
    {accepted: [[2, 0] as const]}
  ]) {
    const h = harness()
    joinedPage(h)
    h.rooms.on.text(snapshotText(fields), 1)
    assert.equal(h.netcode.phase, 'joined')
  }
  const h = harness()
  joinedPage(h)
  h.rooms.on.text(snapshotText({n: 2 ** 53 - 1, term: 2_147_483_647, match: [2_147_483_647, 2 ** 53 - 1], time: 2 ** 53 - 1}), 1)
  assert.equal(h.netcode.phase, 'playing')
})

test('9-2 a snapshot holds the state, the match, the seats, the queue, the accepted numbers, the room time, the term and number, and the versions', () => {
  const h = harness()
  running(h, [3])
  h.rooms.on.text(JSON.stringify({t: 'action', n: 1, match: [1, 1], action: 'x'}), 2)
  const sent = JSON.parse(h.rooms.last.sent.at(-1) ?? '{}') as Record<string, unknown>
  assert.deepEqual(Object.keys(sent).sort(), [
    'accepted',
    'match',
    'n',
    'queue',
    'running',
    'seats',
    'state',
    't',
    'term',
    'time',
    'versions'
  ])
  assert.deepEqual(
    [sent.versions, sent.running, sent.match, sent.seats, sent.queue, sent.accepted],
    [versions, true, [1, 1], [1, 2], [3], [[2, 1]]]
  )
})

test('9-3 the first change of a term makes snapshot 1 and each further change adds 1', () => {
  const h = harness()
  hosting(h, [2, 3])
  assert.deepEqual(
    snapshots(h, 0).map(view => view.snapshot.number),
    [1, 2, 3]
  )
})

test('9-3 a snapshot of a higher term is newer whatever its number', () => {
  const h = harness()
  playingPage(h, {term: 1, n: 9})
  h.rooms.on.text(snapshotText({term: 2, n: 1, time: 77}), 1)
  assert.equal(lastSnapshot(h).snapshot.roomTime, 77)
  h.rooms.on.text(snapshotText({term: 1, n: 10, time: 88}), 1)
  assert.equal(lastSnapshot(h).snapshot.roomTime, 77)
})

test('9-4 a refused action and an event that calls no presence make no change', () => {
  const h = harness()
  running(h, [3])
  const mark = h.told.length
  h.netcode.act('refuse')
  h.rooms.on.participantLost(3)
  assert.deepEqual(snapshots(h, mark), [])
})

test('9-5 the host writes each snapshot to the record before it sends it, also when writing fails', () => {
  const h = harness()
  const room = hosting(h)
  room.failWrites = true
  const mark = room.calls.length
  h.rooms.on.participantJoined(2, 'visible')
  const calls = room.calls.slice(mark)
  assert.deepEqual(
    calls.map(([name]) => name),
    ['write', 'send']
  )
  const [[, written], [, sent]] = calls as [readonly ['write', {snapshot: {n: number}}], readonly ['send', string]]
  assert.equal(written.snapshot.n, 2)
  assert.equal((JSON.parse(sent) as {n: number}).n, 2)
})

test('9-6 the netcode keeps its data in the record data only', () => {
  const host = harness()
  const room = hosting(host)
  assert.deepEqual(Object.keys(room.record as object).sort(), ['snapshot', 'time', 'versions'])
  const page = harness()
  const participantRoom = playingPage(page)
  page.netcode.act('x')
  assert.deepEqual(participantRoom.record, {versions, action: 1})
})

test('9-7 when a connection opens and causes no change, the host sends that participant its last snapshot', () => {
  const h = harness()
  const room = hosting(h, [2])
  h.rooms.on.participantLost(2)
  h.rooms.on.participantBack(2, 'visible')
  const [to, text] = room.sentTo.at(-1) ?? []
  assert.equal(to, 2)
  assert.equal((JSON.parse(text ?? '{}') as {n: number}).n, lastSnapshot(h).snapshot.number)
})

test('9-8 the host page takes each snapshot that it makes', () => {
  const h = harness()
  const room = hosting(h, [2])
  assert.equal(snapshots(h, 0).length, room.sent.length)
})

test('9-9 a snapshot whose state fails is state, or whose rest has another form, is dropped', () => {
  for (const value of [snapshotValue({state: {nolog: true}}), {...snapshotValue(), running: 'yes'}, {...snapshotValue(), queue: null}]) {
    const h = harness()
    joinedPage(h)
    h.rooms.on.text(JSON.stringify(value), 1)
    assert.equal(h.netcode.phase, 'joined')
  }
  const h = harness()
  joinedPage(h)
  h.rooms.on.text(snapshotText({state: null, running: false}), 1)
  assert.equal(h.netcode.phase, 'playing')
})

test('9-9 the versions are read before anything else in the snapshot', () => {
  const h = harness()
  joinedPage(h)
  h.rooms.on.text(JSON.stringify({...snapshotValue({versions: [2, 1]}), n: 'bad'}), 1)
  assert.deepEqual(since(h, 0).at(-1), ['failed', {cause: 'other version', older: 'page'}])
})
