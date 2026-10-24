import * as T from 'three'
import type {Completion} from '../../core/index.ts'

export const barHeight = 2.45
export const barDepth = 0.12
export const handleHeight = 0.44
export const handleSpread = 0.34
export const ladderX = 0.65
export const ladderGrips = [1.1, 1.77] as const

type Hands = 'down' | 'floor' | 'bar' | 'flag'
interface Pose {
  hip: T.Vector3
  rotation: T.Quaternion
  hands: [T.Vector3, T.Vector3]
  feet: [T.Vector3, T.Vector3]
  handMode: Hands
  footRotation: T.Quaternion
  lean: number
}

const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z)
const rotation = (x = 0, y = 0, z = 0) => new T.Quaternion().setFromEuler(new T.Euler(x, y, z))
const smooth = (x: number, a: number, b: number) => T.MathUtils.smoothstep(x, a, b)
const home = (): Pose => ({
  hip: v(0, 0.9167, -0.0501),
  rotation: rotation(),
  hands: [v(0.23, 0.92, 0.03), v(-0.23, 0.92, 0.03)],
  feet: [v(0.089, 0.098, -0.0482), v(-0.089, 0.098, -0.0482)],
  handMode: 'down',
  footRotation: rotation(),
  lean: 0
})

export const attemptSeconds = (completion: Completion) => (completion === 'full' ? 4.2 : completion === 'partial' ? 3.2 : 2.2)

