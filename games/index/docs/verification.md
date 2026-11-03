# Verification

Run these from `games/`:

- `pnpm --filter @whenparty/index test` builds the page and checks requirements `1-1` to `1-3` on the built HTML.
- `pnpm --filter @whenparty/index typecheck` checks the types of the tests and the Vite config.
- `sh index/tests/1-catalog.smoke.sh` builds the image, runs it in Docker, and checks that it answers 404 for a path it has no file for (`1-4`) and sets no cookie (`1-3`). CI does not run it, so run it after a change to the `Dockerfile` or to how Vite names files.
- `pnpm --filter @whenparty/index build` and then `pnpm --filter @whenparty/index preview` serve the built page locally.
