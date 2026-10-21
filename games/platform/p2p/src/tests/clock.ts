import type {TestContext} from 'node:test'

export const createClock = (t: TestContext, deliverMessages: () => Promise<void>) => {
  let now = 0
  t.mock.timers.enable({apis: ['setTimeout']})
  t.mock.method(performance, 'now', () => now)

  return {
    advance: async (milliseconds: number) => {
      const end = now + Math.ceil(milliseconds)

      while (now < end) {
        now++
        t.mock.timers.tick(1)
        await deliverMessages()
      }
    }
  }
}
