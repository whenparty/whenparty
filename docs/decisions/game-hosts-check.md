# Game hosts check

## Context

[game-hosts.md](/docs/decisions/game-hosts.md) puts every game on `games.when.party` and gives the games a server in `games.conf` that names that host and the former hosts of the games. A deployment of `games/` whose host is missing there falls to the wildcard server of the temporary sites. Its page loads, but the Content-Security-Policy there does not allow the signaling server, so its players cannot find each other. A host left there after its deployment stops using it sends requests to Traefik, which answers 418. A new title adds no host. The list changes when a deployment of `games/` gets or loses a host of its own, such as when the redirect of a former host is removed. Neither breaks another site.

Giving a deployment a host changes `games/`, and an agent that does it reads the documents of `games/`, not those of `infra/`. `ci.yml` runs on every pull request and every push to `main`, and a deploy does not wait for it, as [ci-checks.md](/docs/decisions/ci-checks.md) decides. `games.yml` calls `check-project-names.yml` before it deploys.

## Options

How the list stays in sync:

- A rule in the documents of `games/`, and the same rule in `infra/docs/sites.md`. Nothing new in `.github/`. A missed host shows only when players cannot connect, and the rule lives in two places.
- A step in `check-project-names.yml`, which would then also start on changes to `infra/`. No new workflow. That check then checks two unrelated things under the name of one, and `games.yml` would run the host check before every deploy.
- A workflow of its own, `check-game-hosts.yml`, that `ci.yml` calls for changes to `games/` or `infra/`, as [checks.md](/.github/docs/checks.md#the-checks) describes. One more workflow and job, and a new kind of rule in a label needs a change to the check.

Whether the deploys call it:

- `games.yml` and `infra.yml` call it before they deploy. A direct push with a missing host deploys nothing. A missing host also stops deploys that do not touch it, such as a fix to another nginx config.
- No deploy calls it. A deploy does not depend on it. A direct push with a missing host deploys a game that cannot connect, until a fix follows, and `ci.yml` reports it on that push.

## Decision

A workflow of its own that only `ci.yml` calls. A host missing from `games.conf`, or left there after no deployment uses it, fails the pull request, and the check has one purpose under its own name. A missing host breaks only the game it belongs to, so stopping every deploy for it would cost more than it protects.

## Consequences

- [check-game-hosts.yml](/.github/workflows/check-game-hosts.yml) and [ci.yml](/.github/workflows/ci.yml).
- [checks.md](/.github/docs/checks.md#the-checks).
- [games-conf.md](/infra/docs/games-conf.md).
