# Screenshot updates

## Context

The browser tests of `www/` compare storyboards of the takeoff with approved PNG files in git, as [screenshot-tests.md](screenshot-tests.md) decides, and a pull request shows the old and new images side by side. Every intended change to how the page looks needs new approved screenshots. Browsers draw some pixels differently on another system or processor: Docker on an Apple Silicon Mac runs arm64, and GitHub's runners x86. `maxDiffPixels` in [playwright.config.ts](../../playwright.config.ts) lets 100 pixels of a screenshot differ.

A ruleset on `main` requires a pull request and the `result` check of `ci.yml`, as [main-branch-protection.md](/docs/decisions/main-branch-protection.md) decides. A required check does not count a run started by hand (`workflow_dispatch`), as GitHub's "Troubleshooting required status checks" says, and GitHub runs a workflow by hand only when its file is on `main`, and then on any branch. The checks have no secrets and read-only tokens, as [ci-checks.md](/docs/decisions/ci-checks.md) decides. A commit that a workflow pushes with its own token to a pull request starts runs that wait for someone with write access to approve them. On pull requests #29 and #38 these runs expired unapproved after about 5 and 4 minutes, leaving the commit with no checks. A push with a GitHub App's token or a personal access token starts workflows as usual.

## Options

- Locally, in the same Docker image. No CI run and no workflow with write access. On an Apple Silicon Mac they differ from what CI draws by a few pixels, which every CI run then spends from the 100 of `maxDiffPixels`.
- In CI, by a workflow run by hand on the branch. The same kind of machine as the check. It needs its file on `main` and write access, and its commit waits for an approval like the commit of the label workflow below.
- In CI, by a workflow that a label on the pull request starts and that commits them with its own token, the previous decision. The screenshots reach the pull request without anyone downloading them. Its commit cannot merge until someone approves its runs in time or pushes again, and a hand-run trigger in `ci.yml` would not help, because a required check does not count such a run.
- The same, pushing with a GitHub App's token or a personal access token. Its commit is checked as usual. A token with write access sits in the secrets of a workflow that runs the code of the branch.
- In CI, by `check-www.yml`: when a test fails, it takes the screenshots again and uploads them, and an agent commits them. No write access in CI and no extra workflow. Each change to how the page looks fails one run, and the agent takes an extra step.

## Decision

`check-www.yml` makes the new screenshots on its own machine type, and an agent commits them. The required check then compares images from its own processor and spends none of the 100 pixels of `maxDiffPixels` on arm64. A failing run and an extra step cost less than approving the runs of a workflow's commit within minutes, and keep a token that can push to the repository out of the checks.

## Consequences

- [playwright.config.ts](../../playwright.config.ts) and [tests.md](../tests.md).
- [check-www.yml](/.github/workflows/check-www.yml) and [checks.md](/.github/docs/checks.md).
