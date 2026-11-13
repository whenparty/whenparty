# Checks

[ci.yml](/.github/workflows/ci.yml) runs on every pull request and every push to `main`. Keep `ci.yml` and the checks it calls free of deploy steps and secrets, and keep their tokens read-only. [ci-checks.md](/docs/decisions/ci-checks.md) explains why.

## The checks

| Job in `ci.yml` | Workflow | Runs when a change touches | Also called by |
| --- | --- | --- | --- |
| `games` | `check-games.yml` | `games/`, except `games/platform/turn/` | `games.yml` |
| `turn` | `check-turn.yml` | `games/platform/turn/` | `games.yml` |
| `nginx` | `check-nginx.yml` | `infra/` | `infra.yml` |
| `project-names` | `check-project-names.yml` | `games/` or `temp-sites/projects/` | `games.yml` |
| `game-names` | `check-game-names.yml` | a `compose.yml` or `docker-compose.yml` anywhere, also with `.yaml`, or `infra/nginx/conf.d/games.conf` | none |
| `words` | none, a job of `ci.yml` | a Markdown file | none |

Every check other than `words` also runs when `ci.yml`, its own workflow or the deploy workflow that calls it changes. Only `games.yml` and `infra.yml` call their checks before every deploy, and a failing check stops the deploy. `temp-sites.yml` runs no check before it deploys. Markdown files never start the other checks.

- `check-games.yml` tests the packages that the `games-changes` job finds, as [games-changes.md](/.github/docs/games-changes.md) says. When one of the workflows above or `games-changes.yml` changes, it tests every package. It runs pnpm in the Node image of the Dockerfiles in `games/`. A change to that image changes `check-games.yml` and every Dockerfile in `games/` together.
- `check-nginx.yml` runs `nginx -t` on the nginx configs with throwaway self-signed certificates that it creates only for `nii.au` and `when.party`. A config that names another certificate file also needs that name in the loop of `check-nginx.yml` and in that of the tests' `proxy.sh`. Then it runs the smoke tests of the proxy, as [verification.md](/infra/docs/verification.md) says. [nginx-configs.md](/infra/docs/nginx-configs.md#checking-a-change) says how to run the same check locally.
- `check-game-names.yml` reads every `compose.yml` and `docker-compose.yml` that git tracks, also with `.yaml`, through `docker compose config`, so it reads list and mapping forms alike. It takes the names of the containers that nginx reaches for the games from the `server <name>:<port> resolve` lines of [games.conf](/infra/nginx/conf.d/games.conf). It fails when the container of `games/titles/<name>/compose.yml` is not `games-<name>` on `wp_games`, when a name from `games.conf` belongs to no container in `games/` on `wp_games`, or when another container's name, Compose service name or network alias starts with `games-` or is a name from `games.conf`. A service without `container_name` counts with Compose's default name, `<project>-<service>-1`. [game-names-check.md](/docs/decisions/game-names-check.md) explains why no deploy calls it.
- The `words` job fails when a Markdown file that the change adds or edits is over the word limit of the [writing rules](/docs/conventions/writing.md), even when the user decided to leave that document over the limit. [word-limit.md](/.claude/hooks/docs/word-limit.md) says how it counts.

## Skipping and the result job

`ci.yml` has no `paths`. Its `changes` job finds what changed, and its `games-changes` job finds the affected packages of `games/`. Every check has an `if:` on their outputs. A workflow that `paths` keeps from running leaves a required status check pending, while a job skipped by `if:` counts as passed.

The `result` job fails when any job it needs failed or was cancelled. So a ruleset on `main` that requires checks, if one is added, needs to require only `result`.

## Adding a check

A new check gets an output in the `changes` job. That output is also true when `ci.yml`, the check's own workflow or the deploy workflow that calls it changes. The check's job goes into the `needs` of `result`.
