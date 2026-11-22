# pnpm for the packages of www and blog

## Context

`games/` is a pnpm workspace, and the root [package.json](/package.json), which holds Prettier, installs with pnpm. [www/package.json](/www/package.json) holds Playwright for the browser tests of `www/`, and [blog/package.json](/blog/package.json) holds Eleventy and KaTeX, which build the blog.

- The only install command that [settings.json](/.claude/settings.json) lets agents run without asking is `pnpm deps:cached`, which takes the packages from the lockfile and from pnpm's store on the machine alone. It asks before `pnpm add`, `pnpm install` and `pnpm i` and before an edit of any `package.json`, but not before an `npm` command, as [configuration.md](/.claude/docs/configuration.md) says.
- pnpm runs the install scripts of a package only when `allowBuilds` in `pnpm-workspace.yaml` allows them; npm runs them by default.
- pnpm's store on the machine holds each version of a package once for every folder. `www/` uses the same `@playwright/test` version as `games/`.
- npm comes with Node in the Node image and in the Playwright image. pnpm comes from the image `ghcr.io/pnpm/pnpm`, as [pnpm-in-images.md](/docs/decisions/pnpm-in-images.md) decides, so [run.sh](/www/tests/run.sh) builds an image with it and the blog's [Dockerfile](/blog/Dockerfile) names its version.

## Options

- npm in `www/` and `blog/`. npm needs no image of its own, so `run.sh` builds no image, and pnpm's version is in one file fewer. The `npm` commands that their documents would name for a change of their dependencies ask nothing first, npm runs the install scripts of their packages, and the repository keeps two package managers.
- pnpm in `www/` and `blog/`, as in `games/` and the root. `pnpm deps:cached` installs them without asking and without a download, the pnpm commands that their documents name for a change of their dependencies ask first, their packages run no install scripts unless allowed, one package manager serves the repository, and on the host one store holds the packages of every folder. `run.sh` builds an image with pnpm, and the blog's Dockerfile names pnpm's version.

## Decision

pnpm in `www/` and `blog/`. Against npm, agents install their packages offline without asking, the pnpm commands that their documents name for a change of their dependencies ask first, a package's install script does not run unless allowed, and the repository has one package manager. The price is the image that `run.sh` builds and pnpm's version in the blog's Dockerfile.

## Consequences

- [www/package.json](/www/package.json), [www/pnpm-lock.yaml](/www/pnpm-lock.yaml) and [run.sh](/www/tests/run.sh).
- [blog/package.json](/blog/package.json), [blog/pnpm-lock.yaml](/blog/pnpm-lock.yaml) and the blog's [Dockerfile](/blog/Dockerfile).
- The `deps:cached` bullet of [configuration.md](/.claude/docs/configuration.md).
