# Formulas

## Context

A post can hold formulas, such as the trust equation in `influence-without-authority`. A Markdown file marks a formula as a code block marked `latex`, as that post does, or `math`, as GitHub does. The Content-Security-Policy of `blog.when.party`, in the `blog.when.party` row of [2-2](/infra/docs/specs/2-headers.md), allows styles only from files of the site and Google Fonts, so it blocks `style` attributes; [separate-host.md](separate-host.md) gives the blog this policy without `'unsafe-inline'`. The build fails on a page with a `style` attribute or a `<script`, as [site.md](../site.md) says, and the pages use the fonts of the device. Eleventy exposes its Markdown parser, as [site-generator.md](site-generator.md) says, so the build can render a formula. Safari, Firefox and Chrome 109 and later draw MathML, the markup for formulas in HTML, with the math font of the system. The numbers below were measured with KaTeX 0.19.1, Temml 0.14.0 and `mathjax-full` 3.2.1.

## Options

- KaTeX at build time with MathML output. One dev dependency, `katex`. The trust equation becomes 320 bytes of MathML without `style` attributes, and the pages get no script, stylesheet or font. Only `\pmb` and `\fcolorbox` put a `style` attribute into the MathML, so the build fails on them. The look depends on the math font of each system, such as STIX Two Math on macOS and iOS and Cambria Math on Windows.
- KaTeX at build time with HTML output. The same look on every system. The trust equation gets 22 `style` attributes, so the Content-Security-Policy would need `'unsafe-inline'` for styles, and the build's check for ` style=` would have to go. The site would also serve KaTeX's stylesheet and its 20 fonts.
- KaTeX in the browser, from the site's own files. The same look on every system, and the policy allows it, because the script sets styles through the DOM, not through attributes. Each page with a formula loads a 273 KB script and a 25 KB stylesheet before compression, and the fonts its formulas use from KaTeX's 20. It shows the formula only after the script runs, and the build's check for `<script` would have to go.
- Temml at build time. A library written for MathML output, whose stylesheets can give every system the same math font as files the pages load. It puts `style="display:block math;"` on each formula shown on its own line, so the build would have to remove the attribute from each one.
- MathJax at build time with SVG output. The same look on every system without fonts. `mathjax-full` takes 40 MB in the build stage, and the SVG of each formula has a `style` attribute, which the build would have to remove from each one.
- The LaTeX left as code. No dependency and no rewriting, but readers see markup such as `\frac{C + R + I}{S}`.
- A formula as plain text, such as `T = (C + R + I) / S`. No dependency. A fraction or a subscript becomes a line of symbols, and each formula needs rewriting by hand.

## Decision

KaTeX with MathML output. For every formula without `\pmb` or `\fcolorbox`, its output passes the Content-Security-Policy and the build check as they are, and it adds no files to the pages. Against Temml, it needs no step that rewrites its output. Against LaTeX left as code or plain text, a fraction looks like a fraction. A slightly different look on each system is the cost. A math font served from the site and set in `styles.css` would remove it at the cost of one more file, and the policy allows that.

## Consequences

- [eleventy.config.js](../../eleventy.config.js), [package.json](../../package.json) and the `.formula` rule of [styles.css](../../src/styles.css).
- [posts.md](../posts.md) and [site.md](../site.md).
