# Workspace

The packages of `games/` form one pnpm workspace, whose folders [pnpm-workspace.yaml](../pnpm-workspace.yaml) lists. Run the scripts of the workspace and of its packages from `games/`.

## Checks

- `pnpm --filter <package> test` runs one package's [tests in Node](/docs/conventions/tests.md), and `pnpm --filter <package> exec node --test --test-name-pattern '\b1-3 ' 'src/**/!(*.browser).test.{ts,mjs}'` only those of its requirement `1-3`. `pnpm test` runs the Node tests of every package, and `pnpm typecheck` checks the types of every package that has a `typecheck` script; [signaling](../platform/signaling/AGENTS.md) has none.
- `pnpm test:browser` runs the browser tests of every package, as [browser-tests.md](browser-tests.md) says.
- `pnpm format` formats the code of every package. Run it before committing.
- [games-changes.md](/.github/docs/games-changes.md) says which packages a change checks in CI.

## Running a title locally

Start signaling with `pnpm --filter @whenparty/signaling start`, then the title's dev script. Pages on `localhost` connect to that signaling at `localhost:8080` (`1-13` of [1-signaling.md](../platform/transport/docs/specs/1-signaling.md), [signaling-url.ts](../platform/p2p/src/signaling-url.ts)).

The dev and preview servers of every title send the headers in `src/dev-headers.ts` of the [p2p module](../platform/p2p/AGENTS.md). Keep them the same as the headers of the proxy that [games-conf.md](/infra/docs/games-conf.md) says they copy, apart from the local signaling server that they add to `connect-src`.

## Dependencies

Signaling and p2p take `@trystero-p2p/ws-relay` from the catalog in `pnpm-workspace.yaml`, so both speak the same Trystero protocol. Change its version there and update `pnpm-lock.yaml` in the same commit.

## Images and deploys

- [games-changes.md](/.github/docs/games-changes.md) says which [deployments](/docs/glossary.md#deployment) a change redeploys, and [deploys.md](/.github/docs/deploys.md) how they deploy.
- The deployment names of `games/` and `temp-sites/projects/` share one namespace, as [deploys.md](/.github/docs/deploys.md#deploy-projectyml) says.
- [checks.md](/.github/docs/checks.md) says what else changes with the Node and pnpm images of the Dockerfiles of `games/` and with the pnpm version in `games/package.json`.
