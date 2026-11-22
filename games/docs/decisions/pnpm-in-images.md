# pnpm in the images

## Context

The Dockerfiles in `games/` start from the Node image and install the workspace with pnpm, and `check-games.yml` runs pnpm in the same Node image, as [checks.md](/.github/docs/checks.md) says. Node 24 brings pnpm through the Corepack it ships, but Node 25 and later ship no Corepack, so on Node 26 the images need another way to get pnpm.

- The Node 26 Alpine image has npm but no Corepack. Corepack is a separate npm package.
- When the pnpm that runs is not the version that `packageManager` in [package.json](../../package.json) names, pnpm downloads that version and runs it instead, so a pnpm of another version adds a download to every build and check.
- The pnpm project publishes the image `ghcr.io/pnpm/pnpm` with a standalone pnpm in `/opt/pnpm`, which needs no Node, and documents copying that folder into a Node image. For pnpm 12 the image has Alpine variants, tagged `<version>-alpine`; for pnpm 11 it has only Debian ones, whose pnpm does not start on Alpine. The image has no Node and no `node` user.
- `/opt/pnpm` takes 52 MB. The signaling image copies from its build stage only the installed packages into a second Node stage, so pnpm, which the build mounts, does not ship, and it runs as the `node` user of the Node image. The other images copy only the built files from their Node stage into an nginx image.
- `check-games.yml` runs the tests with `docker run`, not in a build, so it cannot use the `RUN --mount` of the Dockerfiles.

## Options

- Stay on Node 24 with the Corepack it ships, the previous setup, until Node 24's end of life on 2028-04-30. Nothing changes. Node 24 has had only maintenance releases since 2026-10-20, and Node 26 is the active LTS line.
- Corepack from npm, with `npm install -g corepack@<version>`. pnpm's version stays only in `packageManager`, and Corepack checks the `sha512` hash there. It adds a tool between npm and pnpm that Node no longer ships, its version goes into every Dockerfile and `check-games.yml`, and it stays in the signaling image unless removed.
- pnpm from npm, with `npm install -g pnpm@<version>`. No tool in between. pnpm's version goes into every Dockerfile and `check-games.yml` besides `packageManager`, npm checks the package only against the hash that the registry gives, and the signaling build has to remove pnpm again in the same step.
- The pnpm image. pnpm documents copying its `/opt/pnpm`; the Dockerfiles mount it for the commands that run pnpm instead, so it lands in no image that deploys, and `check-games.yml` copies it into a throwaway image. No npm or Corepack sits in between, and no step installs or removes pnpm. Its tag puts pnpm's version next to the Node image's tag in the same five files. Nothing checks pnpm against a hash that the repository holds: Docker trusts the tag, as it does for the Node image. It needs pnpm 12.
- pnpm installs Node itself, from `devEngines.runtime` in `package.json`, in images that start from the pnpm image. The versions of Node and pnpm live only in `package.json` and the lockfile. Node comes from pnpm's download instead of the Node image, and the signaling image ships pnpm and needs a `node` user of its own.

## Decision

The pnpm image. Against Node 24, it moves to the active LTS line. Against Corepack from npm, it needs no tool that Node stopped shipping. Against pnpm from npm, the mount needs no step that installs and removes pnpm, and the image is what pnpm documents for Docker. Against `devEngines.runtime`, the images keep Node and the `node` user of the Node image, and signaling ships no pnpm. The price is pnpm's version in the five files that name the Node image, besides `packageManager` and the lockfile, which checks.md makes change together, and trust in a tag instead of a hash in `package.json`.

## Consequences

- [package.json](../../package.json), the Dockerfiles of [signaling](../../platform/signaling/Dockerfile), [tictactoe](../../titles/tictactoe/Dockerfile), [calisthenics](../../titles/calisthenics/Dockerfile) and [index](../../index/Dockerfile), and [check-games.yml](/.github/workflows/check-games.yml).
- The `check-games.yml` item of [checks.md](/.github/docs/checks.md#the-checks).