const exercisePose = (challenge: number, completion: Completion, time: number, demonstration: boolean): Pose => {
  const pose = home(),
    duration = attemptSeconds(completion),
    t = T.MathUtils.clamp(time / duration, 0, 1),
    strength = completion === 'full' ? 1 : completion === 'partial' ? 0.56 : 0.12,
    hold = smooth(t, 0.08, 0.28) * (1 - smooth(t, 0.62, 0.82)),
    rep = Math.sin(Math.PI * T.MathUtils.clamp((t - 0.04) / 0.74, 0, 1)),
    q = strength * hold,
    r = strength * Math.max(0, rep)
  const pair = (x: number, y: number, z: number): [T.Vector3, T.Vector3] => [v(x, y, z), v(-x, y, z)]
  const shoulder = v(0, 0.529, -0.015)
  switch (challenge) {
    case 1:
    case 4: {
      const pistol = challenge === 4
      pose.hip.set(pistol ? 0.089 : 0, 0.9167 - (pistol ? 0.49 : 0.43) * r, -0.0501 - 0.19 * r)
      pose.rotation = rotation(0.27 * r)
      pose.hands = pair(0.22, 1.1 - 0.25 * r, 0.4)
      if (pistol) {
        pose.feet[1].set(-0.09, 0.16 + 0.32 * r, 0.12 + 0.58 * r)
      } else pose.feet = pair(0.19, 0.098, -0.0482)
      break
    }
    case 2:
    case 6:
    case 8: {
      const muscle = challenge === 6,
        lever = challenge === 8,
        lift = muscle ? 1.235 * r : 0.7 * r
      pose.rotation = lever ? rotation((-Math.PI * q) / 2) : rotation(0.08 * r)
      shoulder.applyQuaternion(pose.rotation)
      pose.hip.set(0, (muscle ? 1.845 + lift : lever ? 1.82 : 1.82 + lift) - shoulder.y, (muscle ? -0.16 : -0.11) - shoulder.z)
      pose.hands = pair(0.25, barHeight - 0.11, barDepth)
      pose.handMode = 'bar'
      for (const [i, side] of [1, -1].entries()) {
        const leg = v(side * 0.089, -0.822, 0.002)
          .applyQuaternion(pose.rotation)
          .add(pose.hip)
        if (completion === 'partial' && lever) leg.z -= 0.23 * hold
        pose.feet[i]!.copy(leg)
      }
      pose.footRotation.copy(pose.rotation)
      if (muscle) {
        pose.lean = 0.3 * smooth(r, 0.7, 0.9)
        pose.hands.forEach(hand => {
          hand.y += 0.185 * smooth(r, 0.65, 1)
        })
        if (r > 0.8) pose.handMode = 'floor'
      }
      break
    }
    case 3: {
      pose.hip.set(0, 0.515, -0.0501)
      pose.hands = pair(handleSpread, handleHeight + 0.075, 0.08)
      pose.handMode = 'floor'
      pose.feet = pair(T.MathUtils.lerp(0.089, 0.05, q), 0.098 + 0.43 * q, 0.45 + 0.39 * q)
      pose.footRotation = rotation((-Math.PI * q) / 2)
      break
    }
    case 5: {
      pose.rotation = rotation(Math.PI * (0.5 + q * 0.5))
      shoulder.applyQuaternion(pose.rotation)
      pose.hip.set(0, 0.465 + 0.14 * q - shoulder.y, 0.55 - shoulder.z)
      pose.hands = pair(0.2, 0.05, 0.6)
      pose.handMode = 'floor'
      pose.feet = pair(0.089, 0.098, -0.68)
      for (const [i, side] of [1, -1].entries()) {
        const straight = v(side * 0.089, -0.822, 0.002)
          .applyQuaternion(pose.rotation)
          .add(pose.hip)
        pose.feet[i]!.lerp(straight, smooth(q, 0, 0.7))
      }
      pose.footRotation = rotation(Math.PI * q)
      const sole = Math.max(0, 0.1 * Math.cos(Math.PI * q) + 0.24 * Math.sin(Math.PI * q) + 0.004)
      pose.feet.forEach(foot => {
        foot.y = Math.max(foot.y, sole)
      })
      break
    }
    case 7: {
      const down = smooth(t, 0.03, 0.19) * (1 - smooth(t, 0.59, 0.77)),
        plank = smooth(t, 0.18, 0.3) * (1 - smooth(t, 0.5, 0.62)),
        push = Math.sin(Math.PI * T.MathUtils.clamp((t - 0.3) / 0.2, 0, 1)) * strength,
        jump = Math.sin(Math.PI * T.MathUtils.clamp((t - 0.77) / 0.16, 0, 1)) * strength
      const angle = (down - plank) * 1.1 + plank * (1.24 + 0.19 * push)
      pose.hip.set(0, 0.9167 - 0.52 * down + 0.21 * jump, -0.05 - 0.22 * down)
      pose.rotation = rotation(angle)
      pose.hands = pair(0.24, 0.92 - 0.865 * down, 0.03 + 0.27 * down)
      pose.feet = pair(0.12, 0.098 + 0.095 * plank + 0.21 * jump, -0.048)
      pose.hip.y = T.MathUtils.lerp(pose.hip.y, pose.feet[0].y + 0.822 * Math.cos(angle), plank)
      const thigh = v(0, 0.0154, 0.0515).applyQuaternion(pose.rotation).add(pose.hip),
        reach = Math.sqrt(Math.max(0, 0.8397 ** 2 - (thigh.y - pose.feet[0].y) ** 2))
      pose.feet.forEach(foot => {
        foot.z = T.MathUtils.lerp(foot.z, thigh.z - reach, plank)
      })
      pose.footRotation = rotation(0.4 * plank)
      pose.handMode = down > 0.8 ? 'floor' : 'down'
      if (completion === 'none') {
        pose.hip.lerp(home().hip, 0.8)
        pose.rotation.slerp(rotation(), 0.8)
        pose.hands = pair(0.23, 0.85, 0.18)
        pose.feet = home().feet
        pose.footRotation = rotation()
        pose.handMode = 'down'
      }
      break
    }
    case 9: {
      pose.rotation = rotation(0, 0, (-Math.PI * q) / 2)
      pose.hip.set(ladderX - 0.35 - 0.815 * q, 0.9167 + 0.5 * q, -0.0501)
      pose.hands = [v(ladderX - 0.11, ladderGrips[0], 0), v(ladderX - 0.11, ladderGrips[1], 0)]
      pose.handMode = 'flag'
      for (const [i, side] of [1, -1].entries()) {
        pose.feet[i]!.copy(
          v(side * 0.089, -0.818, 0.002)
            .applyQuaternion(pose.rotation)
            .add(pose.hip)
        )
        pose.feet[i]!.y = T.MathUtils.lerp(pose.feet[i]!.y, pose.hip.y, q)
      }
      pose.footRotation.copy(pose.rotation)
      break
    }
  }
  const settle = demonstration ? 0 : smooth(t, 0.82, 1),
    standing = home()
  pose.hip.lerp(standing.hip, settle)
  pose.rotation.slerp(standing.rotation, settle)
  pose.hands.forEach((hand, i) => hand.lerp(standing.hands[i]!, settle))
  pose.feet.forEach((foot, i) => {
    const grounded = foot.y < 0.13 && Math.hypot(foot.x - standing.feet[i]!.x, foot.z - standing.feet[i]!.z) > 0.05,
      step = grounded ? smooth(settle, i === 0 ? 0 : 0.45, i === 0 ? 0.55 : 1) : settle
    foot.lerp(standing.feet[i]!, step)
    if (grounded) foot.y += Math.sin(Math.PI * step) * 0.065
  })
  pose.footRotation.slerp(standing.footRotation, settle)
  pose.lean *= 1 - settle
  if (settle > 0.5) pose.handMode = 'down'
  return pose
}

