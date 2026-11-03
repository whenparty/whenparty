# Checks

[ci.yml](/.github/workflows/ci.yml) runs on every pull request and every push to `main`. Keep `ci.yml` and the checks it calls free of deploy steps and secrets, and keep their tokens read-only. [ci-checks.md](/docs/decisions/ci-checks.md) explains why.

## The checks

| Job in `ci.yml` | Workflow | Runs when a change touches | Also called by |
| --- | --- | --- | --- |
| `games` | `check-games.yml` | `games/`, except `games/platform/turn/` | `games.yml` |
| `turn` | `check-turn.yml` | `games/platform/turn/` | `games.yml` |
| `nginx` | `check-nginx.yml` | `infra/` | `infra.yml` |
| `project-names` | `check-project-names.yml` | `games/` or `temp-sites/projects/` | `games.yml` |
| `game-hosts` | `check-game-hosts.yml` | `games/` or `infra/` | none |
| `words` | none, a job of `ci.yml` | a Markdown file | none |

Every check other than `words` also runs when `ci.yml`, its own workflow or the deploy workflow that calls it changes. Only `games.yml` and `infra.yml` call their checks before every deploy, and a failing check stops the deploy. `temp-sites.yml` runs no check before it deploys. Markdown files never start the other checks.

- `check-games.yml` gets the changed package folders from the `changes` job and tests them with the packages that depend on them, as [games-check-scope.md](/docs/decisions/games-check-scope.md) decides. It runs pnpm in the Node image of the Dockerfiles in `games/`. A change to that image changes `check-games.yml` and every Dockerfile in `games/` together.
- `check-nginx.yml` runs `nginx -t` on the nginx configs with throwaway self-signed certificates that it creates only for `nii.au` and `when.party`. A config that names another certificate file also needs that name in the loop of `check-nginx.yml`. [nginx-configs.md](/infra/docs/nginx-configs.md#checking-a-change) says how to run the same check locally.
- `check-game-hosts.yml` compares the hosts in the Traefik `rule` labels of `games/*/*/compose.yml` with the `server_name` entries of [games.conf](/infra/nginx/conf.d/games.conf), and fails when a host is in one but not the other. It reads the labels both as list items and as a mapping. It pools the names of both servers in `games.conf` and does not check which server names a host. It reads rules made of at least one `Host` and any `PathPrefix`, joined by `&&` or `||` without brackets, and fails on any other rule. [game-hosts-check.md](/docs/decisions/game-hosts-check.md) explains why no deploy calls it.
- The `words` job fails when a Markdown file that the change adds or edits is over the word limit of the [writing rules](/docs/conventions/writing.md), even when the user decided to leave that document over the limit. [word-limit.md](/.claude/hooks/docs/word-limit.md) says how it counts.

## Skipping and the result job

`ci.yml` has no `paths`. Its first job, `changes`, finds what changed, and every check has an `if:` on that job's output. A workflow that `paths` keeps from running leaves a required status check pending, while a job skipped by `if:` counts as passed.

The `result` job fails when any job it needs failed or was cancelled. So a ruleset on `main` that requires checks, if one is added, needs to require only `result`.

## Adding a check

A new check gets an output in the `changes` job. That output is also true when `ci.yml`, the check's own workflow or the deploy workflow that calls it changes. The check's job goes into the `needs` of `result`.
