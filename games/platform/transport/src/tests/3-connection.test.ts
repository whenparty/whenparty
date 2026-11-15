import assert from 'node:assert/strict'
import {test} from 'node:test'
import {secondIncomingHandler, start, table} from './3-connection.states.ts'
import {own, settle} from './fake-page.ts'
import {hostCandidate, PeerScene, turnServers, type PeerNotice} from './peer-scene.ts'
import {pick, seeded} from './seeded.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']
type StartEvent = keyof typeof start

const noRelay = (scene: PeerScene): void => {
  scene.rtc.onicecandidateerror?.({errorCode: 486})
}

const passDeadline = (scene: PeerScene): void => {
  if (scene.connection.state === 'open') {
    scene.h.clock.advance(10_000)
    scene.arrive(() => scene.channel.receiveOwn(own.answer))
  }
  scene.h.clock.advance(scene.startedAt + 15_000 - scene.h.clock.now())
}

const events: {readonly [E in Event]: ((scene: PeerScene) => void | Promise<void>) | null} = {
  'the module closes it': scene => scene.connection.close(),
  'the page unloads or enters the back/forward cache': scene => scene.h.hide(),
  'the page returns from the back/forward cache': () => {},
  'its own signaling connection closes': scene => scene.h.socket.drop(),
  'the server says that the signaling connection of the other page closed': scene => scene.fromOther({t: 'gone'}),
  'the server rejects the call with no peer': scene => scene.fromOther({t: 'reject', reason: 'no peer'}),
  'the server rejects the call with busy': scene => scene.fromOther({t: 'reject', reason: 'busy'}),
  'the server rejects the call with failed': scene => scene.fromOther({t: 'reject', reason: 'failed'}),
  'the server says that the attempt closed with failed': scene => scene.fromOther({t: 'failed'}),
  'TURN credentials arrive': async scene => {
    scene.answerTurn(turnServers)
    await settle()
  },
  'an empty answer about TURN credentials arrives': async scene => {
    scene.answerTurn(null)
    await settle()
  },
  'the browser reports that coturn had no free allocation for the side': noRelay,
  'a signal of the other side arrives, and the browser accepts it': async scene => {
    scene.fromOther({t: 'signal', c: [hostCandidate]})
    await settle()
  },
  'the browser rejects the description of the other side': async scene => {
    scene.rtc.rejectRemote = true
    await scene.remoteAnswer()
  },
  'the browser rejects a candidate of the other side': async scene => {
    if (scene.connection.state === 'connecting') {
      await scene.remoteAnswer()
    }
    scene.rtc.rejectCandidates = true
    scene.fromOther({t: 'signal', c: [hostCandidate]})
    await settle()
  },
  'the channel opens, and the side can send the largest text': async scene => {
    scene.channel.open()
    await settle()
  },
  'the channel opens, and the side cannot send the largest text': async scene => {
    scene.rtc.sctp = {maxMessageSize: 65_535}
    scene.channel.open()
    await settle()
  },
  'the ready of the other side arrives': scene => scene.arrive(() => scene.channel.receiveOwn(own.ready)),
  'the browser reports that the connection failed or closed, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
    async scene => {
      noRelay(scene)
      if (scene.connection.state === 'connecting') {
        await scene.remoteAnswer()
      }
      scene.rtc.report('failed')
    },
  'the browser reports that the connection failed or closed, in any other case': scene => scene.rtc.report('closed'),
  'the channel closes without a closing message': scene => scene.channel.finishClosing(),
  'the browser fails to send': async scene => {
    scene.channel.failSend = true
    if (scene.connection.state === 'connecting') {
      scene.channel.open()
    } else {
      scene.connection.send('text')
    }
    await settle()
  },
  'the deadline passes, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
    async scene => {
      noRelay(scene)
      if (scene.connection.state === 'connecting') {
        await scene.remoteAnswer()
      }
      passDeadline(scene)
    },
  'the deadline passes, in any other case': scene => passDeadline(scene),
  'the scripts resume after the deadline, with the ready of the other side waiting': scene => {
    scene.h.clock.sleep(15_000)
    scene.channel.receiveOwn(own.ready)
  },
  'a closing message arrives': scene => scene.channel.receiveOwn(own.closing, 'closed'),
  'a closing message with too small arrives': scene => scene.channel.receiveOwn(own.closing, 'too small'),
  'a text arrives, and the module has a handler of texts': scene => scene.channel.receive('hello'),
  'a text arrives, and the module has no handler of texts': scene => scene.channel.receive('hello'),
  'a message that is neither a text nor one of the transport own, or a text over 65,536 bytes, arrives': scene => {
    scene.channel.receive(new Uint8Array([9]).buffer)
    scene.channel.receive('x'.repeat(65_537))
  },
  'a check arrives': scene => scene.channel.receiveOwn(own.check),
  'a check arrives while the browser slows the timers of the page': scene => scene.channel.receiveOwn(own.check),
  'the answer to a check arrives': scene => scene.channel.receiveOwn(own.answer),
  'the module handler of the open or closed notice throws': async scene => {
    if (scene.connection.state === 'open') {
      scene.arrive(() => scene.channel.receive('after'))
    }
  }
}

