import assert from 'node:assert/strict'
import {test} from 'node:test'
import {table} from './6-calls.states.ts'
import {settle} from './fake-page.ts'
import {ServerHarness, type FakeServerSocket} from './fake-server.ts'
import {hostCandidate, PeerScene} from './peer-scene.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']

const offer = {type: 'offer', sdp: 'v=0 offer'}
const answer = {type: 'answer', sdp: 'v=0 answer'}
const candidate = {candidate: 'candidate:1 1 udp 1 192.0.2.1 50000 typ host', sdpMid: '0', sdpMLineIndex: 0}

interface Page {
  readonly socket: FakeServerSocket
  readonly peerId: string
}

class Scene {
  readonly h = new ServerHarness()
  readonly caller: Page
  readonly callee: Page
  readonly stranger: Page
  readonly pc = 'call-identifier-000001'
  marks = new Map<FakeServerSocket, number>()

  constructor() {
    this.caller = this.h.open()
    this.callee = this.h.open()
    this.stranger = this.h.open()
    this.h.port().allow(this.callee.peerId, this.caller.peerId)
  }

  call(from: Page = this.caller, extra: Record<string, unknown> = {}, pc = this.pc): void {
    from.socket.receive({t: 'call', pc, to: this.callee.peerId, ms: 15_000, d: offer, ...extra})
  }

  mark(): void {
    this.marks = new Map([this.caller, this.callee, this.stranger].map(page => [page.socket, page.socket.sent.length]))
  }

  since(page: Page): Record<string, unknown>[] {
    return page.socket.sent.slice(this.marks.get(page.socket) ?? 0).filter(message => message.t !== 'check')
  }

  isLive(): boolean {
    this.mark()
    this.callee.socket.receive({t: 'signal', pc: this.pc, c: []})
    return this.since(this.caller).some(message => message.t === 'signal')
  }
}

const crowd = (scene: Scene, count: number, perCaller: boolean): void => {
  for (let index = 0; index < count; index += 1) {
    const caller = perCaller ? scene.caller : scene.h.open()
    if (!perCaller) {
      scene.h.port().allow(scene.callee.peerId, caller.peerId)
    }
    caller.socket.receive({t: 'call', pc: `crowd-${index}`, to: scene.callee.peerId, ms: 15_000, d: offer})
  }
}

const events: {readonly [E in Event]: (scene: Scene) => void} = {
  'a call with the identifier arrives, and its remaining time is not a whole number of milliseconds from 1 to 15,000': scene => {
    for (const ms of [0, 15_001, 1.5, '100', -1]) {
      scene.call(scene.caller, {ms})
    }
  },
  'a call with the identifier arrives, and its description is over 16,384 bytes': scene =>
    scene.call(scene.caller, {d: {type: 'offer', sdp: 'x'.repeat(16_385)}}),
  'a call with the identifier arrives for a peer ID that no open signaling connection has, that is the caller own, or whose list lacks the caller':
    scene => {
      scene.call(scene.caller, {to: 'nobody-has-this-peer-id'})
      scene.call(scene.caller, {to: scene.caller.peerId})
      scene.call(scene.stranger)
    },
  'a call with the identifier arrives while the callee is the callee of 12 live records, or of 2 with this caller, or the caller is the caller of 64':
    scene => {
      if (scene.isLive()) {
        scene.mark()
        scene.call()
        return
      }
      crowd(scene, 2, true)
      scene.mark()
      scene.call()
    },
  'a call with the identifier arrives, and no other reason of 6-1 applies to it': scene => scene.call(),
  'a signal within the limits of 6-5 arrives from one of the two pages': scene => {
    scene.callee.socket.receive({t: 'signal', pc: scene.pc, d: answer})
    scene.callee.socket.receive({t: 'signal', pc: scene.pc, c: [candidate]})
  },
  'a signal beyond the limits of 6-5 arrives from one of the two pages': scene =>
    scene.caller.socket.receive({t: 'signal', pc: scene.pc, d: answer}),
  'a signal or closing message with the identifier arrives from another page': scene => {
    scene.stranger.socket.receive({t: 'signal', pc: scene.pc, c: [candidate]})
    scene.stranger.socket.receive({t: 'close', pc: scene.pc, reason: 'closed'})
  },
  'a closing message arrives from one of the two pages': scene =>
    scene.caller.socket.receive({t: 'close', pc: scene.pc, reason: 'timeout'}),
  'the deadline of the record passes': scene => scene.h.clock.advance(15_000),
  'the signaling connection of one of the two pages closes': scene => scene.caller.socket.drop()
}

