# What the hooks share

The hooks in `.claude/hooks/` are POSIX shell scripts that read the hook input as JSON on stdin. They need `git` and `jq`; without either they do nothing. They act only on files of this repository and its worktrees that git does not ignore. [repo-path.sh](/.claude/hooks/repo-path.sh) is not a hook: the hooks source it to find the path of a file in the repository and to tell whether git ignores it. Claude Code cuts any text a hook adds to the context at 10,000 characters.
