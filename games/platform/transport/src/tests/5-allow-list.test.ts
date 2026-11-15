import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {SignalingConnection} from '../api.ts'
import {table} from './5-allow-list.states.ts'
import {PageHarness} from './fake-page.ts'
import {Bridge, ServerHarness} from './fake-server.ts'

type Table = typeof table
type State = keyof Table
type Event = keyof Table[State]
type Outcome = Extract<Table[State][Event], {readonly outcome: unknown}>['outcome']

const offer = {type: 'offer', sdp: 'v=0 offer'}

class Scene {
  readonly server = new ServerHarness()
  readonly page = new PageHarness()
  readonly bridge = new Bridge(this.server, this.page)
  readonly connection: SignalingConnection
  readonly listed: {readonly socket: ReturnType<ServerHarness['open']>['socket']; readonly peerId: string}
  change: Promise<boolean> | null = null
  calls = 0

  constructor(state: State) {
    this.listed = this.server.open()
    this.connection = this.page.transport.openSignaling(this.page.channels('alpha'))
    this.connection.setIncoming(() => {})
    this.bridge.flush()
    if (state === 'closed') {
      this.connection.close()
    }
  }

  async add(peerId: string): Promise<void> {
    this.change = this.connection.allow(peerId)
    this.bridge.flush()
    await this.change
  }

  async remove(peerId: string): Promise<void> {
    this.change = this.connection.disallow(peerId)
    this.bridge.flush()
    await this.change
  }

  admits(peerId: string, socket: ReturnType<ServerHarness['open']>['socket']): boolean {
    const pc = `probe-${this.calls++}`
    socket.receive({t: 'call', pc, to: this.connection.peerId, ms: 15_000, d: offer})
    const rejected = socket.sent.some(message => message.t === 'reject' && message.pc === pc)
    socket.receive({t: 'close', pc, reason: 'closed'})
    return !rejected && peerId.length > 0
  }

  async fill(count: number): Promise<{socket: ReturnType<ServerHarness['open']>['socket']; peerId: string}[]> {
    const pages = Array.from({length: count}, () => this.server.open())
    for (const other of pages) {
      await this.add(other.peerId)
    }
    return pages
  }
}

const events: {readonly [E in Event]: (scene: Scene) => Promise<void>} = {
  'a peer ID is added that the list lacks, while the list has fewer than 64 and an open signaling connection has that peer ID': scene =>
    scene.add(scene.listed.peerId),
  'a peer ID is added that the list lacks, while the list has 64': async scene => {
    await scene.fill(64)
    await scene.add(scene.listed.peerId)
  },
  'a peer ID is added that the list lacks and no open signaling connection has': scene => scene.add('nobody-has-this-peer-id'),
  'a peer ID is added that the list has': async scene => {
    await scene.add(scene.listed.peerId)
    await scene.add(scene.listed.peerId)
  },
  'a peer ID is removed that the list has': async scene => {
    await scene.add(scene.listed.peerId)
    await scene.remove(scene.listed.peerId)
  },
  'a peer ID is removed that the list lacks': scene => scene.remove(scene.listed.peerId),
  'the signaling connection of a peer ID on the list closes': async scene => {
    const [first] = await scene.fill(64)
    first?.socket.drop()
    scene.change = null
    await scene.add(scene.listed.peerId)
  },
  'the signaling connection closes while a change that the page made awaits its answer': async scene => {
    await scene.add(scene.listed.peerId)
    scene.change = scene.connection.allow('other-peer-id-waiting-x')
    scene.page.socket.drop()
    scene.bridge.serverSocket().drop()
    await scene.change
  }
}

const expectOutcome = async (scene: Scene, event: Event, outcome: Outcome): Promise<void> => {
  assert.equal(scene.connection.state, outcome.state)
  const applied = scene.change === null ? null : await scene.change
  if (outcome.change === 'applies') {
    assert.equal(applied, true)
  } else if (outcome.change === 'fails' && event !== 'the signaling connection of a peer ID on the list closes') {
    assert.equal(applied, false)
  }
  if (scene.connection.state !== 'open') {
    return
  }
  const admitted = scene.admits(scene.listed.peerId, scene.listed.socket)
  switch (outcome.list) {
    case 'gains the peer ID':
      assert.equal(admitted, true)
      return
    case 'loses the peer ID':
      if (event === 'the signaling connection of a peer ID on the list closes') {
        assert.equal(applied, true)
      } else {
        assert.equal(admitted, false)
      }
      return
    case 'stays as it was':
      assert.equal(admitted, event === 'a peer ID is added that the list has')
  }
}

for (const [state, cells] of Object.entries(table) as [State, Table[State]][]) {
  for (const [event, cell] of Object.entries(cells) as [Event, Table[State][Event]][]) {
    if (!('outcome' in cell)) {
      continue
    }
    test(`${cell.ids.join(' ')} ${state}: ${event}`, async () => {
      const scene = new Scene(state)
      if (state === 'opening') {
        const fresh = scene.page.transport.openSignaling(scene.page.channels('alpha'))
        const change = event.startsWith('a peer ID is removed') ? fresh.disallow(scene.listed.peerId) : fresh.allow(scene.listed.peerId)
        assert.equal(fresh.state, 'opening')
        assert.equal(await change, false)
        return
      }
      await events[event](scene)
      await expectOutcome(scene, event, cell.outcome)
    })
  }
}

test('5-1 a server part changes the list and learns whether the change applied', () => {
  const server = new ServerHarness()
  const owner = server.open()
  const caller = server.open()
  assert.equal(server.port().allow(owner.peerId, caller.peerId), true)
  caller.socket.receive({t: 'call', pc: 'call-one', to: owner.peerId, ms: 15_000, d: offer})
  assert.equal(owner.socket.last('call')?.pc, 'call-one')
  assert.equal(server.port().disallow(owner.peerId, caller.peerId), true)
  assert.equal(server.port().allow('nobody-has-this-peer-id', caller.peerId), false)
})

test('5-1 a change applies before any later message from the same page', async () => {
  const scene = new Scene('open')
  const change = scene.connection.allow(scene.listed.peerId)
  scene.bridge.flush()
  scene.listed.socket.receive({t: 'call', pc: 'right-after', to: scene.connection.peerId, ms: 15_000, d: offer})
  assert.equal(await change, true)
  assert.equal(
    scene.listed.socket.sent.some(message => message.t === 'reject'),
    false
  )
})

test('5-1 a change touches no attempt under way', async () => {
  const scene = new Scene('open')
  await scene.add(scene.listed.peerId)
  scene.listed.socket.receive({t: 'call', pc: 'under-way', to: scene.connection.peerId, ms: 15_000, d: offer})
  await scene.remove(scene.listed.peerId)
  scene.listed.socket.receive({t: 'signal', pc: 'under-way', c: []})
  assert.equal(scene.bridge.serverSocket().last('signal')?.pc, 'under-way')
})

test('5-2 a list of 63 peer IDs takes one more', async () => {
  const scene = new Scene('open')
  await scene.fill(63)
  await scene.add(scene.listed.peerId)
  assert.equal(await scene.change, true)
})