const expectOutcome = (scene: PeerScene, outcome: Outcome, extra: PeerNotice[] = []): void => {
  assert.equal(scene.connection.state, outcome.state)
  const told = scene.noticesSince.filter(notice => !extra.some(own => own.kind === notice.kind && own.value === notice.value))
  const expected: PeerNotice[] =
    outcome.told === 'nothing'
      ? []
      : outcome.told === 'incoming, with the peer ID of the caller'
        ? [{kind: 'incoming', value: 'other-peer'}]
        : outcome.told === 'open, with the path and the round-trip time'
          ? [{kind: 'open', value: ['direct', 42]}]
          : [scene.closedNotice(outcome.told.slice('closed: '.length, outcome.told.indexOf(',')))]
  assert.deepEqual(told, expected)
  switch (outcome.does) {
    case 'asks for TURN credentials':
      assert.equal(scene.socketSince.at(-1)?.t, 'turn')
      return
    case 'goes on with TURN':
      assert.deepEqual(scene.rtc.iceServers, [turnServers])
      assert.equal(scene.h.socket.last('call')?.to, 'other-peer')
      return
    case 'goes on without TURN':
      assert.deepEqual(scene.rtc.iceServers, [])
      assert.equal(scene.h.socket.last('call')?.to, 'other-peer')
      return
    case 'sends ready':
      assert.deepEqual(scene.channelSince, ['ready'])
      return
    case 'drops it':
      assert.deepEqual(scene.channelSince, [])
      assert.deepEqual(
        scene.socketSince.filter(message => message.t !== 'answer'),
        []
      )
      assert.equal(scene.h.rtcs.length, scene.rtcMark)
  }
}

const turnAnswers: readonly Event[] = ['TURN credentials arrive', 'an empty answer about TURN credentials arrives']

for (const [state, cells] of Object.entries(table) as [State, Table[State]][]) {
  for (const [event, cell] of Object.entries(cells) as [Event, Table[State][Event]][]) {
    if (!('outcome' in cell)) {
      continue
    }
    test(`${cell.ids.join(' ')} ${state}: ${event}`, async () => {
      const scene = new PeerScene()
      const run = events[event]
      assert.ok(run, `no scenario for ${event}`)
      if (event === 'a text arrives, and the module has no handler of texts') {
        scene.textHandler = false
      }
      const throwsNotice = event === 'the module handler of the open or closed notice throws'
      if (throwsNotice) {
        scene.throwing.add(state === 'open' ? 'open' : 'closed')
      }
      if ((state === 'connecting' || state === 'closed') && turnAnswers.includes(event)) {
        scene.connect()
        if (state === 'closed') {
          scene.connection.close()
        }
        scene.mark()
      } else if (state === 'channel' && event === 'the browser fails to send') {
        await scene.withRtc()
        await scene.remoteAnswer()
        scene.mark()
      } else if (state === 'closed' && throwsNotice) {
        await scene.toOpen()
        scene.channel.receiveOwn(own.closing, 'closed')
        scene.channel.finishClosing()
        scene.mark()
      } else {
        await scene.enter(state)
      }
      await run(scene)
      const extra: PeerNotice[] = []
      if (throwsNotice && state === 'open') {
        extra.push({kind: 'text', value: 'after'})
        assert.deepEqual(scene.noticesSince, extra)
      }
      if (throwsNotice && state === 'closed') {
        assert.equal(scene.rtc.closed, true)
      }
      expectOutcome(scene, cell.outcome, extra)
    })
  }
}

