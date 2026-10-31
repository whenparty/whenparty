# Games

`games/` is a [project](/docs/glossary.md#project) of [subprojects](/docs/glossary.md#subproject): the platform in `platform/` and each game in `titles/`. The platform consists of three [modules](/docs/glossary.md#module):

- [platform/p2p](platform/p2p/AGENTS.md) owns browser connections and room state.
- [platform/signaling](platform/signaling/AGENTS.md) discovers peers and issues TURN credentials.
- [platform/turn](platform/turn/AGENTS.md) relays WebRTC traffic when direct connections fail.

[titles/](titles/AGENTS.md) holds the games and lists them.

The platform, each of its modules and each title need a [specification](/docs/conventions/specs.md).

Games own match rules and results. Shared platform code owns transport and participant lifecycle.

## Verification

Run package scripts from `games/`. `pnpm --filter <package> test` runs one workspace's tests; `pnpm test` and `pnpm typecheck` run the whole workspace.

To run a title locally, start signaling with `pnpm --filter @whenparty/signaling start` and the title's dev script. Deployment and dependency propagation are defined by [games.yml](/.github/workflows/games.yml) and [deploy-project.yml](/.github/workflows/deploy-project.yml). Compose files identify [deployments](/docs/glossary.md#deployment); libraries redeploy their dependent titles. Deployment names share a namespace with `temp-sites/projects/`.
