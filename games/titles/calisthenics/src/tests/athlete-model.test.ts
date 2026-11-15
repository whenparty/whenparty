import assert from 'node:assert/strict'
import {test} from 'node:test'
import {SkinnedMesh, Vector3} from 'three'
import {startingCondition} from '../core/index.ts'
import {performanceMotion} from '../frontends/3d/presentation.ts'
import {bodyTypes, positionOf, withAthleteModel} from './athlete-fixtures.ts'

test('a frozen motion holds its pose while time passes', () =>
  withAthleteModel(athlete => {
    athlete.update({name: 'Athlete'}, startingCondition().levels)
    athlete.play(performanceMotion('none', 0), false, 1.6, true)
    const frozen = positionOf(athlete, 'head')
    athlete.tick(10)
    assert.ok(positionOf(athlete, 'head').distanceTo(frozen) < 0.00001)
  }))

test('body types have distinct torso silhouettes without folded surfaces', () =>
  withAthleteModel(athlete => {
    const widths: number[][] = []
    for (const bodyType of bodyTypes) {
      athlete.update({name: 'Athlete', appearance: {bodyType}}, startingCondition().levels)
      athlete.group.updateMatrixWorld(true)
      const bounds = [0, 0]
      athlete.model.traverse(object => {
        if (!(object instanceof SkinnedMesh)) return
        const positions = object.geometry.getAttribute('position')
        const p = new Vector3()
        for (let i = 0; i < positions.count; i++) {
          object.getVertexPosition(i, p)
          assert.ok(p.toArray().every(Number.isFinite))
          const y = positions.getY(i)
          if (y > 1.02 && y < 1.1) bounds[0] = Math.max(bounds[0]!, Math.abs(p.x))
          if (y > 0.88 && y < 0.95) bounds[1] = Math.max(bounds[1]!, Math.abs(p.x))
        }
        if (bodyType === 'female') {
          const index = object.geometry.index!,
            female = object.geometry.morphAttributes.position![2]!,
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
  }))
