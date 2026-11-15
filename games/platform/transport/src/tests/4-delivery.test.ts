import assert from 'node:assert/strict'
import {test} from 'node:test'
import {table} from './4-delivery.states.ts'
import {own, settle} from './fake-page.ts'
import {PeerScene} from './peer-scene.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']

const enter = async (scene: PeerScene, state: State): Promise<void> => {
  if (state === 'closed, closing the channel') {
    await scene.toOpen()
    scene.connection.close()
    scene.mark()
    return
  }
  await scene.enter(state)
}

const silentlyOpenChannel = (scene: PeerScene): void => {
  if (scene.connection.state === 'connecting') {
    scene.channel.readyState = 'open'
  }
}

const events: {readonly [E in Event]: ((scene: PeerScene) => void | Promise<void>) | null} = {
  'the module sends a text': scene => void (scene.result = scene.connection.send('hello')),
  'the module sends a value that is not a text': scene => void (scene.result = scene.connection.send('\ud800')),
  'a text arrives, and the module has a handler of texts': scene => scene.arrive(() => scene.channel.receive('hi')),
  'a text arrives, and the module has no handler of texts': scene => {
    scene.connection.handlers = {...scene.connection.handlers, text: undefined}
    scene.arrive(() => scene.channel.receive('hi'))
    scene.arrive(() => scene.channel.receiveOwn(own.check))
  },
  'the module handler of a text throws': scene => {
    scene.throwing.add('text')
    scene.arrive(() => scene.channel.receive('first'))
    scene.arrive(() => scene.channel.receive('second'))
  },
  'a message that is neither a text nor one of the transport own, or a text over 65,536 bytes, arrives': scene => {
    scene.arrive(() => scene.channel.receive(new Uint8Array([9, 9]).buffer))
    scene.arrive(() => scene.channel.receive('x'.repeat(65_537)))
  },
  'the chosen pair of candidates changes': async scene => {
    if (scene.h.rtcs.length > 0) {
      scene.rtc.pair = {local: 'relay', remote: 'host', roundTripSeconds: 0.1, id: 'second'}
    }
    scene.h.clock.advance(scene.connection.state === 'closed' ? 500 : 4_000)
    await settle()
  },
  'the module handler of the path notice throws': async scene => {
    scene.throwing.add('path')
    scene.rtc.pair = {local: 'relay', remote: 'host', roundTripSeconds: 0.1, id: 'second'}
    scene.h.clock.advance(4_000)
    await settle()
    scene.rtc.pair = {local: 'host', remote: 'host', roundTripSeconds: 0.01, id: 'third'}
    scene.h.clock.advance(4_000)
    await settle()
  },
  'the side closes, not on a closing message, with its own signaling connection open and its channel not open': scene =>
    scene.connection.close(),
  'the side closes, not on a closing message, with its own signaling connection open and its channel open': scene => {
    silentlyOpenChannel(scene)
    scene.connection.close()
  },
  'the side closes, not on a closing message, with its own signaling connection not open and its channel not open': scene =>
    scene.h.socket.drop(),
  'the side closes, not on a closing message, with its own signaling connection not open and its channel open': scene => {
    silentlyOpenChannel(scene)
    const connecting = scene.connection.state === 'connecting'
    scene.h.socket.drop()
    if (!connecting) {
      scene.connection.close()
    }
  },
  'a closing message arrives': scene => {
    if (scene.connection.state === 'connecting') {
      scene.fromOther({t: 'close', reason: 'closed'})
    } else {
      scene.channel.receiveOwn(own.closing, 'closed')
    }
  },
  'a closing message with too small arrives': scene => {
    if (scene.connection.state === 'connecting') {
      scene.fromOther({t: 'close', reason: 'too small'})
    } else {
      scene.channel.receiveOwn(own.closing, 'too small')
    }
  },
  'its channel closes, or 1 second passes, after the side closed': scene => scene.channel.finishClosing(),
  'a check arrives': scene => scene.arrive(() => scene.channel.receiveOwn(own.check)),
  'a check arrives while the browser slows the timers of the page': scene => scene.arrive(() => scene.channel.receiveOwn(own.check)),
  'the answer to a check arrives': scene => scene.arrive(() => scene.channel.receiveOwn(own.answer)),
  'the ready of the other side arrives': scene => scene.arrive(() => scene.channel.receiveOwn(own.ready)),
  '15 seconds pass with nothing arriving': scene => scene.h.clock.advance(15_000),
  'the scripts resume after 15 seconds with nothing handled, with checks waiting': scene => {
    scene.h.clock.sleep(15_000)
    scene.channel.receiveOwn(own.check)
  },
  '5 seconds pass since the side last sent a check': scene => scene.h.clock.advance(5_000),
  'the browser reports that the connection failed or closed, while the side has no relay candidate, coturn had no free allocation for it and the other description has arrived':
    scene => {
      scene.rtc.onicecandidateerror?.({errorCode: 486})
      scene.rtc.report('failed')
    },
  'the browser reports that the connection failed or closed, in any other case': scene => scene.rtc.report('failed'),
  'the channel closes without a closing message': scene => scene.channel.finishClosing(),
  'the browser fails to send': scene => {
    scene.channel.failSend = true
    scene.result = scene.connection.send('hello')
  },
  'the browser reports that the connection is disconnected': scene => scene.rtc.report('disconnected')
}

