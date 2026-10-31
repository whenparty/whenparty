#!/bin/sh
. "$(dirname "$0")/repo-path.sh"
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  /*.md) repo_path "$file" || exit 0 ;;
  *) exit 0 ;;
esac
[ -f "$path" ] || exit 0
limit=$(sed -n 's/.*at most \([0-9][0-9]*\) words.*/\1/p' docs/conventions/documentation.md | head -n 1)
if [ -z "$limit" ]; then
  echo "word-limit.sh found no 'at most N words' in docs/conventions/documentation.md" >&2
  exit 2
fi
words=$(wc -w < "$path" | tr -d ' ')
[ "$words" -le "$limit" ] && exit 0
jq -n --arg reason "$root/$path has $words words. A Markdown document has at most $limit words, as docs/conventions/documentation.md says. Before you continue, propose to the user how to split it, as docs/conventions/workflow-changes.md says under Decisions. If the user has already decided how to split this document, or not to split it in this task, follow that decision and continue." '{decision: "block", reason: $reason}'
