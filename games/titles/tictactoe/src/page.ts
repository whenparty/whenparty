import type {GameHandlers, JoinRequestAnswer, Json, Netcode, SnapshotView} from '@whenparty/netcode'
import {gameOf, statusOf, type Shown} from './status.ts'
import {isOver, isPaused, marks, type Cell} from './tictactoe.ts'

const notACode = 'That is not a room code. Codes have 5 characters, like K7MXQ.'

const decoded = (text: string): string => {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

export type CopyLabel = 'Copy invite link' | 'Copied' | 'Copy failed'

const copyLabelMs = 2000

export interface View {
  readonly screen: 'lobby' | 'room'
  readonly formError: string | null
  readonly code: string | null
  readonly hosting: boolean
  readonly status: string
  readonly board: readonly Cell[]
  readonly winning: readonly number[]
  readonly playable: readonly boolean[]
  readonly nextMatch: boolean
  readonly requests: readonly number[]
  readonly copyLabel: CopyLabel
}

export interface PageDeps {
  createNetcode(handlers: GameHandlers): Netcode
  hash(): string
  replaceAddress(code: string | null): void
  inviteLink(): string
  copy(text: string): Promise<void>
  after(ms: number, then: () => void): () => void
  render(view: View): void
}

export type Screen = 'loading' | 'lobby' | 'room' | 'roomOver'

const empty: Shown = {
  code: null,
  isHost: false,
  starting: false,
  entering: false,
  waiting: null,
  hostAway: false,
  serverLost: false,
  rulesError: false,
  played: null,
  finish: null,
  waitedForHost: false
}

const emptyBoard: readonly Cell[] = Array<Cell>(9).fill(null)

export class TicTacToePage {
  readonly #deps: PageDeps
  readonly #netcode: Netcode
  #screen: Screen = 'loading'
  #shown: Shown = empty
  #requests = new Map<number, JoinRequestAnswer>()
  #canAct = false
  #formError: string | null = null
  #copyLabel: CopyLabel = 'Copy invite link'
  #cancelCopyLabel: () => void = () => {}

  constructor(deps: PageDeps) {
    this.#deps = deps
    this.#netcode = deps.createNetcode(this.#handlers())
  }

  get screen(): Screen {
    return this.#screen
  }

  #update(change: Partial<Shown>): void {
    this.#shown = {...this.#shown, ...change}
    this.#render()
  }

  #handlers(): GameHandlers {
    return {
      code: code => {
        this.#update({code, starting: false})
        this.#deps.replaceAddress(code)
      },
      entering: () => this.#update({entering: true, waiting: null}),
      waiting: host => this.#update({waiting: host, entering: false, waitedForHost: true}),
      failed: failure => this.#finish({finish: {kind: 'failed', failure}}),
      ended: end => this.#finish({finish: {kind: 'ended', end}}),
      serverLost: () => this.#update({serverLost: true}),
      serverBack: () => this.#update({serverLost: false}),
      snapshot: view => this.#snapshot(view as SnapshotView),
      hostAway: () => this.#update({hostAway: true}),
      hostBack: () => this.#update({hostAway: false}),
      canAct: canAct => {
        this.#canAct = canAct
        this.#render()
      },
      joinRequest: request => {
        this.#requests.set(request.number, request)
        this.#render()
      },
      requestEnded: number => {
        this.#requests.delete(number)
        this.#render()
      },
      rulesError: () => this.#update({rulesError: true})
    }
  }

  #finish(change: Partial<Shown>): void {
    this.#screen = 'roomOver'
    this.#requests.clear()
    this.#canAct = false
    this.#update({...change, isHost: false, starting: false, entering: false, waiting: null})
  }

  #snapshot(view: SnapshotView): void {
    this.#update({
      played: {snapshot: view.snapshot, seat: view.seat},
      isHost: view.isHost,
      entering: false,
      waiting: null
    })
    const {snapshot} = view
    if (view.isHost && !snapshot.running && snapshot.match.number === 0 && snapshot.seats.every(seat => seat !== null)) {
      this.#netcode.startMatch()
    }
  }

  #codeOf(text: string): string | null {
    return this.#netcode.parseCode(text)
  }

  #addressCode(): string | null {
    return this.#codeOf(decoded(this.#deps.hash()))
  }

  #enter(code: string): void {
    this.#screen = 'room'
    this.#requests.clear()
    this.#canAct = false
    this.#shown = {...empty, code}
    this.#deps.replaceAddress(code)
    this.#render()
    this.#netcode.enter(code)
  }

  #lobby(): void {
    this.#screen = 'lobby'
    this.#requests.clear()
    this.#canAct = false
    this.#formError = null
    this.#shown = empty
    this.#render()
  }

  #leaveGame(): void {
    if (this.#screen === 'room') {
      this.#netcode.leave()
    }
  }

  open(): void {
    const code = this.#addressCode()
    if (code === null) {
      this.#lobby()
    } else {
      this.#enter(code)
    }
  }

  startPressed(): void {
    if (this.#screen !== 'lobby') {
      return
    }
    this.#screen = 'room'
    this.#shown = {...empty, isHost: true, starting: true}
    this.#render()
    this.#netcode.start()
  }

  submitted(text: string): void {
    if (this.#screen !== 'lobby') {
      return
    }
    const code = this.#codeOf(text)
    if (code === null) {
      this.#formError = notACode
      this.#render()
      return
    }
    this.#enter(code)
  }

  addressChanged(): void {
    if (this.#screen === 'loading') {
      return
    }
    const code = this.#addressCode()
    if (code === null) {
      this.#leaveGame()
      if (this.#screen !== 'lobby') {
        this.#lobby()
      }
      return
    }
    if (this.#screen !== 'lobby' && code === this.#shown.code) {
      this.#deps.replaceAddress(code)
      return
    }
    this.#leaveGame()
    this.#enter(code)
  }

  leavePressed(): void {
    if (this.#screen !== 'room' && this.#screen !== 'roomOver') {
      return
    }
    this.#leaveGame()
    this.#lobby()
    this.#deps.replaceAddress(null)
  }

  copyPressed(): void {
    if (this.#screen !== 'room' && this.#screen !== 'roomOver') {
      return
    }
    this.#deps.copy(this.#deps.inviteLink()).then(
      () => this.#copyEnded('Copied'),
      () => this.#copyEnded('Copy failed')
    )
  }

  #copyEnded(label: CopyLabel): void {
    this.#cancelCopyLabel()
    this.#copyLabel = label
    this.#cancelCopyLabel = this.#deps.after(copyLabelMs, () => {
      this.#copyLabel = 'Copy invite link'
      this.#render()
    })
    this.#render()
  }

  #playable(): boolean[] {
    const game = gameOf(this.#shown.played)
    const seat = this.#shown.played?.seat ?? null
    const ready = this.#screen === 'room' && this.#canAct && game !== null && !isOver(game) && !isPaused(game) && seat === game.turn
    return (game?.board ?? emptyBoard).map(cell => ready && cell === null)
  }

  cellClicked(index: number): void {
    const game = gameOf(this.#shown.played)
    if (game === null || this.#playable()[index] !== true) {
      return
    }
    this.#netcode.act({cell: index, board: [...game.board]} as unknown as Json)
  }

  startNextPressed(): void {
    if (this.#nextMatch()) {
      this.#netcode.startMatch()
    }
  }

  answered(number: number, letIn: boolean): void {
    const request = this.#requests.get(number)
    if (request === undefined || this.#screen !== 'room') {
      return
    }
    this.#requests.delete(number)
    if (letIn) {
      request.letIn()
    } else {
      request.refuse()
    }
    this.#render()
  }

  #nextMatch(): boolean {
    const snapshot = this.#shown.played?.snapshot
    return (
      this.#screen === 'room' &&
      this.#shown.isHost &&
      snapshot !== undefined &&
      !snapshot.running &&
      snapshot.match.number > 0 &&
      marks.every((_, index) => snapshot.seats[index] != null)
    )
  }

  #render(): void {
    if (this.#screen === 'loading') {
      return
    }
    const game = gameOf(this.#shown.played)
    const result = game?.result
    this.#deps.render({
      screen: this.#screen === 'lobby' ? 'lobby' : 'room',
      formError: this.#screen === 'lobby' ? this.#formError : null,
      code: this.#shown.code,
      hosting: this.#shown.isHost,
      status: statusOf(this.#shown),
      board: game?.board ?? emptyBoard,
      winning: result?.kind === 'win' ? result.cells : [],
      playable: this.#playable(),
      nextMatch: this.#nextMatch(),
      requests: this.#screen === 'room' ? [...this.#requests.keys()] : [],
      copyLabel: this.#copyLabel
    })
  }
}
