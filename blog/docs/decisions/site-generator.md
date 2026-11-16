# Site generator

## Context

A post is a Markdown file with front matter and images, and posts can run to several thousand words with tables and pictures. The pages share one layout, the list of posts changes with every post, and each image needs a URL that changes with its content, as [serving.md](/docs/conventions/serving.md) requires. The pictures go in two ways, across the text or at its side, chosen per picture. The site is static and served by nginx like `www/` and `nii-au/`. The other code of the repository runs on Node, and the Dockerfiles in `games/` build in a Node Alpine image.

## Options

- Pages written by hand in HTML, as in `www/`. No package dependency and no build step. Every post repeats the layout, the list of posts and the `?v=` of each image are kept by hand, and posts are not Markdown.
- Eleventy, one dev dependency, `@11ty/eleventy`. It reads Markdown with front matter and Nunjucks layouts without plugins, exposes its Markdown parser in its config, so the cards and heading ids need no more packages, and writes plain HTML without client scripts. It runs on Node in the build stage of the image.
- Astro. It builds Markdown into static pages too, and adds components and image processing. It brings a component framework and the Vite bundler, which pages without client code do not use.
- Hugo. A single Go binary with Go templates, fast on large sites. It needs an image of its own in the build stage, outside the Node tools of the repository.

## Decision

Eleventy. Against pages by hand, it keeps posts in Markdown and makes the list and the `?v=` of every image follow from the files. Against Astro and Hugo, it builds the pages with one dependency, `@11ty/eleventy`, on the Node the repository already uses.

## Consequences

- [eleventy.config.js](../../eleventy.config.js) and [package.json](../../package.json).
- [posts.md](../posts.md) and [site.md](../site.md).