interface Rest {
  bone: T.Object3D
  position: T.Vector3
  rotation: T.Quaternion
  point: T.Vector3
  orientation: T.Quaternion
}

export class ExerciseRig {
  private rest = new Map<string, Rest>()
  private bodyRotation = rotation()
  private model: T.Object3D
  constructor(model: T.Object3D) {
    this.model = model
    model.updateMatrixWorld(true)
    const inverse = model.matrixWorld.clone().invert(),
      orientation = model.getWorldQuaternion(new T.Quaternion()).invert()
    model.traverse(bone => {
      if (!(bone instanceof T.Bone)) return
      this.rest.set(bone.name, {
        bone,
        position: bone.position.clone(),
        rotation: bone.quaternion.clone(),
        point: bone.getWorldPosition(new T.Vector3()).applyMatrix4(inverse),
        orientation: orientation.clone().multiply(bone.getWorldQuaternion(new T.Quaternion()))
      })
    })
  }

  reset() {
    for (const {bone, position, rotation} of this.rest.values()) {
      bone.position.copy(position)
      bone.quaternion.copy(rotation)
    }
    this.model.updateMatrixWorld(true)
  }

  private point(name: string) {
    return this.model.worldToLocal(this.rest.get(name)!.bone.getWorldPosition(new T.Vector3()))
  }

  private orient(name: string, orientation: T.Quaternion) {
    const bone = this.rest.get(name)!.bone,
      world = this.model.getWorldQuaternion(new T.Quaternion()).multiply(orientation),
      parent = bone.parent!.getWorldQuaternion(new T.Quaternion()).invert()
    bone.quaternion.copy(parent.multiply(world))
    bone.updateMatrixWorld(true)
  }

  private aim(name: string, child: string, target: T.Vector3) {
    const rest = this.rest.get(name)!,
      direction = this.rest.get(child)!.point.clone().sub(rest.point).applyQuaternion(this.bodyRotation).normalize(),
      desired = target.clone().sub(this.point(name)).normalize(),
      turn = new T.Quaternion().setFromUnitVectors(direction, desired)
    this.orient(name, turn.multiply(this.bodyRotation).multiply(rest.orientation))
  }

  private limb(upper: string, lower: string, end: string, target: T.Vector3, pole: T.Vector3) {
    const start = this.point(upper),
      a = this.rest.get(upper)!.point.distanceTo(this.rest.get(lower)!.point),
      b = this.rest.get(lower)!.point.distanceTo(this.rest.get(end)!.point),
      direction = target.clone().sub(start),
      d = T.MathUtils.clamp(direction.length(), Math.abs(a - b) + 0.0001, a + b - 0.0001)
    direction.normalize()
    const along = (a * a + d * d - b * b) / (2 * d),
      bend = pole.clone().sub(start).addScaledVector(direction, -pole.clone().sub(start).dot(direction))
    if (bend.lengthSq() < 1e-6) bend.set(0, 0, 1).addScaledVector(direction, -direction.z)
    const joint = start
      .clone()
      .addScaledVector(direction, along)
      .addScaledVector(bend.normalize(), Math.sqrt(Math.max(0, a * a - along * along)))
    this.aim(upper, lower, joint)
    this.aim(lower, end, target)
  }