const rejection = (scene: Scene, reason: string): void => {
  const rejects = scene.since(scene.caller).filter(message => message.t === 'reject')
  assert.ok(rejects.length > 0)
  assert.ok(
    rejects.every(message => message.reason === reason && message.pc === scene.pc),
    JSON.stringify(rejects)
  )
  assert.deepEqual(scene.since(scene.callee), [])
}

const expectEffect = (scene: Scene, event: Event, outcome: Outcome): void => {
  switch (outcome.effect) {
    case 'the caller gets failed, and the callee is told nothing':
      rejection(scene, 'failed')
      return
    case 'the caller gets no peer, and the callee is told nothing':
      rejection(scene, 'no peer')
      return
    case 'the caller gets busy, and the callee is told nothing':
      rejection(scene, 'busy')
      return
    case 'the callee gets the call with the caller description at once':
      assert.deepEqual(scene.since(scene.callee), [{t: 'call', pc: scene.pc, from: scene.caller.peerId, ms: 15_000, d: offer}])
      return
    case 'the other page gets it, in the order it arrived':
      if (event === 'a closing message arrives from one of the two pages') {
        assert.deepEqual(scene.since(scene.callee), [{t: 'close', pc: scene.pc, from: scene.caller.peerId, reason: 'timeout'}])
      } else {
        assert.deepEqual(scene.since(scene.caller), [
          {t: 'signal', pc: scene.pc, from: scene.callee.peerId, d: answer},
          {t: 'signal', pc: scene.pc, from: scene.callee.peerId, c: [candidate]}
        ])
      }
      return
    case 'the server drops it, and both pages get failed':
      assert.deepEqual(scene.since(scene.caller), [{t: 'failed', pc: scene.pc}])
      assert.deepEqual(scene.since(scene.callee), [{t: 'failed', pc: scene.pc}])
      return
    case 'the server drops it':
      assert.deepEqual(scene.since(scene.caller), [])
      assert.deepEqual(scene.since(scene.callee), [])
      assert.deepEqual(scene.since(scene.stranger), [])
      return
    case 'the other page gets peer offline':
      assert.deepEqual(scene.since(scene.callee), [{t: 'gone', pc: scene.pc}])
      return
    case 'nothing':
      assert.deepEqual(scene.since(scene.callee), [])
  }
}

for (const [state, cells] of Object.entries(table) as [State, Table[State]][]) {
  for (const [event, cell] of Object.entries(cells) as [Event, Table[State][Event]][]) {
    if (!('outcome' in cell)) {
      continue
    }
    test(`${cell.ids.join(' ')} ${state}: ${event}`, () => {
      const scene = new Scene()
      if (state === 'live') {
        scene.call()
      }
      scene.mark()
      events[event](scene)
      expectEffect(scene, event, cell.outcome)
      if (!scene.caller.socket.isClosed) {
        assert.equal(scene.isLive(), cell.outcome.state === 'live')
      }
    })
  }
}

test('6-1 a call that several reasons apply to gets failed before no peer, and no peer before busy', () => {
  const scene = new Scene()
  crowd(scene, 12, false)
  scene.mark()
  scene.call(scene.stranger, {ms: 0}, 'late-unlisted-and-busy')
  scene.call(scene.stranger, {d: {type: 'offer', sdp: 'x'.repeat(16_385)}}, 'large-unlisted-and-busy')
  scene.call(scene.stranger, {}, 'unlisted-and-busy')
  assert.deepEqual(
    scene.since(scene.stranger).map(message => `${String(message.pc)}: ${String(message.reason)}`),
    ['late-unlisted-and-busy: failed', 'large-unlisted-and-busy: failed', 'unlisted-and-busy: no peer']
  )
  assert.deepEqual(scene.since(scene.callee), [])
})

