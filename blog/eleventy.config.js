import {createHash} from 'node:crypto'
import {cpSync, readFileSync, readdirSync} from 'node:fs'
import path from 'node:path'
import katex from 'katex'

const postsDir = 'src/posts'
const imageFile = /\.(webp|avif|jpe?g|png|svg)$/i
const formulaLanguages = new Set(['latex', 'math'])
const audioFile = /^([a-z0-9-]+)\.[0-9a-f]{8}\.mp3$/

const contentHash = file => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8)
const versioned = (url, file) => `${url}?v=${contentHash(file)}`
const escapeHtml = text => text.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c])

function markFigures(state) {
  const tokens = state.tokens
  for (let i = 0; i + 2 < tokens.length; i++) {
    const inline = tokens[i + 1]
    if (tokens[i].type !== 'paragraph_open' || inline.type !== 'inline') continue
    const parts = inline.children.filter(t => !(t.type === 'text' && t.content.trim() === ''))
    if (parts.length !== 1 || parts[0].type !== 'image') continue
    const side = parts[0].attrGet('src').endsWith('#side')
    tokens[i].meta = {figure: side ? 'fig-side' : 'fig-card'}
    tokens[i + 2].meta = {figure: true}
    parts[0].meta = {figure: true}
  }
}

const sideFigurePartners = new Set(['paragraph_open', 'blockquote_open', 'bullet_list_open', 'ordered_list_open'])

function pairSideFigures(state) {
  const tokens = state.tokens
  for (let i = 0; i + 3 < tokens.length; i++) {
    const block = tokens[i + 3]
    if (tokens[i].meta?.figure !== 'fig-side' || tokens[i].level !== 0 || !sideFigurePartners.has(block.type) || block.meta?.figure)
      continue
    let end = i + 3
    while (tokens[end].nesting !== -1 || tokens[end].level !== block.level) end++
    const open = new state.Token('fig_pair_open', 'div', 1)
    open.attrSet('class', 'fig-pair')
    open.block = true
    const close = new state.Token('fig_pair_close', 'div', -1)
    close.block = true
    tokens.splice(end + 1, 0, close)
    tokens.splice(i, 0, open)
    i = end + 2
  }
}

function headingIds(slugify) {
  return state => {
    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i]
      if (token.type === 'heading_open' && !token.attrGet('id')) token.attrSet('id', slugify(state.tokens[i + 1].content))
    }
  }
}

function formulas(md) {
  const renderCode = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, i, options, env, self) => {
    const block = tokens[i]
    if (!formulaLanguages.has(block.info.trim().split(/\s+/)[0])) return renderCode(tokens, i, options, env, self)
    try {
      return `<div class="formula">${katex.renderToString(block.content.trim(), {displayMode: true, output: 'mathml'})}</div>\n`
    } catch (error) {
      throw new Error(`${env.page.inputPath} has a formula that KaTeX cannot render: ${error.message}`)
    }
  }
}

