# Workspace

The packages of `games/` form one pnpm workspace, whose folders [pnpm-workspace.yaml](../pnpm-workspace.yaml) lists. Run the scripts of the workspace and of its packages from `games/`.

## Installing

`pnpm deps:cached` installs the workspace from the lockfile, taking every package from pnpm's store on the machine and downloading none; it fails when the store lacks one, and `pnpm install --frozen-lockfile` then downloads it. [configuration.md](/.claude/docs/configuration.md) says why agents run the first without asking and the second only after asking. [pnpm-workspace.yaml](../pnpm-workspace.yaml) sets `verifyDepsBeforeRun` to `warn`, so that the first downloads nothing, as [pnpm-deps-check.md](/docs/decisions/pnpm-deps-check.md) decides.

## Checks

- `pnpm --filter <package> test` runs one package's [tests in Node](/docs/conventions/tests.md), and `pnpm --filter <package> exec node --test --test-name-pattern '\b1-3 ' 'src/**/!(*.browser).test.{ts,mjs}'` only those of its requirement `1-3`. `pnpm test` runs the Node tests of every package, and `pnpm typecheck` checks the types of every package that has a `typecheck` script; [signaling](../platform/signaling/AGENTS.md) has none.
- `pnpm test:browser` runs the browser tests of every package, as [browser-tests.md](browser-tests.md) says.
- Prettier formats the files of `games/` with the rest of the repository: `pnpm format` in the root of the repository, as [checks.md](/.github/docs/checks.md#the-checks) says.
- [games-changes.md](/.github/docs/games-changes.md) says which packages a change checks in CI.

## Running a title locally

Start signaling with `pnpm --filter @whenparty/signaling start`, then the title's dev script. Pages on `localhost` connect to that signaling at `localhost:8080` (`1-13` of [1-signaling.md](../platform/transport/docs/specs/1-signaling.md)).

The dev and preview servers of every title send the headers in [dev-headers.ts](../platform/netcode/src/dev-headers.ts) of the [netcode module](../platform/netcode/AGENTS.md), as [dev-headers.md](decisions/dev-headers.md) decides. Keep them the same as the headers of the proxy that [games-conf.md](/infra/docs/games-conf.md) says they copy, apart from the local signaling server that they add to `connect-src`.

## Builds

By default, Vite adds a modulepreload polyfill to every page that loads a module script, and [serving.md](/docs/conventions/serving.md) does not allow it, so the `vite.config.ts` of every package that builds such a page sets `build.modulePreload.polyfill` to `false`.

## Images and deploys

- [games-changes.md](/.github/docs/games-changes.md) says which [deployments](/docs/glossary.md#deployment) a change redeploys, and [deploys.md](/.github/docs/deploys.md) how they deploy.
- The deployment names of `games/` and `temp-sites/projects/` share one namespace, as [deploys.md](/.github/docs/deploys.md#deploy-projectyml) says.
- [checks.md](/.github/docs/checks.md) says what else changes with the Node and pnpm images of the Dockerfiles of `games/` and with the pnpm version in `games/package.json`.