const startEvents: {readonly [E in StartEvent]: (scene: PeerScene) => void} = {
  'a module connects over an open signaling connection': scene => scene.connect(),
  'a module connects over a signaling connection that is not open': scene => {
    scene.signaling.close()
    scene.mark()
    scene.connect()
  },
  'a call arrives, and a module has set the handler of incoming peer connections': scene => scene.call(),
  'a call arrives, and no module has set the handler of incoming peer connections': scene => scene.call(15_000, false),
  'a call arrives, and the handler of incoming peer connections throws': scene => scene.call(15_000, true, true)
}

for (const [event, cell] of Object.entries(start) as [StartEvent, (typeof start)[StartEvent]][]) {
  if (!('outcome' in cell)) {
    continue
  }
  test(`${cell.ids.join(' ')} start: ${event}`, async () => {
    const scene = new PeerScene()
    scene.mark()
    startEvents[event](scene)
    await settle()
    const outcome = cell.outcome
    if (scene.peer === null) {
      assert.equal(outcome.state, 'closed')
      const closing = scene.socketSince.find(message => message.t === 'close')
      assert.deepEqual(closing, {t: 'close', pc: scene.incomingPc, reason: 'closed'})
      assert.equal(outcome.told, 'nothing')
      assert.deepEqual(
        scene.noticesSince.filter(notice => notice.kind !== 'incoming'),
        []
      )
      return
    }
    expectOutcome(scene, outcome)
  })
}

test(`${secondIncomingHandler.ids.join(' ')} ${secondIncomingHandler.event}`, () => {
  const scene = new PeerScene()
  assert.equal(
    scene.signaling.setIncoming(() => {}),
    true
  )
  assert.equal(
    scene.signaling.setIncoming(() => {}),
    false
  )
})

test('3-11 3-14 in any order of events, the module is told at most once of opening and of closing, texts only between them', async () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const random = seeded(seed)
    const scene = new PeerScene()
    await scene.withRtc()
    const steps: (() => void | Promise<void>)[] = [
      () => scene.remoteAnswer(),
      () => scene.channel.open(),
      () => scene.channel.receiveOwn(own.ready),
      () => scene.channel.receiveOwn(own.check),
      () => scene.channel.receiveOwn(own.closing, 'too small'),
      () => scene.channel.receive('text'),
      () => scene.channel.finishClosing(),
      () => scene.rtc.report(pick(random, ['failed', 'closed', 'disconnected'])),
      () => scene.h.socket.drop(),
      () => scene.fromOther({t: pick(random, ['gone', 'failed', 'close'])}),
      () => scene.fromOther({t: 'reject', reason: 'busy'}),
      () => scene.connection.close(),
      () => void scene.connection.send('mine'),
      () => scene.h.clock.advance(Math.floor(random() * 10_000)),
      () => scene.h.clock.sleep(Math.floor(random() * 10_000))
    ]
    let closedSeen = false
    for (let step = 0; step < 20; step += 1) {
      await pick(random, steps)()
      await settle()
      closedSeen ||= scene.connection.state === 'closed'
      assert.equal(scene.connection.state === 'closed', closedSeen, `seed ${seed}`)
    }
    const kinds = scene.notices.map(notice => notice.kind)
    assert.ok(kinds.filter(kind => kind === 'open').length <= 1, `seed ${seed}`)
    assert.ok(kinds.filter(kind => kind === 'closed').length <= 1, `seed ${seed}`)
    assert.ok(!kinds.includes('closed') || kinds.at(-1) === 'closed', `seed ${seed}`)
    const firstText = kinds.indexOf('text')
    assert.ok(firstText === -1 || kinds.indexOf('open') < firstText, `seed ${seed}`)
  }
})

