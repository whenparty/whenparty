# Games

- [platform/p2p](platform/p2p/AGENTS.md) owns browser connections and room state.
- [platform/signaling](platform/signaling/AGENTS.md) discovers peers and issues TURN credentials.
- [platform/turn](platform/turn/AGENTS.md) relays WebRTC traffic when direct connections fail.
- [titles/tictactoe](titles/tictactoe/AGENTS.md) contains the first game and its rules.

Games own match rules and results. Shared platform code owns transport and participant lifecycle. Keep title-specific decisions inside the title. Each title needs a unique `appId` and deployment name.

## Verification

Run package scripts from `games/`. Use the affected workspace's tests and typecheck. Changes to the shared P2P API require `pnpm test` and `pnpm typecheck` across the workspace. Report browser checks separately.

To run a title locally, start signaling with `pnpm --filter @whenparty/signaling start` and the title's dev script. Deployment and dependency propagation are defined by [games.yml](../.github/workflows/games.yml) and [deploy-project.yml](../.github/workflows/deploy-project.yml). Compose files identify deployed projects; libraries redeploy their dependent titles. Deployment names share a namespace with `temp-sites/projects/`.
