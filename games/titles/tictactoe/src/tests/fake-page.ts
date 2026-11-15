import type {ActProblem, GameHandlers, Json, Netcode, Phase, Snapshot, SnapshotView} from '@whenparty/netcode'
import {TicTacToePage, type View} from '../page.ts'
import {newGame, type Game} from '../tictactoe.ts'

const codeLetters = /^[23456789BCDFGHJKMNPQRSTVWXYZ]{5}$/

export class FakeNetcode implements Netcode {
  phase: Phase = 'none'
  readonly calls: string[] = []
  tookSnapshot = false

  parseCode(text: string): string | null {
    const code = text.replace(/[\s-]/gu, '').replace(/[a-z]/g, letter => letter.toUpperCase())
    return codeLetters.test(code) ? code : null
  }

  start(): void {
    this.calls.push('start a game')
    this.tookSnapshot = false
  }

  enter(code: string): void {
    this.calls.push(`enter ${code}`)
    this.tookSnapshot = false
  }

  leave(): void {
    this.calls.push('leave')
  }

  startMatch(): void {
    this.calls.push('start a match')
  }

  act(action: Json): ActProblem | null {
    this.calls.push(`act ${JSON.stringify(action)}`)
    return null
  }

  roomTime(): number | null {
    return null
  }
}

export interface PageHarness {
  readonly page: TicTacToePage
  readonly netcode: FakeNetcode
  readonly views: View[]
  readonly addresses: (string | null)[]
  readonly copies: string[]
  hash: string
  readonly on: Required<GameHandlers>
  readonly view: View
  readonly tookSnapshot: boolean
  copyEnds(succeeded: boolean): Promise<void>
  advance(ms: number): void
  sleep(ms: number): void
}

interface Timer {
  readonly due: number
  readonly then: () => void
}

export const pageHarness = (hash = ''): PageHarness => {
  const netcode = new FakeNetcode()
  const views: View[] = []
  const addresses: (string | null)[] = []
  const copies: string[] = []
  const pendingCopies: {resolve(): void; reject(error: Error): void}[] = []
  const timers = new Set<Timer>()
  let now = 0
  let handlers: GameHandlers = {}
  const harness = {
    netcode,
    views,
    addresses,
    copies,
    hash,
    async copyEnds(succeeded: boolean) {
      const copy = pendingCopies.shift()
      if (copy === undefined) {
        throw new Error('no copy is pending')
      }
      if (succeeded) {
        copy.resolve()
      } else {
        copy.reject(new Error('refused'))
      }
      await new Promise(resolve => setImmediate(resolve))
    },
    advance(ms: number) {
      const until = now + ms
      for (;;) {
        const [next] = [...timers].filter(timer => timer.due <= until).sort((a, b) => a.due - b.due)
        if (next === undefined) {
          break
        }
        timers.delete(next)
        now = next.due
        next.then()
      }
      now = until
    },
    sleep(ms: number) {
      now += ms
    },
    get on() {
      const snapshot = (view: SnapshotView): unknown => {
        netcode.tookSnapshot = true
        return handlers.snapshot?.(view)
      }
      return {...handlers, snapshot} as Required<GameHandlers>
    },
    get tookSnapshot() {
      return netcode.tookSnapshot
    },
    get view() {
      const view = views.at(-1)
      if (view === undefined) {
        throw new Error('nothing rendered')
      }
      return view
    }
  } as PageHarness
  const page = new TicTacToePage({
    createNetcode: given => {
      handlers = given
      return netcode
    },
    hash: () => harness.hash,
    replaceAddress: code => addresses.push(code),
    inviteLink: () => `https://games.when.party/tictactoe/#${addresses.at(-1) ?? ''}`,
    copy: text => {
      copies.push(text)
      return new Promise<void>((resolve, reject) => pendingCopies.push({resolve: () => resolve(), reject}))
    },
    after: (ms, then) => {
      const timer = {due: now + ms, then}
      timers.add(timer)
      return () => timers.delete(timer)
    },
    render: view => views.push(view)
  })
  Object.assign(harness, {page})
  return harness
}

export interface Played {
  readonly game?: Game | null
  readonly running?: boolean
  readonly match?: number
  readonly seats?: readonly (number | null)[]
  readonly number?: number
  readonly participant?: number
  readonly isHost?: boolean
}

export const view = ({
  game = newGame(),
  running = true,
  match = 1,
  seats = [1, 2],
  number = 1,
  participant = 1,
  isHost = true
}: Played = {}): SnapshotView => {
  const snapshot: Snapshot = {
    versions: [1, 1],
    state: game as unknown as Json,
    running,
    match: {term: 1, number: match},
    seats,
    queue: [],
    accepted: [],
    roomTime: 0,
    term: 1,
    number
  }
  const index = seats.indexOf(participant)
  return {snapshot, participant, seat: index < 0 ? null : (['X', 'O'][index] ?? null), isHost}
}
