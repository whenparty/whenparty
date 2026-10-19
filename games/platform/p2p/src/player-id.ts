// Who this browser is: a random ID kept in localStorage, so every tab of one browser is the same
// player, before and after a reload. A room keeps a player's place and seat across its connections
// (see README.md). Without storage, each page load is a new player.
const key = 'whenparty:player'

// getStorage: () => localStorage. Reading it, or the storage, may throw in a sandboxed page.
export const playerIdFrom = (getStorage: () => Pick<Storage, 'getItem' | 'setItem'> | null): string => {
  try {
    const storage = getStorage()
    const known = storage?.getItem(key)

    if (known) {
      return known
    }

    const made = crypto.randomUUID()
    storage?.setItem(key, made)
    return made
  } catch {
    return crypto.randomUUID()
  }
}