test('3-1 each connect starts its own peer connection with a random identifier, and closing one touches no other', async () => {
  const scene = new PeerScene()
  const first = scene.signaling.connect('other-peer')
  const second = scene.signaling.connect('other-peer')
  scene.h.socket.sent.filter(message => message.t === 'turn').forEach(request => scene.h.socket.receive({t: 'turn', r: request.r, s: null}))
  await settle()
  const calls = scene.h.socket.sent.filter(message => message.t === 'call')
  assert.equal(calls.length, 2)
  assert.notEqual(calls[0]?.pc, calls[1]?.pc)
  assert.match(String(calls[0]?.pc), /^[A-Za-z0-9_-]{22}$/)
  scene.h.socket.receive({t: 'reject', pc: calls[0]?.pc, from: 'other-peer', reason: 'busy'})
  assert.equal(first.state, 'closed')
  assert.equal(second.state, 'connecting')
})

test('3-4 each attempt asks for TURN credentials of its own and uses them only for itself', async () => {
  const scene = new PeerScene()
  scene.signaling.connect('other-peer')
  scene.signaling.connect('other-peer')
  const requests = scene.h.socket.sent.filter(message => message.t === 'turn')
  assert.equal(requests.length, 2)
  const second = {...turnServers, username: '2:def'}
  scene.h.socket.receive({t: 'turn', r: requests[0]?.r, s: turnServers})
  scene.h.socket.receive({t: 'turn', r: requests[1]?.r, s: second})
  await settle()
  assert.deepEqual(
    scene.h.rtcs.map(rtc => rtc.iceServers),
    [[turnServers], [second]]
  )
})

test('3-5 the caller closes 15 seconds after it connected, while it waits for TURN credentials too', () => {
  const scene = new PeerScene()
  scene.connect()
  scene.h.clock.advance(14_999)
  assert.equal(scene.connection.state, 'connecting')
  scene.h.clock.advance(1)
  assert.deepEqual(scene.notices, [scene.closedNotice('timeout')])
})

test('3-5 the called side counts its deadline from the call plus the time that came with it', async () => {
  const scene = new PeerScene()
  scene.call(4_000)
  scene.h.clock.advance(3_999)
  assert.equal(scene.connection.state, 'connecting')
  scene.h.clock.advance(1)
  assert.equal(scene.connection.state, 'closed')
})

test('3-5 a side whose ready waits while it reads its path closes with timeout when its scripts resume after the deadline', async () => {
  const scene = new PeerScene()
  await scene.withRtc()
  await scene.remoteAnswer()
  scene.h.steps.hold('getStats')
  scene.channel.open()
  await settle()
  scene.arrive(() => scene.channel.receiveOwn(own.ready))
  scene.mark()
  scene.h.clock.sleep(15_000)
  scene.h.steps.release()
  await settle()
  assert.equal(scene.connection.state, 'closed')
  assert.deepEqual(scene.noticesSince, [scene.closedNotice('timeout')])
})

test('3-5 a side whose scripts resume after the deadline while its browser sets a description or candidate closes with timeout', async () => {
  const cases: [string, (scene: PeerScene) => Promise<number>][] = [
    [
      'the called side sets the description of the caller',
      async scene => {
        scene.h.steps.hold('setRemoteDescription')
        scene.call(4_000)
        scene.answerTurn()
        await settle()
        return 4_000
      }
    ],
    [
      'the called side creates its answer',
      async scene => {
        scene.h.steps.hold('createAnswer')
        scene.call(4_000)
        scene.answerTurn()
        await settle()
        return 4_000
      }
    ],
    [
      'the caller sets the answer',
      async scene => {
        await scene.withRtc()
        scene.h.steps.hold('setRemoteDescription')
        await scene.remoteAnswer()
        return 15_000
      }
    ],
    [
      'the caller adds a candidate that its browser rejects',
      async scene => {
        await scene.withRtc()
        await scene.remoteAnswer()
        scene.rtc.rejectCandidates = true
        scene.h.steps.hold('addIceCandidate')
        scene.fromOther({t: 'signal', c: [hostCandidate]})
        await settle()
        return 15_000
      }
    ]
  ]
  for (const [name, prepare] of cases) {
    const scene = new PeerScene()
    const deadline = await prepare(scene)
    scene.mark()
    scene.h.clock.sleep(deadline)
    scene.h.steps.release()
    await settle()
    assert.deepEqual(scene.socketSince, [{t: 'close', pc: scene.pc, reason: 'timeout'}], name)
    assert.deepEqual(scene.noticesSince, [scene.closedNotice('timeout')], name)
  }
})

