import type {Clock} from './api.ts'
import {roomTimeMax} from './rules.ts'

export class RoomTime {
  readonly #clock: Clock
  #value: number
  #highest: number
  #stopped = false

  constructor(clock: Clock, start: number) {
    this.#clock = clock
    this.#value = start
    this.#highest = clock.now()
  }

  read(): number {
    const now = this.#clock.now()
    if (now > this.#highest) {
      if (!this.#stopped) {
        this.#value = Math.min(roomTimeMax, this.#value + now - this.#highest)
      }
      this.#highest = now
    }
    return this.#value
  }

  set(value: number): void {
    this.#value = value
    this.#highest = this.#clock.now()
    this.#stopped = false
  }

  stop(): void {
    this.read()
    this.#stopped = true
  }

  goOn(): void {
    this.read()
    this.#stopped = false
  }
}
