import {createNetcode, type End, type Failure, type GameHandlers, type Json, type Netcode, type SnapshotView, type Waiting} from '@whenparty/netcode'
import {browserEnvironment} from '@whenparty/netcode/browser'
import {seats, title, type Championship, type Move} from './core/index.ts'

export type Finish = {readonly kind: 'failed'; readonly failure: Failure} | {readonly kind: 'ended'; readonly end: End}

export type Phase = 'starting' | 'entering' | 'playing' | 'over'

// What the page knows of its game; null while it shows the start screen.
export interface Visit {
  readonly code: string | null
  readonly phase: Phase
  readonly waiting: Waiting | null
  readonly waitedForHost: boolean
  readonly hostAway: boolean
  readonly serverLost: boolean
  readonly rulesError: boolean
  readonly finish: Finish | null
  readonly game: Championship | null
  readonly seat: string | null
  readonly isHost: boolean
  readonly occupied: readonly string[]
  readonly matchNumber: number
  readonly canAct: boolean
}

export interface PageDeps {
  createNetcode(handlers: GameHandlers): Netcode
  hash(): string
  replaceAddress(code: string | null): void
  changed(visit: Visit | null): void
}

interface Kept {
  readonly move: Move
  readonly screen: string
}

const screenOf = (game: Championship) => `${game.stage}:${game.challenge}`

const decoded = (text: string): string => {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

const fresh = (code: string | null, phase: Phase): Visit => ({
  code,
  phase,
  waiting: null,
  waitedForHost: false,
  hostAway: false,
  serverLost: false,
  rulesError: false,
  finish: null,
  game: null,
  seat: null,
  isHost: false,
  occupied: [],
  matchNumber: 0,
  canAct: false
})

// The page's side of a game (6-page.md): entering and leaving, the address, join requests and kept actions.
export class Room {
  readonly #deps: PageDeps
  readonly #netcode: Netcode
  #visit: Visit | null = null
  #kept: Kept[] = []

  constructor(deps: PageDeps) {
    this.#deps = deps
    this.#netcode = deps.createNetcode(this.#handlers())
  }

  get visit(): Visit | null {
    return this.#visit
  }

  get kept(): readonly Move[] {
    return this.#kept.map(each => each.move)
  }

  #show(visit: Visit | null): void {
    this.#visit = visit
    this.#deps.changed(visit)
  }

  #update(change: Partial<Visit>): void {
    if (this.#visit !== null) {
      this.#show({...this.#visit, ...change})
    }
  }

  #handlers(): GameHandlers {
    return {
      code: code => {
        this.#update({code})
        this.#deps.replaceAddress(code)
      },
      entering: () => this.#update({phase: 'entering', waiting: null}),
      waiting: host => this.#update({waiting: host, waitedForHost: true}),
      failed: failure => this.#end({kind: 'failed', failure}),
      ended: end => this.#end({kind: 'ended', end}),
      serverLost: () => this.#update({serverLost: true}),
      serverBack: () => this.#update({serverLost: false}),
      snapshot: view => this.#snapshot(view),
      hostAway: () => this.#update({hostAway: true}),
      hostBack: () => this.#update({hostAway: false}),
      canAct: canAct => {
        this.#update({canAct})
        if (canAct) {
          this.#sendKept()
        }
      },
      joinRequest: request => request.letIn(),
      rulesError: () => this.#update({rulesError: true})
    }
  }

  #end(finish: Finish): void {
    this.#kept = []
    this.#update({phase: 'over', finish, waiting: null, canAct: false})
  }

  #snapshot({snapshot, seat, isHost}: SnapshotView): void {
    this.#update({
      phase: 'playing',
      waiting: null,
      game: snapshot.state as unknown as Championship | null,
      seat,
      isHost,
      occupied: seats.filter((_, index) => snapshot.seats[index] != null),
      matchNumber: snapshot.match.number
    })
  }

  #codeOf(text: string): string | null {
    return this.#netcode.parseCode(decoded(text))
  }

  #goesOn(): boolean {
    return this.#visit !== null && this.#visit.phase !== 'over'
  }

  #enter(code: string): void {
    this.#kept = []
    this.#show(fresh(code, 'entering'))
    this.#deps.replaceAddress(code)
    this.#netcode.enter(code)
  }

  open(): void {
    const code = this.#codeOf(this.#deps.hash())
    if (code === null) {
      this.#show(null)
    } else {
      this.#enter(code)
    }
  }

  create(): void {
    if (this.#visit !== null) {
      return
    }
    this.#show(fresh(null, 'starting'))
    this.#netcode.start()
  }

  // Enters the game of the text, or answers false when the netcode turns it into no room code (6-1).
  submit(text: string): boolean {
    const code = this.#codeOf(text)
    if (code === null) {
      return false
    }
    if (this.#visit === null) {
      this.#enter(code)
    }
    return true
  }

  addressChanged(): void {
    const code = this.#codeOf(this.#deps.hash())
    if (code === null || code === this.#visit?.code) {
      return
    }
    if (this.#goesOn()) {
      this.#netcode.leave()
    }
    this.#enter(code)
  }

  leave(): void {
    if (this.#visit === null) {
      return
    }
    if (this.#goesOn()) {
      this.#netcode.leave()
    }
    this.#kept = []
    this.#deps.replaceAddress(null)
    this.#show(null)
  }

  startChampionship(): void {
    this.#netcode.startMatch()
  }

  send(move: Move): void {
    const game = this.#visit?.game
    if (!this.#goesOn() || !game) {
      return
    }
    if (this.#kept.length > 0 || this.#netcode.act(move as unknown as Json) === 'cannot act') {
      this.#keep(move, game)
    }
  }

  roomTime(): number {
    return this.#netcode.roomTime() ?? 0
  }

  #keep(move: Move, game: Championship): void {
    const screen = screenOf(game)
    const last = this.#kept.at(-1)
    if (move.type === 'appearance' && last?.move.type === 'appearance') {
      const appearance = {...last.move.appearance, ...move.appearance}
      this.#kept = [...this.#kept.slice(0, -1), {screen: last.screen, move: {type: 'appearance', appearance}}]
      return
    }
    const name = move.type === 'profile' ? this.#kept.findIndex(each => each.move.type === 'profile') : -1
    this.#kept = name >= 0 ? this.#kept.with(name, {move, screen}) : [...this.#kept, {move, screen}]
  }

  #sendKept(): void {
    const game = this.#visit?.game
    if (!game) {
      return
    }
    this.#kept = this.#kept.filter(each => each.screen === screenOf(game))
    while (this.#kept.length > 0 && this.#visit?.canAct === true) {
      const [first, ...rest] = this.#kept
      if (this.#netcode.act(first!.move as unknown as Json) === 'cannot act') {
        return
      }
      this.#kept = rest
    }
  }
}

export const openRoom = (changed: (visit: Visit | null) => void): Room => {
  const room = new Room({
    createNetcode: handlers => createNetcode(title, handlers, browserEnvironment()),
    hash: () => location.hash.slice(1),
    replaceAddress: code => history.replaceState(null, '', code === null ? `${location.pathname}${location.search}` : `#${code}`),
    changed
  })
  addEventListener('hashchange', () => room.addressChanged())
  room.open()
  return room
}
