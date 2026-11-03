import assert from 'node:assert/strict'
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {after, before, describe, test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {build} from 'vite'

const indexDir = fileURLToPath(new URL('../..', import.meta.url))
const titlesMap = fileURLToPath(new URL('../../../titles/AGENTS.md', import.meta.url))

const listedTitles = (): string[] =>
  [...readFileSync(titlesMap, 'utf8').matchAll(/^- \[[^\]]+\]\(([a-z0-9-]+)\/AGENTS\.md\)/gm)].map(match => match[1] ?? '')

type Entry = {href: string; name: string; description: string; picture: string}

const textOf = (html: string, tag: string): string =>
  (html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? '').replace(/<[^>]+>/g, '').trim()

const entriesOf = (html: string): Entry[] =>
  [...html.matchAll(/<li class="game">([\s\S]*?)<\/li>/g)].map(([, entry = '']) => ({
    href: entry.match(/<a [^>]*href="([^"]*)"/)?.[1] ?? '',
    name: textOf(entry, 'h2'),
    description: textOf(entry, 'p'),
    picture: entry.match(/<img [^>]*src="([^"]*)"/)?.[1] ?? ''
  }))

describe('catalog', () => {
  let outDir = ''
  let html = ''

  before(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'games-index-'))
    await build({root: indexDir, logLevel: 'silent', build: {outDir, emptyOutDir: true}})
    html = readFileSync(join(outDir, 'index.html'), 'utf8')
  })

  after(() => rmSync(outDir, {recursive: true, force: true}))

  test('1-1 1-2 has one entry for each game that titles/AGENTS.md lists, linked to its folder, and no other', () => {
    const games = listedTitles()
    assert.ok(games.length > 0)
    assert.deepEqual(
      entriesOf(html)
        .map(entry => entry.href)
        .sort(),
      games.map(name => `/${name}/`).sort()
    )
  })

  test('1-1 shows a name, a description of one sentence and a picture in every entry', () => {
    for (const entry of entriesOf(html)) {
      assert.match(entry.name, /\S/, entry.href)
      assert.match(entry.description, /^[^.!?]+[.!?]$/, entry.href)
      const name = entry.href.slice(1, -1)
      assert.match(entry.picture, new RegExp(`^/_assets/${name}-[^/]+\\.jpg$`), entry.href)
      assert.ok(existsSync(join(outDir, entry.picture)), `${entry.href} picture ${entry.picture}`)
    }
  })

  test('1-2 links every entry to /<name>/ on its own host', () => {
    for (const entry of entriesOf(html)) {
      assert.match(entry.href, /^\/[a-z0-9-]+\/$/)
    }
  })

  test('1-3 returns every entry in the HTML and loads no script', () => {
    assert.doesNotMatch(html, /<script/i)
    assert.doesNotMatch(html, /\son[a-z]+=/i)
  })
})