function figures(md) {
  const renderToken = (tokens, i, options, env, self) => self.renderToken(tokens, i, options)
  md.renderer.rules.paragraph_open = (tokens, i, ...rest) =>
    tokens[i].meta?.figure ? `<figure class="fig ${tokens[i].meta.figure}">` : renderToken(tokens, i, ...rest)
  md.renderer.rules.paragraph_close = (tokens, i, ...rest) => (tokens[i].meta?.figure ? '</figure>\n' : renderToken(tokens, i, ...rest))
  md.renderer.rules.table_open = () => `<div class="table-wrap"><table>\n`
  md.renderer.rules.table_close = () => `</table></div>\n`
  md.renderer.rules.th_open = md.renderer.rules.td_open = (tokens, i, options, env, self) => {
    const cell = tokens[i]
    const align = cell.attrGet('style')?.match(/text-align:\s*(\w+)/)?.[1]
    if (align) {
      cell.attrs = cell.attrs.filter(([name]) => name !== 'style')
      cell.attrJoin('class', `align-${align}`)
    }
    return self.renderToken(tokens, i, options)
  }
  md.renderer.rules.image = (tokens, i, options, env, self) => {
    const image = tokens[i]
    const src = image.attrGet('src').replace(/#side$/, '')
    const file = path.join(path.dirname(env.page.inputPath), src)
    const alt = escapeHtml(self.renderInlineAsText(image.children, options, env))
    const title = image.attrGet('title')
    const img = `<img src="${versioned(src, file)}" alt="${alt}" loading="lazy">`
    return image.meta?.figure && title ? `${img}<figcaption>${escapeHtml(title)}</figcaption>` : img
  }
}

const wholePositive = value => Number.isInteger(value) && value > 0

function podcastEpisodes(posts = []) {
  const episodes = posts.filter(post => post.data.audio)
  for (const post of episodes) {
    const {file, bytes, seconds} = post.data.audio
    if (file?.match(audioFile)?.[1] !== post.page.fileSlug || !wholePositive(bytes) || !wholePositive(seconds)) {
      throw new Error(
        `${post.inputPath} needs audio.file named ${post.page.fileSlug}.<8 hex digits>.mp3 and whole numbers above 0 in audio.bytes and audio.seconds`
      )
    }
  }
  return episodes.reverse()
}

function copyPostImages(results) {
  for (const {inputPath, outputPath} of results) {
    if (!path.normalize(inputPath).startsWith(postsDir + path.sep)) continue
    const from = path.dirname(inputPath),
      to = path.dirname(outputPath)
    for (const file of readdirSync(from).filter(name => imageFile.test(name))) cpSync(path.join(from, file), path.join(to, file))
  }
}

export default function (eleventyConfig) {
  const slugify = eleventyConfig.getFilter('slugify')

  eleventyConfig.amendLibrary('md', md => {
    md.core.ruler.push('figures', markFigures)
    md.core.ruler.push('side_figure_pairs', pairSideFigures)
    md.core.ruler.push('heading_ids', headingIds(slugify))
    figures(md)
    formulas(md)
  })

  eleventyConfig.addPreprocessor('drafts', 'md', data => {
    if (data.draft && process.env.ELEVENTY_RUN_MODE === 'build') return false
  })

  eleventyConfig.addTransform('blocked-by-csp', function (content) {
    if (this.page.outputPath?.endsWith('.html') && /<script\b|\sstyle\s*=/i.test(content)) {
      throw new Error(`${this.page.inputPath} has an inline style or script, which the Content-Security-Policy of blog.when.party blocks`)
    }
    return content
  })

  eleventyConfig.addGlobalData('siteUrl', 'https://blog.when.party')
  eleventyConfig.addPassthroughCopy('src/styles.css')
  eleventyConfig.addPassthroughCopy('src/podcast-cover.jpg')
  eleventyConfig.addWatchTarget(postsDir)
  eleventyConfig.on('eleventy.after', ({results}) => copyPostImages(results))

  eleventyConfig.addFilter('newestFirst', (posts = []) => [...posts].reverse())
  eleventyConfig.addFilter('podcastEpisodes', podcastEpisodes)
  eleventyConfig.addFilter('assetUrl', file => versioned(`/${file}`, `src/${file}`))
  eleventyConfig.addFilter('postAsset', (post, file) => versioned(`${post.url}${file}`, path.join(path.dirname(post.inputPath), file)))
  eleventyConfig.addFilter('longDate', date =>
    new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}).format(date)
  )
  eleventyConfig.addFilter('audioMinutes', seconds => Math.max(1, Math.round(seconds / 60)))
  eleventyConfig.addFilter('rfc2822Date', date => date.toUTCString())
  eleventyConfig.addFilter('shortDate', date =>
    new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(date)
  )
  eleventyConfig.addFilter('readingMinutes', html =>
    Math.max(
      1,
      Math.round(
        html
          .replace(/<[^>]+>/g, ' ')
          .split(/\s+/)
          .filter(Boolean).length / 220
      )
    )
  )
  eleventyConfig.addFilter('contents', html => [...html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map(([, id, title]) => ({id, title})))

  return {
    dir: {input: 'src', includes: '_includes', output: '_site'},
    markdownTemplateEngine: false
  }
}
