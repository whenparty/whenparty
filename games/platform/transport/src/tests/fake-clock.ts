import type {Clock} from '../clock.ts'

interface Timer {
  readonly at: number
  readonly order: number
  readonly callback: () => void
}

export class FakeClock implements Clock {
  #now = 1_000_000
  #order = 0
  readonly #timers = new Map<number, Timer>()

  now(): number {
    return this.#now
  }

  setTimeout(callback: () => void, milliseconds: number): unknown {
    const id = ++this.#order
    this.#timers.set(id, {at: this.#now + Math.max(0, milliseconds), order: id, callback})
    return id
  }

  clearTimeout(timer: unknown): void {
    this.#timers.delete(timer as number)
  }

  advance(milliseconds: number): void {
    const end = this.#now + milliseconds
    for (;;) {
      const next = [...this.#timers.entries()]
        .filter(([, timer]) => timer.at <= end)
        .sort(([, a], [, b]) => a.at - b.at || a.order - b.order)[0]
      if (next === undefined) {
        break
      }
      this.#timers.delete(next[0])
      this.#now = Math.max(this.#now, next[1].at)
      next[1].callback()
    }
    this.#now = end
  }

  sleep(milliseconds: number): void {
    this.#now += milliseconds
  }
}
