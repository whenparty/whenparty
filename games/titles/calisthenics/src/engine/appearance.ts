export const hairstyles = ['short', 'curly', 'bun', 'bald'] as const
export type Hairstyle = (typeof hairstyles)[number]
export const bodyTypes = ['male', 'female'] as const
export type BodyType = (typeof bodyTypes)[number]

export interface Appearance {
  bodyType: BodyType
  hairstyle: Hairstyle
  hair: string
  skin: string
  shirt: string
  shorts: string
  shoes: string
}

export const defaultAppearance = (): Appearance => ({
  bodyType: 'male',
  hairstyle: 'short',
  hair: '#3B2A20',
  skin: '#D9A67E',
  shirt: '#8FAACB',
  shorts: '#23262A',
  shoes: '#F7F7F4'
})

export const isAppearanceChoice = (value: unknown): value is Partial<Appearance> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.entries(value).every(([key, choice]) =>
    key === 'bodyType'
      ? (bodyTypes as readonly unknown[]).includes(choice)
      : key === 'hairstyle'
        ? (hairstyles as readonly unknown[]).includes(choice)
        : ['hair', 'skin', 'shirt', 'shorts', 'shoes'].includes(key) && typeof choice === 'string' && /^#[0-9a-f]{6}$/i.test(choice)
  )
}

export const appearanceOf = (profile: {appearance?: Partial<Appearance>}): Appearance => ({...defaultAppearance(), ...profile.appearance})
