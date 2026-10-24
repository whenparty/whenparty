import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {test} from 'node:test'
import {Vector3} from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {startingCondition} from '../core/index.ts'
import {AthleteModel} from '../frontends/3d/athlete-model.ts'
import {performanceMotion} from '../frontends/3d/presentation.ts'

for (const bodyType of ['male', 'female'] as const)
  test(`a ${bodyType} athlete's failed push-up stays grounded without completing a repetition`, async () => {
    const bytes = new Uint8Array(await readFile(new URL('../frontends/3d/assets/athlete.glb', import.meta.url)))
    const source = await new GLTFLoader().parseAsync(bytes.buffer, '')
    const athlete = new AthleteModel(source.scene, source.animations)
    try {
      athlete.update({name: 'Athlete', appearance: {bodyType}}, {...startingCondition().levels, arms: 10, legs: 10})
      athlete.play(performanceMotion('none', 0), false)
      const position = (name: string) => {
        athlete.group.updateMatrixWorld(true)
        return athlete.model.getObjectByName(name)!.getWorldPosition(new Vector3())
      }
      const firstHead = position('head')
      const firstFoot = position('foot_l')
      assert.ok(firstHead.y < 0.7, 'the attempt starts in a push-up position')
      let previousHeight = firstHead.y
      for (let frame = 0; frame < 40; frame++) {
        athlete.tick(0.05)
        const head = position('head')
        assert.ok(head.y <= previousHeight + 0.002, 'the failed attempt never pushes back up')
        assert.ok(head.y > 0.08, 'the head stays above the floor')
        assert.ok(position('foot_l').distanceTo(firstFoot) < 0.01, 'the feet stay planted instead of flipping overhead')
        previousHeight = head.y
      }
      assert.ok(previousHeight < firstHead.y - 0.2, 'the athlete lowers and stays down before reacting')
      athlete.play(performanceMotion('none', 0), false, 1.6, true)
      const frozen = position('head')
      athlete.tick(10)
      assert.ok(position('head').distanceTo(frozen) < 0.00001, 'a paused turn holds its existing pose')
    } finally {
      athlete.dispose()
    }
  })

test('body types have distinct torso silhouettes without folded surfaces', async () => {
  const bytes = new Uint8Array(await readFile(new URL('../frontends/3d/assets/athlete.glb', import.meta.url)))
  const source = await new GLTFLoader().parseAsync(bytes.buffer, '')
  const athlete = new AthleteModel(source.scene, source.animations)
  const widths: number[][] = []
  try {
    for (const bodyType of ['male', 'female'] as const) {
      athlete.update({name: 'Athlete', appearance: {bodyType}}, startingCondition().levels)
      athlete.group.updateMatrixWorld(true)
      const bounds = [0, 0]
      athlete.model.traverse(object => {
        if (!('isSkinnedMesh' in object)) return
        const mesh = object as import('three').SkinnedMesh
        const positions = mesh.geometry.getAttribute('position')
        const p = new Vector3()
        for (let i = 0; i < positions.count; i++) {
          mesh.getVertexPosition(i, p)
          assert.ok(p.toArray().every(Number.isFinite))
          const y = positions.getY(i)
          if (y > 1.02 && y < 1.1) bounds[0] = Math.max(bounds[0]!, Math.abs(p.x))
          if (y > 0.88 && y < 0.95) bounds[1] = Math.max(bounds[1]!, Math.abs(p.x))
        }
        if (bodyType === 'female') {
          const index = mesh.geometry.index!,
            female = mesh.geometry.morphAttributes.position![2]!,
            original = [new Vector3(), new Vector3(), new Vector3()],
            shaped = [new Vector3(), new Vector3(), new Vector3()],
            edge = new Vector3(),
            before = new Vector3(),
            after = new Vector3()
          for (let i = 0; i < index.count; i += 3) {
            const vertices = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
            if (vertices.some(v => positions.getY(v) < 0.72 || positions.getY(v) > 1.5 || Math.abs(positions.getX(v)) > 0.25)) continue
            vertices.forEach((vertex, j) => {
              original[j]!.fromBufferAttribute(positions, vertex)
              shaped[j]!.fromBufferAttribute(female, vertex).add(original[j]!)
            })
            before.subVectors(original[1]!, original[0]!).cross(edge.subVectors(original[2]!, original[0]!))
            after.subVectors(shaped[1]!, shaped[0]!).cross(edge.subVectors(shaped[2]!, shaped[0]!))
            if (before.lengthSq() > 1e-14)
              assert.ok(before.dot(after) > 0, 'the torso surface never folds inside out between adjacent skin weights')
          }
        }
      })
      widths.push(bounds)
    }
    assert.ok(widths[1]![0]! < widths[0]![0]!, 'the female waist has a distinct narrower silhouette')
    assert.ok(widths[1]![1]! > widths[0]![1]!, 'the female hip silhouette is wider')
  } finally {
    athlete.dispose()
  }
})
