# `main` branch protection

## Context

One user changes this repository, through agents, and some changes are small and urgent, such as a quick temporary site. The repository is public, and its owner, the `whenparty` organization, is on GitHub's free plan, which offers rulesets for public repositories. A ruleset on `main` can require a pull request, with or without approvals, and passing status checks, and it can block force pushes and deletion of the branch. Each ruleset can let named actors, such as the repository admin role, bypass all its rules. The user is the only member and an owner of the organization, so their credentials can turn a ruleset off or delete it, and so can an agent that uses those credentials, such as through `gh`. [agent-ruleset-changes.md](/docs/decisions/agent-ruleset-changes.md) decides how agents are kept from that.

A push to `main` starts the [deploy workflows](/.github/docs/deploys.md) of what it changes. [ci-checks.md](/docs/decisions/ci-checks.md) says which of them run checks first, and that the deploys do not wait for `ci.yml`. `ci.yml` runs on pull requests and on pushes to `main`. Its `result` job fails when any of its checks failed or was cancelled, so it is the one check a ruleset needs to require, as [checks.md](/.github/docs/checks.md#skipping-and-the-result-job) says.

Without a required check, two problems reach the VPS on a direct push, because no deploy checks for them before it deploys and `ci.yml` reports them only after:

- a temporary site that takes a game's name, which deploys anyway, overwrites the game's `latest` image when the site has a `Dockerfile`, and makes every deploy of `games/` fail until the site is renamed, as [names.md](/temp-sites/docs/names.md) says;
- a container that takes, or lacks, a name that nginx reaches for the games, which breaks their requests, as [game-names-check.md](/docs/decisions/game-names-check.md) says.

A commit that fails a check of `games.yml` or `infra.yml` reaches `main` the same way. It deploys nothing broken, and every later deploy of that [project](/docs/glossary.md#project) fails until a fix follows. Without a required check, a pull request whose `ci.yml` run failed can merge too.

A ruleset can also require the branch of a pull request to be up to date with `main`. Without that, `ci.yml` checks a pull request merged with `main` as it was at the time of the run, so a merge can put on `main` something that no run checked, when `main` changed in between.

## Options

- No rules. No extra step for a quick change. The problems above reach `main`, and the user or an agent with the user's credentials can force push to `main` or delete it.
- A ruleset that only blocks force pushes and deletion of `main`, with no bypass, the previous decision. A force push or deletion fails until the user turns the ruleset off. The problems above still reach `main`.
- That ruleset and a second one that requires a pull request with no required approval and the `result` check, with no bypass. A pull request merges only after `ci.yml` passes on it. Every change, however small, waits for a pull request and its CI run.
- The same, with branches required to be up to date. A merge puts on `main` only what passed. Every pull request that falls behind `main`, as happens when several are open at once, has to take in `main` and wait for its checks again.
- Two rulesets, with the admin role allowed to bypass the second. For a single user who is the admin, it adds no step and no check.
- A ruleset that requires only the `result` check. GitHub accepts a direct push to `main` of a commit whose `result` check passed elsewhere, so every change still needs a pull request, or `ci.yml` has to run on every branch push.

## Decision

Two rulesets on `main`, both with no bypass: the first blocks force pushes and deletion, and the second requires a pull request with no required approval and the `result` check, without requiring branches to be up to date. A pull request merges only after `ci.yml` passes on it, whoever merges it, so the problems above reach `main` only when a merge combines changes that each passed alone, or the user allows a direct push. A pull request and its CI run take a few minutes, which costs less than a broken game or failing deploys. Up-to-date branches would make every pull request that falls behind wait again, while the run of `ci.yml` on the push to `main` checks what a merge puts there. A bypass would let the user's agents skip the checks. A second ruleset lets the user allow a direct push while force pushes stay blocked.

## Consequences

- [github-setup.md](/.github/docs/github-setup.md#main-branch): the rulesets on `main`.
- [workflow-specs.md](/docs/conventions/workflow-specs.md): how the specification edit and the code reach `main`.
