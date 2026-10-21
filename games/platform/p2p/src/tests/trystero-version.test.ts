import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {it} from 'node:test'

interface PackageManifest {
  dependencies?: Record<string, string>
}

const trysteroVersion = (manifestPath: string) => {
  const manifest: PackageManifest = JSON.parse(readFileSync(new URL(manifestPath, import.meta.url), 'utf8'))

  return manifest.dependencies?.['@trystero-p2p/ws-relay']
}
it('uses the same Trystero version as the signaling server', () => {
  const version = trysteroVersion('../../package.json')

  assert.ok(version)
  assert.equal(version, trysteroVersion('../../../signaling/package.json'))
})
