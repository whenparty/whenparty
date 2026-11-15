import {createRooms, type Room} from '../index.ts'

const rooms = createRooms()
const told: string[] = []
let room: Room | null = null

const harness = {
  create(appId: string): boolean {
    room = rooms.create(appId, null, {
      created: code => told.push(`created ${code}`),
      failed: failure => told.push(`failed ${failure.reason}`),
      ended: ending => told.push(`ended ${ending.reason}`)
    })
    return room !== null
  },
  leave: (): void => room?.leave(),
  told: (): readonly string[] => told
}

export type Harness = typeof harness

declare global {
  var harness: Harness
}

globalThis.harness = harness
