import assert from 'node:assert/strict'
import {test} from 'node:test'

type Cell = {readonly ids: readonly string[]; readonly outcome: unknown} | {readonly impossible: string}

type Branches = {readonly branches: readonly {readonly when: string; readonly outcome: unknown}[]}

export type Check<O> = (outcome: O) => void | Promise<void>

export type Impossible = {readonly impossible: string}

export type Scenario<O> = Check<O> | {readonly [when: string]: Check<O> | Impossible}

export type Scenarios<T, O> = {readonly [S in keyof T]?: {readonly [E in keyof T[S]]?: Scenario<O>}}

const isBranches = (outcome: unknown): outcome is Branches => typeof outcome === 'object' && outcome !== null && 'branches' in outcome

export const testCells = <T extends {readonly [state: string]: {readonly [event: string]: Cell}}, O>(
  name: string,
  table: T,
  scenarios: Scenarios<T, O>
): void => {
  for (const [state, events] of Object.entries(table)) {
    for (const [event, cell] of Object.entries(events)) {
      if (!('ids' in cell)) {
        continue
      }
      const scenario = (scenarios as {readonly [state: string]: {readonly [event: string]: Scenario<O>} | undefined})[state]?.[event]
      const ids = cell.ids.join(' ')
      if (isBranches(cell.outcome)) {
        for (const branch of cell.outcome.branches) {
          const check = typeof scenario === 'object' ? scenario[branch.when] : undefined
          const title = `${ids} ${name}: ${state}, ${event}, when ${branch.when}`
          if (typeof check === 'object') {
            test(title, {skip: check.impossible}, () => {})
            continue
          }
          test(title, async () => {
            assert.ok(check, 'no scenario for this branch')
            await check(branch.outcome as O)
          })
        }
      } else {
        test(`${ids} ${name}: ${state}, ${event}`, async () => {
          assert.equal(typeof scenario, 'function', 'no scenario for this cell')
          await (scenario as Check<O>)(cell.outcome as O)
        })
      }
    }
  }
}