const closingSends = {
  'a closing message through the server': {server: true, channel: false},
  'a closing message through the server and on the channel': {server: true, channel: true},
  'a closing message on the channel': {server: false, channel: true}
} as const

const expectOutcome = (scene: PeerScene, event: Event, outcome: Outcome): void => {
  const channel = scene.h.rtcs.length > 0 ? scene.channel : null
  const rtcClosed = scene.h.rtcs.length === 0 || scene.rtc.closed
  if (outcome.state === 'closed, closing the channel') {
    assert.equal(scene.connection.state, 'closed')
    assert.equal(channel?.readyState, 'closing')
    assert.equal(rtcClosed, false)
  } else {
    assert.equal(scene.connection.state, outcome.state)
    if (outcome.state === 'closed') {
      assert.equal(rtcClosed, true)
    }
  }
  const closedNotices = scene.noticesSince.filter(notice => notice.kind === 'closed')
  if (outcome.reason === 'closed' || outcome.reason === 'too small' || outcome.reason === 'broken') {
    assert.deepEqual(
      closedNotices.map(notice => (notice.value as {reason: string}).reason),
      [outcome.reason]
    )
  }
  const told = scene.noticesSince.filter(notice => notice.kind === 'text' || notice.kind === 'path')
  if (outcome.told === 'nothing') {
    if (outcome.then !== 'counts it as delivered and goes on' && outcome.then !== 'goes on') {
      assert.deepEqual(told, [])
    }
  } else if (outcome.told === 'the text') {
    assert.deepEqual(told, [{kind: 'text', value: 'hi'}])
  } else {
    assert.deepEqual(told, [{kind: 'path', value: ['turn', 100]}])
  }
  const sentOnChannel = scene.channelSince.filter(sent => sent !== 'check' || outcome.sends === 'a check')
  const closingThroughServer = scene.socketSince.filter(message => message.t === 'close')
  switch (outcome.sends) {
    case 'nothing':
      assert.deepEqual(
        sentOnChannel.filter(sent => sent !== 'answer' || event !== 'a text arrives, and the module has no handler of texts'),
        []
      )
      assert.deepEqual(closingThroughServer, [])
      break
    case 'the text':
      assert.deepEqual(sentOnChannel, ['text:hello'])
      break
    case 'a check':
      assert.deepEqual(sentOnChannel, ['check'])
      break
    case 'the answer to the check at once':
      assert.deepEqual(sentOnChannel, ['answer'])
      break
    default: {
      const expected = closingSends[outcome.sends]
      const reason = expected.server ? String(closingThroughServer[0]?.reason) : (sentOnChannel.at(-1)?.slice('closing:'.length) ?? '')
      assert.equal(closingThroughServer.length, expected.server ? 1 : 0)
      assert.equal(
        sentOnChannel.some(sent => sent.startsWith('closing:')),
        expected.channel
      )
      if (expected.channel) {
        assert.equal(sentOnChannel.at(-1), `closing:${reason}`)
      }
      if (outcome.reason === 'its own') {
        const notice = closedNotices[0]?.value as {reason: string} | undefined
        assert.equal(reason, notice?.reason ?? 'closed')
      } else {
        assert.equal(reason, outcome.reason)
      }
    }
  }
  switch (outcome.then) {
    case 'sending fails':
      assert.equal(scene.result, false)
      break
    case 'drops it':
      assert.deepEqual(told, [])
      break
    case 'counts it as delivered and goes on':
      if (event === 'the module handler of a text throws') {
        assert.deepEqual(told, [
          {kind: 'text', value: 'first'},
          {kind: 'text', value: 'second'}
        ])
      } else {
        assert.deepEqual(scene.channelSince, ['answer'])
      }
      break
    case 'goes on':
      assert.deepEqual(told, [
        {kind: 'path', value: ['turn', 100]},
        {kind: 'path', value: ['direct', 10]}
      ])
      break
    case 'closes the browser connection at once':
    case 'closes the browser connection':
      assert.equal(rtcClosed, true)
      break
    case 'closes the channel, then the browser connection when the channel has closed or 1 second has passed':
      scene.h.clock.advance(999)
      assert.equal(scene.rtc.closed, false)
      scene.h.clock.advance(1)
      assert.equal(scene.rtc.closed, true)
  }
}

