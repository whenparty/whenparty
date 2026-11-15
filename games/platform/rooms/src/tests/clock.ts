import type {Clock} from '@whenparty/transport'

interface Timer {
  readonly at: number
  readonly order: number
  readonly callback: () => void
}

export class FakeClock implements Clock {
  #now = 1_700_000_000_000
  #order = 0
  readonly #timers = new Map<number, Timer>()

  now(): number {
    return this.#now
  }

  setTimeout(callback: () => void, milliseconds: number): unknown {
    const order = ++this.#order
    this.#timers.set(order, {at: this.#now + Math.max(0, milliseconds), order, callback})
    return order
  }

  clearTimeout(timer: unknown): void {
    this.#timers.delete(timer as number)
  }

  advance(milliseconds: number): void {
    const end = this.#now + milliseconds
    for (;;) {
      const due = [...this.#timers.values()].filter(timer => timer.at <= end).sort((a, b) => a.at - b.at || a.order - b.order)[0]
      if (!due) {
        break
      }
      this.#timers.delete(due.order)
      this.#now = due.at
      due.callback()
    }
    this.#now = end
  }

  jump(milliseconds: number): void {
    this.#now += milliseconds
  }
}
