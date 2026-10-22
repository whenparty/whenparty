import * as T from 'three'
import {clone} from 'three/addons/utils/SkeletonUtils.js'
import {appearanceOf, type Appearance, type Levels, type Profile} from '../engine/index.ts'
import {bodyVolume, motionAt, type Motion} from './presentation.ts'
import {ExerciseRig, attemptSeconds} from './exercises.ts'

const material = (color: string) => new T.MeshStandardMaterial({color, roughness: 0.82})

const smoothTorso = (geometry: T.BufferGeometry, shape: Float32Array) => {
  const position = geometry.getAttribute('position'),
    index = geometry.index!,
    byPosition = new Map<string, number>(),
    groups: {vertices: number[]; neighbors: Set<number>; weight: number}[] = [],
    groupOf: number[] = [],
    points: T.Vector3[] = []
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      y = position.getY(i),
      z = position.getZ(i),
      key = [x, y, z].map(value => Math.round(value * 1e5)).join(',')
    let group = byPosition.get(key)
    if (group === undefined) {
      group = groups.length
      byPosition.set(key, group)
      groups.push({
        vertices: [],
        neighbors: new Set(),
        weight:
          Math.max(
            T.MathUtils.smoothstep(y, 1.03, 1.08) * (1 - T.MathUtils.smoothstep(y, 1.37, 1.43)),
            T.MathUtils.smoothstep(y, 0.78, 0.88) * (1 - T.MathUtils.smoothstep(y, 0.98, 1.02)) * T.MathUtils.smoothstep(-z, 0.015, 0.08)
          ) *
          (1 - T.MathUtils.smoothstep(Math.abs(x), 0.17, 0.22))
      })
      points.push(new T.Vector3())
    }
    groupOf.push(group)
    groups[group]!.vertices.push(i)
    points[group]!.add(new T.Vector3(x + shape[i * 3]!, y + shape[i * 3 + 1]!, z + shape[i * 3 + 2]!))
  }
  groups.forEach((group, i) => {
    points[i]!.divideScalar(group.vertices.length)
  })
  for (let i = 0; i < index.count; i += 3) {
    const triangle = [groupOf[index.getX(i)]!, groupOf[index.getX(i + 1)]!, groupOf[index.getX(i + 2)]!]
    for (const a of triangle) for (const b of triangle) if (a !== b) groups[a]!.neighbors.add(b)
  }
  let current = points
  for (let pass = 0; pass < 24; pass++) {
    const rate = pass < 8 ? 0.45 : pass % 2 === 0 ? 0.5 : -0.53
    current = current.map((point, i) => {
      const group = groups[i]!
      if (!group.weight || !group.neighbors.size) return point
      const average = new T.Vector3()
      for (const neighbor of group.neighbors) average.add(current[neighbor]!)
      return point.clone().lerp(average.divideScalar(group.neighbors.size), rate * group.weight)
    })
  }
  const smoothed = groups.filter(group => group.weight > 0)
  groups.forEach((group, i) => {
    if (group.weight > 0)
      for (const vertex of group.vertices) {
        shape[vertex * 3] = current[i]!.x - position.getX(vertex)
        shape[vertex * 3 + 1] = current[i]!.y - position.getY(vertex)
        shape[vertex * 3 + 2] = current[i]!.z - position.getZ(vertex)
      }
  })
  return smoothed.map(group => group.vertices)
}

export class AthleteModel {
  readonly group = new T.Group()
  readonly mixer: T.AnimationMixer
  readonly model: T.Object3D
  private meshes: {mesh: T.SkinnedMesh; regions: string[]; shorts: {value: T.Color}; skin: {value: T.Color}}[] = []
  private face: T.Group | null = null
  private look = ''
  private clip = ''
  private action: T.AnimationAction | null = null
  private sequence: Motion[] = [{clip: 'Idle_Subtle', seconds: Infinity, loop: true}]
  private elapsed = 0
  private reduced = false
  private frozen = false
  private clips: T.AnimationClip[]
  private exerciseRig: ExerciseRig

