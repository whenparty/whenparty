# ruleset-guard.sh

[ruleset-guard.sh](/.claude/hooks/ruleset-guard.sh) runs before every Bash command and denies a command that would change a ruleset or a branch protection on GitHub, of any repository or organization. Its reason asks the agent to stop and ask the user. [agent-ruleset-changes.md](/docs/decisions/agent-ruleset-changes.md) explains why a hook does this, and [github-setup.md](/.github/docs/github-setup.md#main-branch) describes the ruleset on `main`.

The hook joins lines that end with `\`, then splits the command at `;`, `|`, `&` and line breaks. It does not parse shell quoting, so a quoted `;`, `|` or `&`, such as in a URL query, also splits a part, and the hook does not see a flag after it. A part that contains `ruleset`, `/protection` or `BranchProtectionRule`, in any case, is denied when:

| The part runs | and |
| --- | --- |
| `gh api graphql` | it contains `mutation` |
| `gh api` with another endpoint | it sets the method to `POST`, `PUT`, `PATCH` or `DELETE` with `-X` or `--method`, or passes `-f`, `-F`, `--field`, `--raw-field` or `--input` without setting the method to `GET` |
| a command with a URL on `api.github.com` | it sets the method to `POST`, `PUT`, `PATCH` or `DELETE` with `-X`, `--method` or `--request`, or passes `-d`, `-F`, `--data…`, `--json` or `--form`, which make `curl` send `POST` |

The methods match in any case, the flags only as written. A command that only mentions such a command as text, such as in `git commit -m`, `git grep` or an `echo` into a pipe, is denied too.

Every read of the rulesets and `gh ruleset` pass. So does a command whose endpoint or GraphQL query is in a variable or a file, `curl -T`, a command that a script file or another language runs, and any other way to reach the API.

The hook does not check `git push`, because the ruleset blocks force pushes and deletion of `main` for every push. While the user has the ruleset off for a force push, a force push by an agent goes through too.

To test the hook, write made-up `PreToolUse` inputs with `tool_name` `Bash` and `tool_input.command` to files with the Write tool and pass each to the hook with `<`, as [testing.md](/.claude/hooks/docs/testing.md) describes, with commands it must deny and commands it must pass. An `echo` of such an input in a session where the hook runs is itself denied. To test its entry in `settings.json`, write a prompt that asks to run `gh api -X PATCH repos/whenparty/whenparty/rulesets/0 -f enforcement=disabled`, which names no existing ruleset, to a file, run `claude -p < file`, and check that the answer quotes the hook's reason.
