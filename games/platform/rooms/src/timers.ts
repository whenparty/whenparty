import type {Clock} from '@whenparty/transport'

interface Due {
  readonly at: number
  readonly order: number
  readonly callback: () => void
  readonly timer: unknown
}

export type Cancel = () => void

export class Timers {
  readonly clock: Clock
  readonly #due = new Map<number, Due>()
  #order = 0

  constructor(clock: Clock) {
    this.clock = clock
  }

  now(): number {
    return this.clock.now()
  }

  at(at: number, callback: () => void): Cancel {
    const order = ++this.#order
    const timer = this.clock.setTimeout(() => this.check(), Math.max(0, at - this.now()))
    this.#due.set(order, {at, order, callback, timer})
    return () => {
      const due = this.#due.get(order)
      if (due) {
        this.clock.clearTimeout(due.timer)
        this.#due.delete(order)
      }
    }
  }

  check(): void {
    const now = this.now()
    for (;;) {
      let first: Due | undefined
      for (const due of this.#due.values()) {
        if (due.at <= now && (first === undefined || due.at < first.at || (due.at === first.at && due.order < first.order))) {
          first = due
        }
      }
      if (first === undefined) {
        return
      }
      this.clock.clearTimeout(first.timer)
      this.#due.delete(first.order)
      first.callback()
    }
  }

  entered<A extends unknown[]>(handler: (...args: A) => void): (...args: A) => void {
    return (...args) => {
      this.check()
      handler(...args)
    }
  }
}

export const callSafely = <A extends unknown[]>(handler: ((...args: A) => unknown) | undefined, ...args: A): void => {
  if (!handler) {
    return
  }
  try {
    const result = handler(...args)
    if (typeof (result as PromiseLike<unknown> | null)?.then === 'function') {
      Promise.resolve(result).catch(() => {})
    }
  } catch {
    return
  }
}