test('6-1 the remaining time may be 1 or 15,000 milliseconds', () => {
  for (const ms of [1, 15_000]) {
    const scene = new Scene()
    scene.call(scene.caller, {ms})
    assert.equal(scene.callee.socket.last('call')?.ms, ms)
  }
})

test('6-1 the callee may be the callee of 11 live records, and of 12 it is busy', () => {
  const scene = new Scene()
  crowd(scene, 11, false)
  scene.call()
  assert.equal(scene.callee.socket.last('call')?.pc, scene.pc)
  scene.mark()
  scene.call(scene.caller, {}, 'one-more-call-identifier')
  assert.equal(scene.since(scene.caller).at(-1)?.reason, 'busy')
})

test('6-1 the caller may be the caller of 63 live records, and of 64 it is busy', () => {
  const scene = new Scene()
  const callees = Array.from({length: 32}, () => scene.h.open())
  for (const [index, callee] of callees.entries()) {
    scene.h.port().allow(callee.peerId, scene.caller.peerId)
    for (const copy of [0, 1]) {
      scene.caller.socket.receive({t: 'call', pc: `many-${index}-${copy}`, to: callee.peerId, ms: 15_000, d: offer})
    }
  }
  assert.equal(scene.caller.socket.of('reject').length, 0)
  scene.call()
  assert.equal(scene.caller.socket.last('reject')?.reason, 'busy')
})

test('6-1 a description of 16,384 bytes passes', () => {
  const scene = new Scene()
  scene.call(scene.caller, {d: {type: 'offer', sdp: 'é'.repeat(8_192)}})
  assert.equal(scene.callee.socket.last('call')?.pc, scene.pc)
})

test('6-1 the list of the callee is checked when the call arrives', () => {
  const scene = new Scene()
  scene.h.port().disallow(scene.callee.peerId, scene.caller.peerId)
  scene.call()
  assert.equal(scene.caller.socket.last('reject')?.reason, 'no peer')
})

test('6-4 the server passes the callee its own remaining time, rounded up', () => {
  const scene = new Scene()
  scene.h.clock.advance(0.4)
  scene.call(scene.caller, {ms: 1_234})
  assert.equal(scene.callee.socket.last('call')?.ms, 1_234)
  scene.h.clock.advance(1_233)
  assert.equal(scene.isLive(), true)
  scene.h.clock.advance(1)
  assert.equal(scene.isLive(), false)
})

test('6-5 each page may pass 32 candidates and 16,384 bytes, and one more fails the attempt', () => {
  const many = (count: number) => Array.from({length: count}, () => candidate)
  const scene = new Scene()
  scene.call()
  scene.callee.socket.receive({t: 'signal', pc: scene.pc, c: many(31)})
  scene.callee.socket.receive({t: 'signal', pc: scene.pc, c: many(1)})
  assert.equal(scene.isLive(), true)
  scene.callee.socket.receive({t: 'signal', pc: scene.pc, c: many(1)})
  assert.equal(scene.caller.socket.last('failed')?.pc, scene.pc)

  const bytes = new Scene()
  bytes.call(bytes.caller, {d: {type: 'offer', sdp: 'x'.repeat(16_384 - candidate.candidate.length)}})
  bytes.caller.socket.receive({t: 'signal', pc: bytes.pc, c: [candidate]})
  assert.equal(bytes.callee.socket.last('signal')?.pc, bytes.pc)
  bytes.caller.socket.receive({t: 'signal', pc: bytes.pc, c: [{...candidate, candidate: 'x'}]})
  assert.equal(bytes.callee.socket.last('failed')?.pc, bytes.pc)
})

test('6-5 candidates inside a description count toward the bytes and not toward the 32', () => {
  const scene = new Scene()
  scene.call()
  const inside = `v=0\r\n${Array.from({length: 40}, () => `a=${candidate.candidate}`).join('\r\n')}`
  scene.callee.socket.receive({t: 'signal', pc: scene.pc, d: {type: 'answer', sdp: inside}})
  scene.callee.socket.receive({t: 'signal', pc: scene.pc, c: Array.from({length: 32}, () => candidate)})
  assert.equal(scene.caller.socket.of('failed').length, 0)
})

