# `main` branch protection

## Context

One user changes this repository, through agents, and some changes are small and urgent, such as a quick temporary site. The repository is public, and its owner, the `whenparty` organization, is on GitHub's free plan, which offers rulesets for public repositories. A ruleset on `main` can require a pull request, with or without approvals, and passing status checks, and it can block force pushes and deletion of the branch. Each ruleset can let named actors, such as the repository admin role, bypass all its rules, so rules with different bypass lists need separate rulesets. The user is the only member and an owner of the organization, so their credentials can turn a ruleset off or delete it, and so can an agent that uses those credentials, such as through `gh`. [agent-ruleset-changes.md](/docs/decisions/agent-ruleset-changes.md) decides how agents are kept from that.

A push to `main` starts the deploy workflows of what it changes. [ci-checks.md](/docs/decisions/ci-checks.md) says which of them run checks first, and that `ci.yml` checks every push to `main` while the deploys do not wait for it. `ci.yml` runs only on pull requests and on pushes to `main`. Its `result` job fails when any of its checks failed or was cancelled, so it is the one check a ruleset would require, as [checks.md](/.github/docs/checks.md#skipping-and-the-result-job) says.

Two problems reach the VPS on a direct push, because no deploy checks for them before it deploys and `ci.yml` reports them only after:

- a temporary site that takes a game's name, which deploys anyway, overwrites the game's `latest` image when the site has a `Dockerfile`, and makes every deploy of `games/` fail until the site is renamed, as [names.md](/temp-sites/docs/names.md) says;
- a game host missing from `games.conf`, which deploys a game whose players cannot connect, as [game-hosts-check.md](/docs/decisions/game-hosts-check.md) says.

A commit that fails a check of `games.yml` or `infra.yml` also reaches `main` on a direct push. It deploys nothing broken, and every later deploy of that project fails until a fix follows.

## Options

- The previous setup, no rules: changes reach `main` through a pull request or a direct push. No extra step for a quick change. A direct push reaches `main` before `ci.yml` has checked it, the two problems above reach the VPS, and a commit that fails a deploy's checks stops that project's deploys. A force push can rewrite the history of `main`, and `main` can be deleted, by the user or by an agent with the user's credentials.
- A ruleset that requires a pull request with no required approval and the `result` check, with no bypass. Nothing reaches `main` before CI passes. Every change, however small, waits for a pull request and its CI run.
- The same ruleset, with the admin role allowed to bypass it. Other contributors and their agents must open pull requests. For a single user who is the admin, it adds no step and no check.
- A ruleset that requires only the `result` check. GitHub then accepts a push to `main` only of a commit whose `result` check has already passed, so that check has to run first on a pull request or another branch. Every change would still need a pull request, or `ci.yml` would have to run on every branch push.
- A ruleset that only blocks force pushes and deletion of `main`, with no bypass. Direct pushes work as before. A force push or deletion of `main` fails, even for an agent with the user's credentials, unless the ruleset is turned off first, which those credentials allow. A bypass for the admin role would let those credentials force push without that step. It does not stop a direct push that `ci.yml` later fails.

## Decision

A ruleset that only blocks force pushes and deletion of `main`, with no bypass, so neither the user's credentials nor an agent using them can force push without first turning it off. It keeps the history of `main` from an accidental force push or deletion at no cost to a quick change. A ruleset that requires a pull request and `result` would keep every problem above off `main`. Of them, only the two that reach the VPS break anything live: one game, or the deploys of `games/`, until a fix follows. A commit that fails a deploy's checks deploys nothing broken. The user fixes each with a follow-up push. While no one else has write access, that costs less than a pull request for every small change. Once someone else gets write access, a second ruleset that requires a pull request and `result`, with the admin role allowed to bypass it, becomes worth its cost.

## Consequences

- [github-setup.md](/.github/docs/github-setup.md#main-branch): the ruleset on `main`.
- [workflow-specs.md](/docs/conventions/workflow-specs.md): how the specification edit and the code reach `main`.
