// Short codes that players read out to each other. No 0/O, 1/I/L, and no vowels, so a code
// is never misread and never spells a word. 28^5 is about 17 million codes.
export const ROOM_CODE_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ'
export const ROOM_CODE_LENGTH = 5

const randomValues = (length: number) => crypto.getRandomValues(new Uint32Array(length))

export const createRoomCode = (random: (length: number) => Uint32Array = randomValues): string =>
  Array.from(random(ROOM_CODE_LENGTH), value => ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length]).join('')

// The code in canonical form, or null if the input cannot be a room code
export const normalizeRoomCode = (input: string): string | null => {
  const code = input.toUpperCase().replace(/[\s-]/g, '')
  const isValid = code.length === ROOM_CODE_LENGTH && [...code].every(char => ROOM_CODE_ALPHABET.includes(char))

  return isValid ? code : null
}
