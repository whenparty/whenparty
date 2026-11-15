import assert from 'node:assert/strict'
import {test} from 'node:test'

type Cell = {readonly ids: readonly string[]; readonly outcome: unknown} | {readonly impossible: string}

type OutcomeOf<C> = C extends {readonly outcome: infer O} ? O : never

export type Scenarios<T> = {
  readonly [S in keyof T]?: {readonly [E in keyof T[S]]?: (outcome: OutcomeOf<T[S][E]>) => void | Promise<void>}
}

export const cellTests = <T extends {readonly [state: string]: {readonly [event: string]: Cell}}>(
  table: T,
  scenarios: Scenarios<T>
): void => {
  for (const [state, events] of Object.entries(table)) {
    for (const [event, cell] of Object.entries(events)) {
      if (!('ids' in cell)) {
        continue
      }
      test(`${cell.ids.join(' ')} ${state}, ${event}`, async () => {
        const run = (scenarios as {readonly [s: string]: {readonly [e: string]: ((outcome: unknown) => unknown) | undefined} | undefined})[
          state
        ]?.[event]
        assert.ok(run, `the cell ${state}, ${event} has no scenario`)
        await run(cell.outcome)
      })
    }
  }
}
