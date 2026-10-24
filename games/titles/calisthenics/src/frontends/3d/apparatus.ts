import * as T from 'three'
import {movementOf} from '../../core/index.ts'
import {barDepth, barHeight, handleHeight, handleSpread, ladderGrips, ladderX} from './exercises.ts'

export const exerciseApparatus = (challenge: number) => {
  const group = new T.Group(),
    steel = new T.MeshStandardMaterial({color: '#59656b', metalness: 0.5, roughness: 0.48}),
    timber = new T.MeshStandardMaterial({color: '#b79b75', roughness: 0.85})
  const rod = (a: T.Vector3, b: T.Vector3, radius: number, material = steel) => {
    const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, a.distanceTo(b), 16), material)
    mesh.position.copy(a).add(b).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    mesh.castShadow = mesh.receiveShadow = true
    group.add(mesh)
  }
  const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z)
  switch (movementOf(challenge).apparatus) {
    case 'bar':
      for (const side of [-1, 1]) {
        rod(v(side * 0.9, 0, barDepth), v(side * 0.9, barHeight + 0.08, barDepth), 0.045)
        rod(v(side * 0.9, 0.02, -0.5), v(side * 0.9, 0.02, 0.75), 0.045)
      }
      rod(v(-0.9, barHeight, barDepth), v(0.9, barHeight, barDepth), 0.025)
      break
    case 'handles':
      for (const side of [-1, 1]) {
        rod(v(side * handleSpread, handleHeight, -0.16), v(side * handleSpread, handleHeight, 0.42), 0.025)
        for (const z of [-0.12, 0.38]) {
          rod(v(side * handleSpread, 0.035, z), v(side * handleSpread, handleHeight, z), 0.027)
          rod(v(side * handleSpread - 0.13, 0.025, z), v(side * handleSpread + 0.13, 0.025, z), 0.027)
        }
      }
      break
    case 'ladder':
      for (const z of [-0.4, 0.4]) {
        rod(v(ladderX, 0, z), v(ladderX, 2.65, z), 0.045, timber)
        rod(v(ladderX - 0.1, 0.025, z), v(ladderX + 0.65, 0.025, z), 0.04)
      }
      for (let i = 0; i < 7; i++) {
        const y = ladderGrips[0] + ((i - 2) * (ladderGrips[1] - ladderGrips[0])) / 2
        rod(v(ladderX, y, -0.4), v(ladderX, y, 0.4), 0.025, timber)
      }
      break
  }
  return group
}