for (const [state, cells] of Object.entries(table) as [State, Table[State]][]) {
  for (const [event, cell] of Object.entries(cells) as [Event, Table[State][Event]][]) {
    if (!('outcome' in cell)) {
      continue
    }
    test(`${cell.ids.join(' ')} ${state}: ${event}`, async () => {
      const scene = new PeerScene()
      const run = events[event]
      assert.ok(run, `no scenario for ${event}`)
      await enter(scene, state)
      await run(scene)
      expectOutcome(scene, event, cell.outcome)
    })
  }
}

test('4-1 a text of 65,536 bytes is sent, and one of 65,537 bytes or with a lone surrogate fails', async () => {
  const scene = new PeerScene()
  await scene.toOpen()
  assert.equal(scene.connection.send('x'.repeat(65_536)), true)
  assert.equal(scene.connection.send('€'.repeat(21_845) + 'x'), true)
  assert.equal(scene.connection.send('x'.repeat(65_537)), false)
  assert.equal(scene.connection.send('€'.repeat(21_846)), false)
  assert.equal(scene.connection.send('a\udc00'), false)
  assert.equal(scene.connection.send(42), false)
})

test('4-3 checks, ready and closing messages share the queue of the texts and leave a text its 65,536 bytes', async () => {
  const scene = new PeerScene()
  await scene.withRtc()
  await scene.remoteAnswer()
  scene.rtc.sctp = {maxMessageSize: 65_536}
  scene.channel.open()
  await settle()
  scene.channel.receiveOwn(own.ready)
  const largest = 'z'.repeat(65_536)
  assert.equal(scene.connection.send(largest), true)
  scene.h.clock.advance(5_000)
  scene.connection.close()
  assert.deepEqual(
    scene.channel.sent.map(data => (data === largest ? 'largest' : (data as Uint8Array)[0])),
    [own.ready, 'largest', own.check, own.closing]
  )
})

test('4-2 texts arrive at the module once and in the order sent, and a text of 65,536 bytes arrives', async () => {
  const scene = new PeerScene()
  await scene.toOpen()
  const largest = 'y'.repeat(65_536)
  for (const text of ['one', 'two', largest, 'three']) {
    scene.channel.receive(text)
  }
  assert.deepEqual(
    scene.notices.filter(notice => notice.kind === 'text').map(notice => notice.value),
    ['one', 'two', largest, 'three']
  )
})

