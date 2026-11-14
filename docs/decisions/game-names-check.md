# Game names check

## Context

[games-routing.md](/docs/decisions/games-routing.md) has nginx pass `/<name>/` on `games.when.party` to the container `games-<name>` on the network `wp_games`, and the root and `signaling.when.party` to the containers of the index page and the signaling server, which `games.conf` names. nginx finds these containers in Docker's DNS, which answers for every network nginx is on, the networks of the temporary sites and of the other sites included. It finds a container by its name, its Compose service name and its network aliases, which a compose file sets freely. A container that takes one of these names can take the requests of a title, the index page or the signaling server, share them with the real one, or make one of the two deploys fail. A container in `games/` named `games-signaling` would make the signaling server reachable at `games.when.party/signaling/`, past its own limits. A title whose container has another name, or is on no network that nginx is on, answers 404.

Naming a container changes the compose file of a deployment, and an agent that does it reads the documents of its own project, not those of `games/` or `infra/`. `ci.yml` runs on every pull request and every push to `main`, and a deploy does not wait for it, as [ci-checks.md](/docs/decisions/ci-checks.md) decides, which keeps the deploys of the temporary sites free of checks. A problem that `ci.yml` finds reaches `main` only on a direct push, as [main-branch-protection.md](/docs/decisions/main-branch-protection.md) accepts.

## Options

How the names stay apart:

- The previous decision: `check-game-hosts.yml` compared the hosts in `games.conf` with the `Host` labels of `games/`. Already written. Once the games had no labels, it had nothing to compare, and it never read names.
- A rule in the documents of `games/` and of every project with a compose file. Nothing new in `.github/`. A clash shows only when a game breaks, and the rule lives in several places.
- A step in `check-project-names.yml`, which already compares the deployment names of `games/` and `temp-sites/`. No new workflow. That check then checks two things under the name of one, and has to start on changes to every compose file and to `games.conf`.
- A workflow of its own, `check-game-names.yml`, that `ci.yml` calls for changes to a compose file or to `games.conf`. One purpose under its own name. One more workflow and job.

Whether the deploys call it:

- Every deploy of a compose file that nginx can reach calls it: `games.yml`, `temp-sites.yml`, `traefik.yml`, `www.yml`, `nii-au.yml` and `infra.yml`. A direct push with a clash deploys nothing. Every temporary site then waits for a check, and a clash also stops deploys that do not touch it.
- No deploy calls it. A deploy does not depend on it. A direct push with a clash deploys, until the next push fixes it, and `ci.yml` reports it on that push.

## Decision

A workflow of its own that only `ci.yml` calls. It fails a change that gives a title's container another name or network, takes away a name that `games.conf` uses, or gives another container one of these names, as [checks.md](/.github/docs/checks.md#the-checks) says. A clash reaches the VPS only on a direct push, which the next push fixes, as for the other problems that main-branch-protection.md accepts. A check before every deploy would slow every temporary site, which ci-checks.md keeps free of checks.

## Consequences

- [check-game-names.yml](/.github/workflows/check-game-names.yml) and [ci.yml](/.github/workflows/ci.yml).
- [checks.md](/.github/docs/checks.md#the-checks).
- [names.md](/temp-sites/docs/names.md) and [hosting.md](/games/titles/docs/hosting.md).
- [games-conf.md](/infra/docs/games-conf.md) and [sites.md](/infra/docs/sites.md).
