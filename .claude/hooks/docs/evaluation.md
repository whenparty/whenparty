# Evaluation of reading

[evals/run.sh](/.claude/hooks/evals/run.sh) checks whether agents reach, through the maps, the documents a task needs before they edit, and whether they change the files it needs. [required-reading.md](/docs/decisions/required-reading.md) relies on its results.

Run it after changing `doc-context.sh` or the list of documents it requires, and report the results.

Each task in [evals/tasks.json](/.claude/hooks/evals/tasks.json) has an `id`, a `prompt`, the documents in `read` that the agent must read in full before its first successful edit, or by its end when it edits nothing, and the files in `changed` that the run must change. An empty `changed` checks nothing: the script does not check that a run changed no other file. Reads by subagents do not count, as doc-context.sh keeps a separate record for each subagent.

The script starts all runs of a task at the same time with `claude -p`, each in its own clone of a checkout in a temporary folder, with the checkout's uncommitted changes and untracked files, so the checkout itself stays as it is. A run accepts edits and allows only Read, Edit, Write, Glob, Grep, `git diff`, `git log` and `git status`. It refuses every other command and whatever the settings ask to confirm, such as edits of specification files, and the script adds to the prompt that nobody answers questions. A run loads the user settings and `CLAUDE.md` of whoever runs it and the checkout's `.claude/settings.json`, so the runner's own instructions can change the results. A run with Opus 5.5 cost $0.5 to $1.7.

```sh
.claude/hooks/evals/run.sh -n 5 ci-paths node-image
```

`-n` sets the runs per task, 3 by default; `-m` the model; `-b` the most one run may spend in US dollars, 5 by default; `-s` the checkout to copy, by default the one the script is in. Without task IDs it runs every task. It prints the folder with the transcripts and results and, for each task, how many runs read every document, changed every file and edited anything, with the mean cost and tokens of a run.
