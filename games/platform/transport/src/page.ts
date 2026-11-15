import type {Transport} from './api.ts'
import type {Clock} from './clock.ts'
import {browserEnvironment, type Environment} from './environment.ts'
import {Signaling} from './signaling.ts'

export interface Live {
  limit(): number
  checkTime(now: number): void
  hide(): void
}

export class PageContext {
  readonly environment: Environment
  readonly clock: Clock
  readonly peers = new Set<Live>()
  readonly signalings = new Set<Live>()

  constructor(environment: Environment) {
    this.environment = environment
    this.clock = environment.clock
    environment.onPageHide(this.entered(() => this.#hide()))
  }

  now(): number {
    return this.clock.now()
  }

  entered<A extends unknown[]>(handler: (...args: A) => void): (...args: A) => void {
    return (...args) => {
      this.checkTime()
      handler(...args)
    }
  }

  checkTime(): void {
    const now = this.now()
    const due = [...this.signalings, ...this.peers]
      .map(item => ({item, at: item.limit()}))
      .filter(({at}) => at <= now)
      .sort((a, b) => a.at - b.at)
    for (const {item} of due) {
      item.checkTime(now)
    }
  }

  timerAt(at: number, callback: () => void): unknown {
    return this.clock.setTimeout(this.entered(callback), Math.max(0, at - this.now()))
  }

  #hide(): void {
    for (const item of [...this.peers, ...this.signalings]) {
      item.hide()
    }
  }
}

export const createTransport = (environment: Environment = browserEnvironment()): Transport => {
  const page = new PageContext(environment)
  return {openSignaling: modules => new Signaling(page, modules)}
}
