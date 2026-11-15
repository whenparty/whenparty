export const seeded = (seed: number): (() => number) => {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

export const pick = <T>(random: () => number, items: readonly T[]): T => {
  const item = items[Math.floor(random() * items.length)]
  if (item === undefined) {
    throw new Error('nothing to pick')
  }
  return item
}
