import {readFile} from 'node:fs/promises'
import {Vector3} from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import type {Completion} from '../core/index.ts'
import {AthleteModel} from '../frontends/3d/athlete-model.ts'
import {performanceMotion} from '../frontends/3d/presentation.ts'

const bytes = new Uint8Array(await readFile(new URL('../frontends/3d/assets/athlete.glb', import.meta.url)))
const source = await new GLTFLoader().parseAsync(bytes.buffer, '')

export const bodyTypes = ['male', 'female'] as const
export const extremeLevels = [0, 10] as const
export const completions = ['full', 'partial', 'none'] as const

export const withAthleteModel = (check: (athlete: AthleteModel) => void) => {
  const athlete = new AthleteModel(source.scene, source.animations)
  try {
    check(athlete)
  } finally {
    athlete.dispose()
  }
}

export const positionOf = (athlete: AthleteModel, bone: string) => {
  athlete.group.updateMatrixWorld(true)
  return athlete.model.getObjectByName(bone)!.getWorldPosition(new Vector3())
}

export const attemptLength = (completion: Completion, challenge: number) =>
  performanceMotion(completion, challenge)
    .slice(0, -1)
    .reduce((sum, motion) => sum + motion.seconds, 0)
