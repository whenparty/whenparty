# `main` branch protection

## Context

One user changes this repository, through agents, and some changes are small and urgent, such as a quick temporary site. The repository is public, and its owner, the `whenparty` organization, is on GitHub's free plan, which offers rulesets for public repositories. A ruleset on `main` can require a pull request, with or without approvals, and passing status checks, and it can block force pushes and deletion of the branch. Each ruleset can let named actors, such as the repository admin role, bypass all its rules. The user is the only member and an owner of the organization, so their credentials can turn a ruleset off or delete it, and so can an agent that uses those credentials, such as through `gh`. [agent-ruleset-changes.md](/docs/decisions/agent-ruleset-changes.md) decides how agents are kept from that.

A push to `main` starts the [deploy workflows](/.github/docs/deploys.md) of what it changes. [ci-checks.md](/docs/decisions/ci-checks.md) says which of them run checks first, and that the deploys do not wait for `ci.yml`. `ci.yml` runs on pull requests, on the merge groups of a merge queue and on pushes to `main`. Its `result` job fails when any of its checks failed or was cancelled, so it is the one check a ruleset needs to require, as [checks.md](/.github/docs/checks.md#skipping-and-the-result-job) says.

Without a required check, two problems reach the VPS on a direct push, because no deploy checks for them before it deploys and `ci.yml` reports them only after:

- a temporary site that takes a game's name, which deploys anyway, overwrites the game's `latest` image when the site has a `Dockerfile`, and makes every deploy of `games/` fail until the site is renamed, as [names.md](/temp-sites/docs/names.md) says;
- a container that takes, or lacks, a name that nginx reaches for the games, which breaks their requests, as [game-names-check.md](/docs/decisions/game-names-check.md) says.

A commit that fails a check of `games.yml` or `infra.yml` reaches `main` the same way. It deploys nothing broken, and every later deploy of that [project](/docs/glossary.md#project) fails until a fix follows. Without a required check, a pull request whose `ci.yml` run failed can merge too.

`ci.yml` checks a pull request merged with `main` as it was at the time of the run, so a merge can put on `main` something that no run checked, when `main` changed in between: two pull requests that each pass alone can break `main` together. Several sessions often have pull requests open at once. A ruleset can require the branch of a pull request to be up to date with `main`, or require a merge queue. A merge queue takes the pull requests that are ready in turn, builds each on `main` and the entries ahead of it, runs the required checks there, on the `merge_group` event, and merges only what passed; it allows one merge method. Every pull request since #58 is squash-merged.

## Options

- No rules. No extra step for a quick change. The problems above reach `main`, and the user or an agent with the user's credentials can force push to `main` or delete it.
- A ruleset that only blocks force pushes and deletion of `main`, with no bypass. A force push or deletion fails until the user turns the ruleset off. The problems above still reach `main`.
- That ruleset and a second one that requires a pull request with no required approval and the `result` check, with no bypass, the previous decision. A pull request merges only after `ci.yml` passes on it. Every change, however small, waits for a pull request and its CI run.
- The same, with branches required to be up to date. A merge puts on `main` only what passed. Every pull request that falls behind `main`, as happens when several are open at once, has to take in `main` and wait for its checks again, and someone has to do that for each.
- The same, with a merge queue that squash-merges. A merge puts on `main` only what passed together with what merged before it, and nobody updates a branch by hand. Each merge waits for one more run of `ci.yml`, about 2 minutes today, and a pull request that fails in the queue leaves it and has to be added again. A merge returns before the pull request is on `main`.
- Two rulesets, with the admin role allowed to bypass the second. For a single user who is the admin, it adds no step and no check.
- A ruleset that requires only the `result` check. GitHub accepts a direct push to `main` of a commit whose `result` check passed elsewhere, so every change still needs a pull request, or `ci.yml` has to run on every branch push.

## Decision

Two rulesets on `main`, both with no bypass: the first blocks force pushes and deletion, and the second requires a pull request with no required approval, the `result` check and a merge queue that squash-merges. A pull request merges only after `ci.yml` passes on it together with `main` and the pull requests ahead of it, whoever merges it, so the problems above reach `main` only when the user allows a direct push. A pull request and its CI runs take a few minutes, which costs less than a broken game or failing deploys. Up-to-date branches would make every pull request that falls behind wait again and need someone to update it, while the queue does that itself for one more run of `ci.yml` per merge. Squash keeps the history of `main` as it has been since #58, one commit per pull request. A bypass would let the user's agents skip the checks. A second ruleset lets the user allow a direct push while force pushes stay blocked.

## Consequences

- [github-setup.md](/.github/docs/github-setup.md#main-branch): the rulesets on `main`.
- [workflow-specs.md](/docs/conventions/workflow-specs.md): how the specification edit and the code reach `main`.