test('4-6 the module is told the path through the TURN server and an unknown round-trip time', async () => {
  const scene = new PeerScene()
  await scene.withRtc()
  await scene.remoteAnswer()
  scene.rtc.pair = {local: 'host', remote: 'relay'}
  scene.channel.open()
  await settle()
  scene.channel.receiveOwn(own.ready)
  assert.deepEqual(scene.notices, [{kind: 'open', value: ['turn', null]}])
})

test('4-6 a change of the chosen pair is noticed within 5 seconds, and an unchanged pair tells nothing', async () => {
  const scene = new PeerScene()
  await scene.toOpen()
  scene.h.clock.advance(4_000)
  await settle()
  assert.equal(scene.notices.length, 1)
  scene.rtc.pair = {local: 'srflx', remote: 'host', roundTripSeconds: 0.2, id: 'mobile'}
  scene.channel.receiveOwn(own.answer)
  scene.h.clock.advance(4_000)
  await settle()
  assert.deepEqual(scene.notices.at(-1), {kind: 'path', value: ['direct', 200]})
})

test('4-6 a reading that fails or finds no chosen pair is no change of the path', async () => {
  const cases: [string, (scene: PeerScene) => void][] = [
    ['the reading fails', scene => void (scene.rtc.failStats = true)],
    ['no pair is chosen', scene => void (scene.rtc.pair = null)]
  ]
  for (const [name, unread] of cases) {
    const scene = new PeerScene()
    await scene.toOpen()
    const pair = scene.rtc.pair
    unread(scene)
    scene.h.clock.advance(4_000)
    await settle()
    scene.rtc.failStats = false
    scene.rtc.pair = pair
    scene.h.clock.advance(4_000)
    await settle()
    assert.deepEqual(scene.notices, [{kind: 'open', value: ['direct', 42]}], name)
  }
})

test('4-6 4-8 a side whose scripts resume after 15 seconds of silence while it reads its path closes with broken and tells no path', async () => {
  const scene = new PeerScene()
  await scene.toOpen()
  scene.h.steps.hold('getStats')
  scene.h.clock.advance(4_000)
  scene.rtc.pair = {local: 'relay', remote: 'host', roundTripSeconds: 0.1, id: 'second'}
  scene.h.clock.sleep(11_000)
  scene.h.steps.release()
  await settle()
  assert.deepEqual(scene.notices.slice(1), [scene.closedNotice('broken')])
})

test('4-8 checks alone keep an open side open', async () => {
  const scene = new PeerScene()
  await scene.toOpen()
  for (let second = 0; second < 60; second += 5) {
    scene.h.clock.advance(5_000)
    scene.channel.receiveOwn(own.answer)
  }
  assert.equal(scene.connection.state, 'open')
  assert.equal(scene.channel.sent.filter(data => typeof data !== 'string' && data[0] === own.check).length, 12)
})

test('4-8 an open side closes with broken 15 seconds after the last arrival, not earlier', async () => {
  const scene = new PeerScene()
  await scene.toOpen()
  scene.h.clock.advance(7_000)
  scene.channel.receiveOwn(own.check)
  scene.h.clock.advance(14_999)
  assert.equal(scene.connection.state, 'open')
  scene.h.clock.advance(1)
  assert.equal(scene.connection.state, 'closed')
})

test('4-4 4-5 a side that closes before it is open with its signaling connection open sends its reason through the server', async () => {
  const scene = new PeerScene()
  await scene.withRtc()
  scene.h.clock.advance(15_000)
  assert.deepEqual(scene.h.socket.last('close'), {t: 'close', pc: scene.pc, reason: 'timeout'})
  assert.equal(scene.rtc.closed, true)
})

test('4-7 a side that gets a closing message sends none back', async () => {
  const scene = new PeerScene()
  await scene.toOpen()
  scene.mark()
  scene.channel.receiveOwn(own.closing, 'broken')
  assert.deepEqual(scene.channelSince, [])
  assert.deepEqual(scene.socketSince, [])
  assert.deepEqual(scene.notices.at(-1), scene.closedNotice('closed'))
})