test('3-5 3-8 when the scripts resume after both the deadline and the silence of the signaling connection, the earlier one decides', async () => {
  for (const [connectAfter, reason] of [
    [20_000, 'timeout'],
    [40_000, 'offline']
  ] as const) {
    const scene = new PeerScene()
    scene.h.clock.advance(connectAfter)
    scene.connect()
    scene.h.clock.sleep(30_000)
    scene.h.clock.advance(0)
    assert.deepEqual(scene.notices, [scene.closedNotice(reason)], reason)
  }
})

test('3-6 a browser that reports no limit counts as large enough, and a limit of exactly 65,536 bytes is enough', async () => {
  for (const sctp of [null, {maxMessageSize: 65_536}]) {
    const scene = new PeerScene()
    await scene.withRtc()
    await scene.remoteAnswer()
    scene.rtc.sctp = sctp
    scene.channel.open()
    assert.equal(scene.connection.state, 'channel')
  }
})

test('3-7 a side opens on the ready of the other side, also when its own ready went first', async () => {
  const scene = new PeerScene()
  await scene.toChannel()
  assert.deepEqual(
    scene.channel.sent.map(data => (typeof data === 'string' ? data : data[0])),
    [own.ready]
  )
  scene.channel.receiveOwn(own.ready)
  assert.equal(scene.connection.state, 'open')
})

test('3-9 the reason is no relay only while the side is connecting, has no relay candidate and the other description arrived', async () => {
  const cases: [string, (scene: PeerScene) => Promise<void>, string][] = [
    ['without the other description', async () => {}, 'timeout'],
    [
      'with a relay candidate',
      async scene => {
        await scene.remoteAnswer()
        scene.rtc.gather({candidate: 'candidate:2 1 udp 1 203.0.113.1 3478 typ relay', type: 'relay', sdpMid: '0', sdpMLineIndex: 0})
      },
      'timeout'
    ],
    ['with all conditions', async scene => scene.remoteAnswer(), 'no relay']
  ]
  for (const [name, prepare, reason] of cases) {
    const scene = new PeerScene()
    await scene.withRtc()
    scene.rtc.onicecandidateerror?.({errorCode: 508})
    await prepare(scene)
    scene.rtc.report('failed')
    assert.deepEqual(scene.notices.at(-1), scene.closedNotice(reason), name)
  }
})

test('3-9 an error of coturn other than 486 or 508 does not make the reason no relay', async () => {
  const scene = new PeerScene()
  await scene.withRtc()
  scene.rtc.onicecandidateerror?.({errorCode: 701})
  await scene.remoteAnswer()
  scene.rtc.report('failed')
  assert.deepEqual(scene.notices.at(-1), scene.closedNotice('timeout'))
})

test('3-12 when the page unloads, it closes every peer connection without telling the module', async () => {
  const scene = new PeerScene()
  await scene.toOpen()
  const other = scene.signaling.connect('third-peer', scene.handlers())
  const opens = scene.notices.length
  scene.h.hide()
  assert.equal(scene.connection.state, 'closed')
  assert.equal(other.state, 'closed')
  assert.equal(scene.notices.length, opens)
})

test('3-14 the module is told once that its side opened and once that it closed', async () => {
  const scene = new PeerScene()
  await scene.toOpen()
  scene.channel.receiveOwn(own.ready)
  scene.channel.receiveOwn(own.closing, 'closed')
  scene.channel.receiveOwn(own.closing, 'closed')
  scene.rtc.report('failed')
  assert.deepEqual(
    scene.notices.map(notice => notice.kind),
    ['open', 'closed']
  )
})

test('3-15 the closing notice gives the moment the last message arrived on the channel, the transport own included', async () => {
  const scene = new PeerScene()
  await scene.toOpen()
  scene.h.clock.advance(3_000)
  scene.channel.receiveOwn(own.answer)
  const answerAt = scene.h.clock.now()
  scene.h.clock.advance(15_000)
  assert.deepEqual(scene.notices.at(-1), {kind: 'closed', value: {reason: 'broken', lastArrivalAt: answerAt}})
})
