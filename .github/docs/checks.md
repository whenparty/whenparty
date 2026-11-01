# Checks

[ci.yml](/.github/workflows/ci.yml) runs on every pull request and every push to `main`. Keep `ci.yml` and the checks it calls free of deploy steps and secrets, and keep their tokens read-only. [ci-checks.md](/docs/decisions/ci-checks.md) explains why.

## The checks

| Job in `ci.yml` | Workflow | Runs when a change touches | Also called by |
| --- | --- | --- | --- |
| `games` | `check-games.yml` | `games/`, except `games/platform/turn/` | `games.yml` |
| `turn` | `check-turn.yml` | `games/platform/turn/` | `games.yml` |
| `nginx` | `check-nginx.yml` | `infra/` | `infra.yml` |
| `project-names` | `check-project-names.yml` | `games/` or `temp-sites/projects/` | `games.yml` |
| `words` | none, a job of `ci.yml` | a Markdown file | none |

Every check other than `words` also runs when `ci.yml`, its own workflow or the deploy workflow that calls it changes. Only `games.yml` and `infra.yml` call their checks before every deploy, and a failing check stops the deploy. `temp-sites.yml` runs no check before it deploys. Markdown files never start the other checks.

- `check-games.yml` gets the changed package folders from the `changes` job and tests them with the packages that depend on them, as [games-check-scope.md](/docs/decisions/games-check-scope.md) decides. It runs pnpm in the Node image of the Dockerfiles in `games/`. A change to that image changes `check-games.yml` and every Dockerfile in `games/` together.
- `check-nginx.yml` runs `nginx -t` on the nginx configs with throwaway self-signed certificates that it creates only for `nii.au` and `when.party`. A config that names another certificate file also needs that name in the loop of `check-nginx.yml`. [nginx-configs.md](/infra/docs/nginx-configs.md#checking-a-change) says how to run the same check locally.
- The `words` job fails when a Markdown file that the change adds or edits is over the word limit of the [writing rules](/docs/conventions/writing.md), even when the user decided to leave that document over the limit. [word-limit.md](/.claude/hooks/docs/word-limit.md) says how it counts.

## Skipping and the result job

`ci.yml` has no `paths`. Its first job, `changes`, finds what changed, and every check has an `if:` on that job's output. A workflow that `paths` keeps from running leaves a required status check pending, while a job skipped by `if:` counts as passed.

The `result` job fails when any job it needs failed or was cancelled. So a branch rule on `main`, if one is added, needs to require only `result`.

## Adding a check

A new check gets an output in the `changes` job. That output is also true when `ci.yml`, the check's own workflow or the deploy workflow that calls it changes. The check's job goes into the `needs` of `result`.
