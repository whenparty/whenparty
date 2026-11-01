#!/bin/sh
set -eu

usage="usage: run.sh [-n runs] [-m model] [-b max-budget-usd-per-run] [-s source-checkout] [task-id...]"
here=$(cd "$(dirname "$0")" && pwd)
tasks="$here/tasks.json"
runs=3
model=
budget=5
source=$(git -C "$here" rev-parse --show-toplevel)
while getopts n:m:b:s: option; do
  case $option in
    n) runs=$OPTARG ;;
    m) model=$OPTARG ;;
    b) budget=$OPTARG ;;
    s) source=$(cd "$OPTARG" && pwd) ;;
    *) echo "$usage" >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))
ids=${*:-$(jq -r '.[].id' "$tasks")}
out=$(mktemp -d "${TMPDIR:-/tmp}/doc-eval.XXXXXX")

copy_source() {
  git clone -q --shared "$source" "$1"
  [ "$(git -C "$1" symbolic-ref --short HEAD)" = main ] || git -C "$1" branch -q -f main origin/main 2>/dev/null || true
  git -C "$1" remote remove origin
  git -C "$source" diff HEAD --binary > "$1.diff"
  [ ! -s "$1.diff" ] || git -C "$1" apply --binary "$1.diff"
  git -C "$source" ls-files -z --others --exclude-standard | (cd "$source" && tar -cf - --null -T -) | tar -xf - -C "$1"
  git -C "$1" add -A
  git -C "$1" -c user.name=eval -c user.email=eval@localhost commit -q --allow-empty -m "evaluated tree"
}

run_once() {
  dir="$out/$1-$2"
  mkdir -p "$dir"
  copy_source "$dir/repo"
  prompt="$(jq -r --arg id "$1" '.[] | select(.id == $id) | .prompt' "$tasks") Nobody will answer questions in this run: make the change that the rules allow without asking, and end with what you would have asked."
  (cd "$dir/repo" && claude -p "$prompt" --output-format stream-json --verbose --no-session-persistence \
    --permission-mode acceptEdits --allowedTools "Read,Edit,Write,Glob,Grep,Bash(git diff *),Bash(git log *),Bash(git status *)" \
    --max-budget-usd "$budget" ${model:+--model "$model"}) > "$dir/transcript.jsonl" 2> "$dir/stderr" || true
  { git -C "$dir/repo" diff --name-only HEAD; git -C "$dir/repo" ls-files --others --exclude-standard; } > "$dir/changed"
  jq -s -c --arg id "$1" --argjson run "$2" --slurpfile tasks "$tasks" --rawfile changed "$dir/changed" '
    ($tasks[0][] | select(.id == $id)) as $task
    | map(select(.parent_tool_use_id == null)) as $main
    | ([$main[] | select(.type == "user") | .message.content | arrays | .[] | select(.type == "tool_result")
        | {key: .tool_use_id, value: (.is_error // false)}] | from_entries) as $failed
    | [$main[] | select(.type == "assistant") | .message.content | arrays | .[] | select(.type == "tool_use")] as $uses
    | ([$uses | to_entries[] | select((.value.name | IN("Edit", "Write", "NotebookEdit")) and $failed[.value.id] == false) | .key]
        | first // ($uses | length)) as $edit
    | ([$uses[:$edit][] | select(.name == "Read" and .input.offset == null and .input.limit == null and $failed[.id] == false)
        | .input.file_path | sub("^.*?/repo/"; "")] | unique) as $read
    | ($changed | split("\n") | map(select(. != ""))) as $changed
    | (map(select(.type == "result")) | last // {}) as $result
    | {task: $id, run: $run, edited: ($edit < ($uses | length)),
       missing: ($task.read - $read), unchanged: ($task.changed - $changed),
       cost: ($result.total_cost_usd // 0), turns: ($result.num_turns // 0),
       tokens: ([$result.usage // {} | .input_tokens, .output_tokens, .cache_creation_input_tokens, .cache_read_input_tokens] | map(. // 0) | add),
       read: $read, changed: $changed}
  ' "$dir/transcript.jsonl" >> "$dir/result.json"
}

for id in $ids; do
  jq -e --arg id "$id" 'any(.[]; .id == $id)' "$tasks" > /dev/null || { echo "unknown task: $id" >&2; exit 2; }
  run=1
  while [ "$run" -le "$runs" ]; do
    run_once "$id" "$run" &
    run=$((run + 1))
  done
  wait
done

cat "$out"/*/result.json > "$out/results.jsonl"
echo "Transcripts and results: $out"
jq -s -r '
  group_by(.task)[]
  | [.[0].task, "\(map(select(.missing == [])) | length)/\(length)", "\(map(select(.unchanged == [])) | length)/\(length)",
     "\(map(select(.edited)) | length)/\(length)", (map(.cost) | add / length * 100 | round / 100), (map(.tokens) | add / length | round)]
  | @tsv
' "$out/results.jsonl" | { printf 'task\tread\tchanged\tedited\tusd/run\ttokens/run\n'; cat; } | column -t -s "$(printf '\t')"
