# word-limit.sh

[word-limit.sh](/.claude/hooks/word-limit.sh) runs after Edit or Write of a Markdown file. It reads the word limit from the phrase "at most N words" in the [writing rules](/docs/conventions/writing.md) and counts words with a copy of the command they give. When the phrase is missing, it exits with code 2, so the agent sees the error. When the file has more words than the limit, it returns `decision: "block"`. Its reason asks the agent, once the new text is placed, to propose how to bring the document under the limit, or to follow what the user has already decided about it. The edit itself stays.

The `words` job of [ci.yml](/.github/workflows/ci.yml) reads the limit and counts with the same copy for the Markdown files that each pull request or push to `main` adds or changes. A change to the phrase or the command in the writing rules needs the same change in the hook and in the job. [checks.md](/.github/docs/checks.md#the-checks) says when the job fails.
