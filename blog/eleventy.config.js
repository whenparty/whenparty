import { createHash } from "node:crypto";
import { cpSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import katex from "katex";

const postsDir = "src/posts";
const imageFile = /\.(webp|avif|jpe?g|png|svg)$/i;
const formulaLanguages = new Set(["latex", "math"]);

const contentHash = file => createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 8);
const versioned = (url, file) => `${url}?v=${contentHash(file)}`;
const escapeHtml = text => text.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function markFigures(state) {
  const tokens = state.tokens;
  for (let i = 0; i + 2 < tokens.length; i++) {
    const inline = tokens[i + 1];
    if (tokens[i].type !== "paragraph_open" || inline.type !== "inline") continue;
    const parts = inline.children.filter(t => !(t.type === "text" && t.content.trim() === ""));
    if (parts.length !== 1 || parts[0].type !== "image") continue;
    const side = parts[0].attrGet("src").endsWith("#side");
    tokens[i].meta = { figure: side ? "fig-side" : "fig-card" };
    tokens[i + 2].meta = { figure: true };
    parts[0].meta = { figure: true };
  }
}

function headingIds(slugify) {
  return state => {
    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];
      if (token.type === "heading_open" && !token.attrGet("id")) token.attrSet("id", slugify(state.tokens[i + 1].content));
    }
  };
}

function formulas(md) {
  const renderCode = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, i, options, env, self) => {
    const block = tokens[i];
    if (!formulaLanguages.has(block.info.trim().split(/\s+/)[0])) return renderCode(tokens, i, options, env, self);
    try {
      return `<div class="formula">${katex.renderToString(block.content.trim(), { displayMode: true, output: "mathml" })}</div>\n`;
    } catch (error) {
      throw new Error(`${env.page.inputPath} has a formula that KaTeX cannot render: ${error.message}`);
    }
  };
}

function figures(md) {
  const renderToken = (tokens, i, options, env, self) => self.renderToken(tokens, i, options);
  md.renderer.rules.paragraph_open = (tokens, i, ...rest) =>
    tokens[i].meta?.figure ? `<figure class="fig ${tokens[i].meta.figure}">` : renderToken(tokens, i, ...rest);
  md.renderer.rules.paragraph_close = (tokens, i, ...rest) =>
    tokens[i].meta?.figure ? "</figure>\n" : renderToken(tokens, i, ...rest);
  md.renderer.rules.table_open = () => `<div class="table-wrap"><table>\n`;
  md.renderer.rules.table_close = () => `</table></div>\n`;
  md.renderer.rules.th_open = md.renderer.rules.td_open = (tokens, i, options, env, self) => {
    const cell = tokens[i];
    const align = cell.attrGet("style")?.match(/text-align:\s*(\w+)/)?.[1];
    if (align) {
      cell.attrs = cell.attrs.filter(([name]) => name !== "style");
      cell.attrJoin("class", `align-${align}`);
    }
    return self.renderToken(tokens, i, options);
  };
  md.renderer.rules.image = (tokens, i, options, env, self) => {
    const image = tokens[i];
    const src = image.attrGet("src").replace(/#side$/, "");
    const file = path.join(path.dirname(env.page.inputPath), src);
    const alt = escapeHtml(self.renderInlineAsText(image.children, options, env));
    const title = image.attrGet("title");
    const img = `<img src="${versioned(src, file)}" alt="${alt}" loading="lazy">`;
    return image.meta?.figure && title ? `${img}<figcaption>${escapeHtml(title)}</figcaption>` : img;
  };
}

function copyPostImages(results) {
  for (const { inputPath, outputPath } of results) {
    if (!path.normalize(inputPath).startsWith(postsDir + path.sep)) continue;
    const from = path.dirname(inputPath), to = path.dirname(outputPath);
    for (const file of readdirSync(from).filter(name => imageFile.test(name))) cpSync(path.join(from, file), path.join(to, file));
  }
}

export default function (eleventyConfig) {
  const slugify = eleventyConfig.getFilter("slugify");

  eleventyConfig.amendLibrary("md", md => {
    md.core.ruler.push("figures", markFigures);
    md.core.ruler.push("heading_ids", headingIds(slugify));
    figures(md);
    formulas(md);
  });

  eleventyConfig.addPreprocessor("drafts", "md", data => {
    if (data.draft && process.env.ELEVENTY_RUN_MODE === "build") return false;
  });

  eleventyConfig.addTransform("blocked-by-csp", function (content) {
    if (this.page.outputPath?.endsWith(".html") && /<script\b|\sstyle\s*=/i.test(content)) {
      throw new Error(`${this.page.inputPath} has an inline style or script, which the Content-Security-Policy of blog.when.party blocks`);
    }
    return content;
  });

  eleventyConfig.addPassthroughCopy("src/styles.css");
  eleventyConfig.addWatchTarget(postsDir);
  eleventyConfig.on("eleventy.after", ({ results }) => copyPostImages(results));

  eleventyConfig.addFilter("newestFirst", (posts = []) => [...posts].reverse());
  eleventyConfig.addFilter("stylesUrl", () => versioned("/styles.css", "src/styles.css"));
  eleventyConfig.addFilter("postAsset", (post, file) => versioned(`${post.url}${file}`, path.join(path.dirname(post.inputPath), file)));
  eleventyConfig.addFilter("longDate", date =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date));
  eleventyConfig.addFilter("shortDate", date =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date));
  eleventyConfig.addFilter("readingMinutes", html => Math.max(1, Math.round(html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length / 220)));
  eleventyConfig.addFilter("contents", html => [...html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map(([, id, title]) => ({ id, title })));

  return {
    dir: { input: "src", includes: "_includes", output: "_site" },
    markdownTemplateEngine: false,
  };
}
