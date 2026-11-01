#!/bin/sh
. "$(dirname "$0")/repo-path.sh"
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  /*.md) repo_path "$file" || exit 0 ;;
  *) exit 0 ;;
esac
[ -f "$path" ] || exit 0
limit=$(sed -n 's/.*at most \([0-9][0-9]*\) words.*/\1/p' docs/conventions/writing.md | head -n 1)
if [ -z "$limit" ]; then
  echo "word-limit.sh found no 'at most N words' in docs/conventions/writing.md" >&2
  exit 2
fi
words=$(LC_ALL=C awk '/^ *```mermaid *$/ { m = 1; k = 0; next } m && /^ *```/ { m = 0; next } m { k += NF; next } { n += NF } END { print n + m * (k + 1) }' "$path")
[ "$words" -le "$limit" ] && exit 0
jq -n --arg reason "$root/$path has $words words. A Markdown document has at most $limit words, as docs/conventions/writing.md says. When you have placed the new text, propose to the user how to bring it under the limit, as docs/conventions/workflow.md says under Decisions. If the user has already decided how to bring this document under the limit, or to leave it over the limit in this task, follow that decision and continue." '{decision: "block", reason: $reason}'