  constructor(source: T.Object3D, clips: T.AnimationClip[]) {
    const pushup = clips.find(clip => clip.name === 'Pushup')
    this.clips = pushup ? [...clips, T.AnimationUtils.subclip(pushup, 'Pushup Failed', 0, (pushup.duration * 30) / 2)] : clips
    this.model = clone(source)
    this.model.updateMatrixWorld(true)
    this.model.traverse(object => {
      if (object instanceof T.SkinnedMesh) this.prepareMesh(object)
    })
    this.group.add(this.model)
    this.mixer = new T.AnimationMixer(this.model)
    this.exerciseRig = new ExerciseRig(this.model)
  }

  private prepareMesh(mesh: T.SkinnedMesh) {
    const geometry = mesh.geometry.clone()
    mesh.geometry = geometry
    const position = geometry.getAttribute('position')
    const skin = geometry.getAttribute('skinIndex')
    const weights = geometry.getAttribute('skinWeight')
    const bones = mesh.skeleton.bones
    const rest = bones.map((_, i) =>
      new T.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[i]!.clone().invert()).applyMatrix4(mesh.bindMatrixInverse)
    )
    const segments = bones.map((bone, i) => {
      const category = /^(upperarm|lowerarm)/.test(bone.name) ? 'arm' : /^(thigh|calf)/.test(bone.name) ? 'leg' : null
      const child =
        bone.children.find(child => child instanceof T.Bone && !child.name.includes('leaf')) ??
        bone.children.find(child => child instanceof T.Bone)
      const end = bones.indexOf(child as T.Bone)
      return category && end >= 0 ? {category, start: rest[i]!, end: rest[end]!, upper: /^(upperarm|thigh)/.test(bone.name)} : null
    })
    const arms = new Float32Array(position.count * 3),
      legs = new Float32Array(position.count * 3),
      female = new Float32Array(position.count * 3)
    const p = new T.Vector3(),
      direction = new T.Vector3(),
      radial = new T.Vector3(),
      delta = new T.Vector3()
    const regions: string[] = [],
      torsoVertices: number[] = []
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i)
      let dominant = 0,
        largest = 0,
        torsoWeight = 0,
        thighWeight = 0
      for (let k = 0; k < 4; k++) {
        const bi = skin.getComponent(i, k),
          weight = weights.getComponent(i, k),
          segment = segments[bi]
        if (/^(spine|pelvis|clavicle)/.test(bones[bi]?.name ?? '')) torsoWeight += weight
        if (/^thigh/.test(bones[bi]?.name ?? '')) thighWeight += weight
        if (weight > largest) {
          dominant = bi
          largest = weight
        }
        if (!segment || weight < 0.02) continue
        direction.subVectors(segment.end, segment.start)
        const t = T.MathUtils.clamp(delta.subVectors(p, segment.start).dot(direction) / direction.lengthSq(), 0, 1)
        radial.copy(p).sub(segment.start).addScaledVector(direction, -t)
        const amount =
          weight *
          (0.18 + 0.82 * Math.sin(Math.PI * t)) *
          (segment.category === 'arm' ? (segment.upper ? 0.075 : 0.033) : segment.upper ? 0.09 : 0.055)
        if (radial.lengthSq() > 1e-8) radial.normalize().multiplyScalar(amount)
        const target = segment.category === 'arm' ? arms : legs
        target[i * 3] = (target[i * 3] ?? 0) + radial.x
        target[i * 3 + 1] = (target[i * 3 + 1] ?? 0) + radial.y
        target[i * 3 + 2] = (target[i * 3 + 2] ?? 0) + radial.z
        female[i * 3] = (female[i * 3] ?? 0) - radial.x * (segment.category === 'arm' ? 0.28 : 0.12)
        female[i * 3 + 1] = (female[i * 3 + 1] ?? 0) - radial.y * (segment.category === 'arm' ? 0.28 : 0.12)
        female[i * 3 + 2] = (female[i * 3 + 2] ?? 0) - radial.z * (segment.category === 'arm' ? 0.28 : 0.12)
      }
      const waist = Math.exp(-(((p.y - 1.08) / 0.14) ** 2)),
        hips = Math.exp(-(((p.y - 0.9) / 0.13) ** 2)),
        shoulders = Math.exp(-(((p.y - 1.4) / 0.16) ** 2))
      female[i * 3] =
        (female[i * 3] ?? 0) + p.x * (0.18 * hips * (torsoWeight + thighWeight * 0.8) - torsoWeight * (0.19 * waist + 0.1 * shoulders))
      female[i * 3 + 2] = (female[i * 3 + 2] ?? 0) - torsoWeight * (p.z < 0 ? 0.012 * hips : 0)
      const name = bones[dominant]?.name ?? '',
        segment = segments[dominant]
      if (/^(spine|pelvis|clavicle)/.test(name)) {
        torsoVertices.push(i)
        const bust = Math.exp(-(((Math.abs(p.x) - 0.075) / 0.065) ** 2) - ((p.y - 1.32) / 0.09) ** 2),
          front = T.MathUtils.smoothstep(p.z, 0.015, 0.1),
          rear = T.MathUtils.smoothstep(-p.z, 0.01, 0.08),
          ribDepth = 0.015 + 0.09 * Math.sqrt(Math.max(0, 1 - (p.x / (0.145 + 0.045 * shoulders)) ** 2)),
          chestBlend = T.MathUtils.smoothstep(p.y, 1.14, 1.23) * (1 - T.MathUtils.smoothstep(p.y, 1.43, 1.5)),
          chestOffset = (ribDepth + 0.15 * bust - p.z) * chestBlend
        female[i * 3] = (female[i * 3] ?? 0) - p.x * torsoWeight * 0.08 * waist
        female[i * 3 + 2] = (female[i * 3 + 2] ?? 0) + torsoWeight * (front * chestOffset - p.z * 0.22 * waist - rear * 0.045 * hips)
      }
      let region = /^(spine|clavicle)/.test(name)
        ? 'shirt'
        : /^pelvis/.test(name)
          ? 'shorts'
          : /^(foot|ball|toe)/.test(name)
            ? 'shoes'
            : 'skin'
      if (/^thigh/.test(name) && segment) {
        direction.subVectors(segment.end, segment.start)
        if (delta.subVectors(p, segment.start).dot(direction) / direction.lengthSq() < 0.58) region = 'shorts'
      }
      if (p.y > 1 && p.y < 1.18 && Math.abs(p.x) < 0.22) region = 'shirt'
      regions.push(region)
    }
    const smoothed = smoothTorso(geometry, female)
    geometry.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(position.count * 3), 3))
    geometry.morphAttributes.position = [new T.BufferAttribute(arms, 3), new T.BufferAttribute(legs, 3), new T.BufferAttribute(female, 3)]
    const shaped = geometry.clone(),
      shapedPosition = shaped.getAttribute('position'),
      normal = geometry.getAttribute('normal'),
      femaleNormals = new Float32Array(position.count * 3)
    for (let i = 0; i < position.count; i++)
      shapedPosition.setXYZ(
        i,
        position.getX(i) + female[i * 3]!,
        position.getY(i) + female[i * 3 + 1]!,
        position.getZ(i) + female[i * 3 + 2]!
      )
    shaped.computeVertexNormals()
    const shapedNormal = shaped.getAttribute('normal')
    for (const group of smoothed) {
      delta.set(0, 0, 0)
      for (const i of group) delta.add(radial.fromBufferAttribute(shapedNormal, i))
      delta.normalize()
      for (const i of group) shapedNormal.setXYZ(i, delta.x, delta.y, delta.z)
    }
    for (const i of new Set([...torsoVertices, ...smoothed.flat()])) {
      femaleNormals[i * 3] = shapedNormal.getX(i) - normal.getX(i)
      femaleNormals[i * 3 + 1] = shapedNormal.getY(i) - normal.getY(i)
      femaleNormals[i * 3 + 2] = shapedNormal.getZ(i) - normal.getZ(i)
    }
    shaped.dispose()
    geometry.morphAttributes.normal = [
      new T.Float32BufferAttribute(new Float32Array(position.count * 3), 3),
      new T.Float32BufferAttribute(new Float32Array(position.count * 3), 3),
      new T.BufferAttribute(femaleNormals, 3)
    ]
    geometry.morphTargetsRelative = true
    mesh.updateMorphTargets()
    const outfit = new T.MeshStandardMaterial({vertexColors: true, roughness: 0.78, side: T.DoubleSide})
    const shorts = {value: new T.Color()},
      skinColor = {value: new T.Color()}
    outfit.onBeforeCompile = shader => {
      shader.uniforms.shortsColor = shorts
      shader.uniforms.skinColor = skinColor
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float outfitHeight;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\noutfitHeight = position.y;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float outfitHeight;\nuniform vec3 shortsColor;\nuniform vec3 skinColor;')
        .replace(
          '#include <color_fragment>',
          '#include <color_fragment>\nif (outfitHeight > 0.26 && outfitHeight < 1.03) diffuseColor.rgb = outfitHeight >= 0.70 ? shortsColor : skinColor;'
        )
    }
    mesh.material = outfit
    mesh.castShadow = mesh.receiveShadow = true
    mesh.frustumCulled = false
    this.meshes.push({mesh, regions, shorts, skin: skinColor})
  }

  update(profile: Profile, levels: Levels) {
    const look = appearanceOf(profile),
      key = JSON.stringify(look)
    const volume = bodyVolume(levels.arms, levels.legs)
    for (const {mesh, regions, shorts, skin} of this.meshes) {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[0] = volume.arms
        mesh.morphTargetInfluences[1] = volume.legs
        mesh.morphTargetInfluences[2] = look.bodyType === 'female' ? 1 : 0
      }
      if (key === this.look) continue
      shorts.value.set(look.shorts)
      skin.value.set(look.skin)
      const colors = mesh.geometry.getAttribute('color')
      const palette: Record<string, T.Color> = Object.fromEntries(
        ['skin', 'shirt', 'shorts', 'shoes'].map(region => [region, new T.Color(look[region as keyof Appearance])])
      )
      regions.forEach((region, i) => {
        const color = palette[region]!
        colors.setXYZ(i, color.r, color.g, color.b)
      })
      colors.needsUpdate = true
    }
    if (key !== this.look) {
      this.makeFace(look)
      this.look = key
    }
  }

  private makeFace(look: Appearance) {
    if (this.face) {
      this.face.removeFromParent()
      disposeObject(this.face)
    }
    const head = this.model.getObjectByName('head')
    if (!head) return
    this.mixer.stopAllAction()
    this.model.traverse(object => {
      if (object instanceof T.SkinnedMesh) object.skeleton.pose()
    })
    this.model.updateMatrixWorld(true)
    const bounds = new T.Box3(),
      p = new T.Vector3()
    for (const {mesh} of this.meshes) {
      const indices = new Set(mesh.skeleton.bones.flatMap((bone, i) => (bone.name.startsWith('head') ? [i] : [])))
      const skin = mesh.geometry.getAttribute('skinIndex'),
        weights = mesh.geometry.getAttribute('skinWeight')
      for (let i = 0; i < skin.count; i++) {
        let weight = 0
        for (let k = 0; k < 4; k++) if (indices.has(skin.getComponent(i, k))) weight += weights.getComponent(i, k)
        if (weight > 0.65) {
          mesh.getVertexPosition(i, p)
          p.applyMatrix4(mesh.matrixWorld)
          bounds.expandByPoint(p)
        }
      }
    }
    if (bounds.isEmpty()) return
    const size = bounds.getSize(new T.Vector3()),
      center = bounds.getCenter(new T.Vector3())
    const face = new T.Group(),
      hair = material(look.hair),
      ink = material('#23262a')
    const sphere = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: T.Material) => {
      const part = new T.Mesh(new T.SphereGeometry(1, 12, 8), mat)
      part.position.set(x, y, z)
      part.scale.set(sx, sy, sz)
      part.castShadow = true
      face.add(part)
    }
    for (const side of [-1, 1])
      sphere(center.x + side * size.x * 0.19, center.y + size.y * 0.09, bounds.max.z - 0.018, 0.0075, 0.0115, 0.005, ink)
    const smile = new T.Mesh(new T.TorusGeometry(0.022, 0.002, 5, 12, Math.PI), ink)
    smile.rotation.z = Math.PI
    smile.position.set(center.x, center.y - 0.02, bounds.max.z - 0.012)
    face.add(smile)
    if (look.hairstyle !== 'bald') {
      const cap = new T.Mesh(new T.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.53), hair)
      cap.scale.set(size.x * 0.53, size.y * 0.32, size.z * 0.57)
      cap.position.set(center.x, bounds.max.y - size.y * 0.22, center.z - 0.013)
      face.add(cap)
      if (look.hairstyle === 'curly')
        for (let i = 0; i < 13; i++) {
          const angle = i * 2.4
          sphere(
            center.x + Math.cos(angle) * size.x * 0.35,
            bounds.max.y + 0.006 + (i % 3) * 0.01,
            center.z + Math.sin(angle) * size.z * 0.35,
            0.038,
            0.03,
            0.035,
            hair
          )
        }
      if (look.hairstyle === 'bun') sphere(center.x, bounds.max.y + 0.035, center.z - size.z * 0.22, 0.055, 0.06, 0.055, hair)
      if (look.hairstyle === 'short')
        for (let i = 0; i < 3; i++) sphere(center.x + (i - 1) * 0.035, bounds.max.y, center.z + 0.02, 0.035, 0.016, 0.035, hair)
    }
    this.model.add(face)
    head.attach(face)
    this.face = face
    this.clip = ''
  }

  play(motions: Motion[], reduced: boolean, elapsed = 0, frozen = false) {
    this.sequence = motions
    this.elapsed = elapsed
    this.clip = ''
    this.reduced = reduced
    this.frozen = frozen
    this.tick(0)
  }

  tick(dt: number) {
    if (!this.reduced && !this.frozen) this.elapsed += dt
    const {motion, time} = motionAt(this.sequence, this.reduced ? 0 : this.elapsed)
    if (motion.exercise) {
      if (this.clip !== motion.clip) {
        this.mixer.stopAllAction()
        this.action = null
        this.clip = motion.clip
      }
      const {challenge, completion} = motion.exercise,
        duration = attemptSeconds(completion),
        at = this.reduced
          ? duration * 0.4
          : motion.sample
            ? duration * T.MathUtils.lerp(motion.sample.from, motion.sample.to, T.MathUtils.clamp(time / motion.seconds, 0, 1))
            : motion.loop
              ? time % duration
              : Math.min(time, duration)
      this.exerciseRig.apply(challenge, completion, at, Boolean(motion.loop || motion.exercise.supported))
      return
    }
    if (motion.clip !== this.clip) {
      if (this.clip.startsWith('Exercise ')) this.exerciseRig.reset()
      const clip = this.clips.find(clip => clip.name === motion.clip)
      if (!clip) return
      const previous = this.action,
        action = this.mixer.clipAction(clip)
      action
        .reset()
        .setEffectiveWeight(1)
        .setEffectiveTimeScale(motion.speed ?? 1)
      action.setLoop(motion.loop ? T.LoopRepeat : T.LoopOnce, motion.loop ? Infinity : 1)
      action.clampWhenFinished = true
      action.play()
      if (previous && previous !== action) {
        if (this.reduced || this.frozen) previous.stop()
        else {
          previous.fadeOut(0.35)
          action.fadeIn(0.35)
        }
      }
      action.paused = this.reduced || this.frozen || Boolean(motion.sample)
      action.time = this.reduced
        ? Math.min(clip.duration * 0.42, 0.65)
        : motion.loop
          ? (time * (motion.speed ?? 1)) % clip.duration
          : Math.min(time * (motion.speed ?? 1), clip.duration)
      this.action = action
      this.clip = motion.clip
    }
    if (motion.sample && this.action && !this.reduced)
      this.action.time =
        this.action.getClip().duration *
        T.MathUtils.lerp(motion.sample.from, motion.sample.to, T.MathUtils.clamp(time / motion.seconds, 0, 1))
    this.mixer.update(this.reduced || this.frozen ? 0 : dt)
  }

  dispose() {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.model)
    this.meshes.forEach(({mesh}) => mesh.skeleton.dispose())
    disposeObject(this.group)
  }
}

export const disposeObject = (object: T.Object3D) => {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>()
  object.traverse(part => {
    if (part instanceof T.Mesh) {
      geometries.add(part.geometry)
      ;(Array.isArray(part.material) ? part.material : [part.material]).forEach(mat => materials.add(mat))
    }
  })
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(mat => mat.dispose())
}
