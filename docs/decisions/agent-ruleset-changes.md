# Keeping agents from changing the rulesets on `main`

## Context

[main-branch-protection.md](/docs/decisions/main-branch-protection.md) puts two rulesets on `main` with no bypass: one blocks force pushes and deletion, and one requires a pull request and the `result` check. A push to `main` cannot get past them while they are on. The `gh` token of the user has the `repo` scope, and the user is an owner of the organization, so an agent that runs `gh` or `curl` as the user can turn the rulesets off or delete them, one command each, and then push to `main` directly or force push. A force push that the user wants takes the same steps, done by the user. While the user has [`main-pull-requests`](/.github/docs/github-setup.md#main-branch) off, an agent's direct push goes through too, and while both are off, its force push.

An agent reads the [workflow files](/AGENTS.md#conventions-files) before any change, but a change to a ruleset edits no file, so no [map](/docs/conventions/folder-docs.md#agentsmd) leads it to a [document](/docs/glossary.md#document) about it. Claude Code can ask the user to confirm a Bash command that matches a pattern in `settings.json`, as [configuration.md](/.claude/docs/configuration.md) describes, and a hook that runs before a tool call can deny it, as [required-reading.md](/docs/decisions/required-reading.md) says. Neither sees a command that a script file or another program runs. Other agents, such as Codex, run neither.

## Options

- A rule in the Decisions section of the [workflow](/docs/conventions/workflow.md): a change to a ruleset is a decision for the user. Every agent that reads the workflow gets it, Codex included. It works only when the agent follows it.
- Confirmations in `settings.json` for `gh api` calls that change a ruleset. The user sees each such command before it runs. A pattern matches only the text it names, so each form of the method and the endpoint needs a pattern of its own, and a confirmation can be approved without reading.
- A hook that denies commands that change a ruleset or branch protection, and whose reason tells the agent to stop and ask the user. It reads the method and the endpoint of `gh api` and `curl`, and no confirmation can approve its denial. It runs only in Claude Code, and the script has to follow new forms of these commands.
- The same hook and the rule in the workflow. Agents without hooks get the rule too. The same instruction lives in two places, and for Claude Code the rule adds nothing the hook does not enforce.
- The same hook, which also denies every `git push` to `main`, with or without force or delete options. It also covers the time while the user has a ruleset off. A push without a branch name goes to the current branch of the directory the command runs in, which the hook cannot tell from the command, so it either denies every such push that names no branch, or misses those that reach `main`.
- A `gh` token for agents without the right to change repository settings. The API refuses the change whatever the command. It is set up on each machine outside the repository, and the user then changes a ruleset in the browser or with another token.

## Decision

A hook that denies commands that change a ruleset or branch protection, without the `git push` check and without a rule in the workflow. It covers the forms that confirmation patterns in `settings.json` miss and stops an agent that does not follow a rule. While the rulesets are on, they stop an agent's force push and direct push by themselves, so the hook only has to keep agents from turning them off. The `git push` check would cover only the minutes while the user pushes to `main`, at the cost of denying ordinary pushes of other branches. A token without that right would close the remaining ways, but it needs a setup on every machine for one rare command. A rule in the workflow would reach agents without hooks only if they follow it, and it would be a second place for the stop-and-ask instruction that the hook's reason gives an agent at the moment it matters. Agents without hooks are not covered.

## Consequences

- [ruleset-guard.sh](/.claude/hooks/ruleset-guard.sh) and its entry in [settings.json](/.claude/settings.json).
- [ruleset-guard.md](/.claude/hooks/docs/ruleset-guard.md), which describes what the hook denies.