  private fingers(suffix: string, mode: Hands, side: number) {
    if (mode === 'down') return
    for (const finger of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
      for (let part = 1; part <= 3; part++) {
        const name = `${finger}_0${part}_${suffix}`,
          rest = this.rest.get(name)
        if (!rest) continue
        const current = this.model
          .getWorldQuaternion(new T.Quaternion())
          .invert()
          .multiply(rest.bone.getWorldQuaternion(new T.Quaternion()))
        let direction = mode === 'floor' ? v(0, 0, 1) : mode === 'flag' ? v(1, 0, 0) : v(0, 1, 0)
        if (finger === 'thumb') direction = mode === 'floor' ? v(-side * 0.8, 0, 0.6) : mode === 'bar' ? v(-side, 0.2, 0) : v(0.5, side, 0)
        else if (mode !== 'floor' && part > 1)
          direction = mode === 'bar' ? (part === 2 ? v(0, 0.2, -1) : v(0, -1, -0.3)) : part === 2 ? v(0.2, -1, 0) : v(-1, -0.3, 0)
        const turn = new T.Quaternion().setFromUnitVectors(v(0, 1, 0).applyQuaternion(current), direction.normalize())
        this.orient(name, turn.multiply(current))
      }
    }
  }

  apply(challenge: number, completion: Completion, time: number, demonstration = false) {
    this.reset()
    const pose = exercisePose(challenge, completion, time, demonstration),
      pelvis = this.rest.get('pelvis')!.bone
    this.bodyRotation.copy(pose.rotation)
    pelvis.position.copy(pelvis.parent!.worldToLocal(this.model.localToWorld(pose.hip.clone())))
    this.orient('pelvis', pose.rotation.clone().multiply(this.rest.get('pelvis')!.orientation))
    if (pose.lean)
      this.orient('spine_02', pose.rotation.clone().multiply(rotation(pose.lean)).multiply(this.rest.get('spine_02')!.orientation))
    for (const [i, side] of [1, -1].entries()) {
      const suffix = side === 1 ? 'l' : 'r',
        shoulder = this.point(`upperarm_${suffix}`),
        elbow = shoulder
          .clone()
          .add(
            pose.handMode === 'flag'
              ? v(-0.35, 0, -0.25)
              : pose.handMode === 'floor'
                ? v(side * 0.3, -0.12, -0.25)
                : v(side * 0.3, -0.18, -0.26).applyQuaternion(pose.rotation)
          ),
        hip = this.point(`thigh_${suffix}`),
        leg = pose.feet[i]!.clone().sub(hip).applyQuaternion(pose.rotation.clone().invert()),
        knee = hip.clone().add(challenge === 7 ? v(0, 0.8, 0.65) : v(0, leg.z, -leg.y).applyQuaternion(pose.rotation))
      this.limb(`upperarm_${suffix}`, `lowerarm_${suffix}`, `hand_${suffix}`, pose.hands[i]!, elbow)
      this.limb(`thigh_${suffix}`, `calf_${suffix}`, `foot_${suffix}`, pose.feet[i]!, knee)
      this.orient(`foot_${suffix}`, pose.footRotation.clone().multiply(this.rest.get(`foot_${suffix}`)!.orientation))
      const fingers =
          pose.handMode === 'bar'
            ? v(0, 1, 0)
            : pose.handMode === 'flag'
              ? v(1, 0, 0)
              : pose.handMode === 'floor'
                ? v(0, 0, 1)
                : v(0, -1, 0),
        thumb =
          pose.handMode === 'floor' || pose.handMode === 'bar' ? v(-side, 0, 0) : pose.handMode === 'flag' ? v(0, 0, side) : v(0, 0, 1),
        across = fingers.clone().cross(thumb).normalize()
      this.orient(`hand_${suffix}`, new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(across, fingers, thumb)))
      this.fingers(suffix, pose.handMode, side)
    }
    this.model.updateMatrixWorld(true)
  }
}
