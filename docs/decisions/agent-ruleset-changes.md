# Keeping agents from changing the ruleset on `main`

## Context

[main-branch-protection.md](/docs/decisions/main-branch-protection.md) puts a ruleset on `main` that blocks force pushes and deletion, with no bypass, so a push cannot get past it while it is on. The `gh` token of the user has the `repo` scope, and the user is an owner of the organization, so an agent that runs `gh` or `curl` as the user can turn the ruleset off or delete it with one command, and then force push. A force push that the user wants takes the same two steps, done by the user. While the user has the ruleset off, a force push by an agent goes through too.

An agent reads the workflow files before any change, but a change to the ruleset edits no file, so no map leads it to a document about it. Claude Code can ask the user to confirm a Bash command that matches a pattern in `settings.json`, as [configuration.md](/.claude/docs/configuration.md) describes, and a hook that runs before a tool call can deny it, as [required-reading.md](/docs/decisions/required-reading.md) says. Neither sees a command that a script file or another program runs. Other agents, such as Codex, run neither.

## Options

- A rule in the Decisions section of the [workflow](/docs/conventions/workflow.md): a change to the ruleset is a decision for the user. Every agent that reads the workflow gets it, Codex included. It works only when the agent follows it.
- Confirmations in `settings.json` for `gh api` calls that change a ruleset. The user sees each such command before it runs. A pattern matches only the text it names, so each form of the method and the endpoint needs a pattern of its own, and a confirmation can be approved without reading.
- A hook that denies commands that change a ruleset or branch protection, and whose reason tells the agent to stop and ask the user. It reads the method and the endpoint of `gh api` and `curl`, and no confirmation can approve its denial. It runs only in Claude Code, and the script has to follow new forms of these commands.
- The same hook and the rule in the workflow. Agents without hooks get the rule too. The same instruction lives in two places, and for Claude Code the rule adds nothing the hook does not enforce.
- The same hook, which also denies `git push` with force or delete options aimed at `main`. It also covers the time while the user has the ruleset off. A push without a branch name goes to the current branch of the directory the command runs in, which the hook cannot tell from the command, so it either denies every force push that names no branch, or misses those that reach `main`.
- A `gh` token for agents without the right to change repository settings. The API refuses the change whatever the command. It is set up on each machine outside the repository, and the user then changes the ruleset in the browser or with another token.

## Decision

A hook that denies commands that change a ruleset or branch protection, without the `git push` check and without a rule in the workflow. It covers the forms that confirmation patterns in `settings.json` miss and stops an agent that does not follow a rule. While the ruleset is on, it stops an agent's force push by itself, so the hook only has to keep agents from turning it off. The `git push` check would cover only the minutes while the user force pushes, at the cost of denying ordinary force pushes of other branches. A token without that right would close the remaining ways, but it needs a setup on every machine for one rare command. A rule in the workflow would reach agents without hooks only if they follow it, and it would be a second place for the stop-and-ask instruction that the hook's reason gives an agent at the moment it matters. Agents without hooks are not covered.

## Consequences

- [ruleset-guard.sh](/.claude/hooks/ruleset-guard.sh) and its entry in [settings.json](/.claude/settings.json).
- [ruleset-guard.md](/.claude/hooks/docs/ruleset-guard.md), which describes what the hook denies.