test('6-6 the record of an open peer connection lives until its deadline and counts toward the limits', () => {
  const scene = new Scene()
  scene.call()
  scene.call(scene.caller, {}, 'second-call-identifier')
  scene.mark()
  scene.call(scene.caller, {}, 'third-call-identifier')
  assert.equal(scene.since(scene.caller).at(-1)?.reason, 'busy')
  scene.h.clock.advance(15_000)
  scene.call(scene.caller, {}, 'fourth-call-identifier')
  assert.equal(scene.callee.socket.last('call')?.pc, 'fourth-call-identifier')
})

test('6-4 the call carries the caller page remaining time, rounded up to a whole millisecond', async () => {
  const scene = new PeerScene()
  scene.connect()
  scene.h.clock.advance(1_234.6)
  scene.answerTurn()
  await settle()
  assert.equal(scene.h.socket.last('call')?.ms, 13_766)
})

test('6-7 the page sends its description first without candidates, then at most 16 host, 8 server-reflexive and 8 relay candidates, each once', async () => {
  const scene = new PeerScene()
  await scene.withRtc()
  const call = scene.h.socket.last('call')
  assert.equal(String((call?.d as {sdp: string}).sdp).includes('candidate'), false)
  for (const type of ['host', 'srflx', 'relay', 'prflx']) {
    for (let index = 0; index < 20; index += 1) {
      scene.rtc.gather({
        candidate: `candidate:${type}${index} 1 udp 1 192.0.2.1 ${5000 + index} typ ${type}`,
        sdpMid: '0',
        sdpMLineIndex: 0
      })
    }
  }
  scene.rtc.gather(null)
  const sent = scene.h.socket.sent.filter(message => message.t === 'signal').flatMap(message => message.c as {candidate: string}[])
  const count = (type: string) => sent.filter(candidate => candidate.candidate.endsWith(`typ ${type}`)).length
  assert.deepEqual([count('host'), count('srflx'), count('relay'), count('prflx')], [16, 8, 8, 0])
  assert.equal(new Set(sent.map(candidate => candidate.candidate)).size, sent.length)
  assert.ok(
    scene.h.socket.sent.findIndex(message => message.t === 'call') < scene.h.socket.sent.findIndex(message => message.t === 'signal')
  )
})

test('6-7 the page sends no candidate that would take its signals over 16,384 bytes', async () => {
  const scene = new PeerScene()
  await scene.withRtc()
  const offerBytes = 'v=0 offer'.length
  const filler = (bytes: number) => `candidate:${'x'.repeat(bytes - 'candidate: typ host'.length)} typ host`
  scene.rtc.gather({candidate: filler(16_384 - offerBytes - 100), sdpMid: '0', sdpMLineIndex: 0})
  scene.rtc.gather({candidate: filler(101), sdpMid: '0', sdpMLineIndex: 0})
  scene.rtc.gather({candidate: filler(100), sdpMid: '0', sdpMLineIndex: 0})
  scene.h.clock.advance(250)
  const sent = scene.h.socket.sent.filter(message => message.t === 'signal').flatMap(message => message.c as {candidate: string}[])
  assert.deepEqual(
    sent.map(candidate => candidate.candidate.length),
    [16_384 - offerBytes - 100, 100]
  )
})

test('6-8 a candidate that arrives before the description of the other side is used once the description arrives', async () => {
  const scene = new PeerScene()
  await scene.withRtc()
  scene.fromOther({t: 'signal', c: [hostCandidate]})
  await settle()
  assert.deepEqual(scene.rtc.added, [])
  await scene.remoteAnswer()
  assert.deepEqual(scene.rtc.added, [hostCandidate])
})

test('6-8 the page drops a signal with an identifier it does not know or from another peer ID', async () => {
  const scene = new PeerScene()
  await scene.withRtc()
  await scene.remoteAnswer()
  scene.h.socket.receive({t: 'signal', pc: 'unknown-identifier', from: 'other-peer', c: [hostCandidate]})
  scene.h.socket.receive({t: 'signal', pc: scene.pc, from: 'third-peer', c: [hostCandidate]})
  scene.h.socket.receive({t: 'close', pc: scene.pc, from: 'third-peer', reason: 'closed'})
  await settle()
  assert.deepEqual(scene.rtc.added, [])
  assert.equal(scene.connection.state, 'connecting')
})
