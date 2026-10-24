import type {Appearance} from '../../core/index.ts'

export const defaultAppearance = (): Appearance => ({
  bodyType: 'male',
  hairstyle: 'short',
  hair: '#3B2A20',
  skin: '#D9A67E',
  shirt: '#8FAACB',
  shorts: '#23262A',
  shoes: '#F7F7F4'
})

export const appearanceOf = (profile: {appearance?: Partial<Appearance>}): Appearance => ({...defaultAppearance(), ...profile.appearance})
