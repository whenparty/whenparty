#!/bin/sh
. "$(dirname "$0")/repo-path.sh"
input=$(cat)
field() { printf '%s' "$input" | jq -r "$1 // empty"; }
session=$(field .session_id)
[ -n "$session" ] || exit 0
agent=$(field .agent_id)
states="${TMPDIR:-/tmp}/whenparty-doc-context"
state="$states/$session${agent:+-$agent}"

root_docs() { git ls-files -- AGENTS.md docs/conventions/workflow.md docs/conventions/workflow-specs.md docs/conventions/workflow-checks.md docs/conventions/writing.md; }
maps() { for folder; do git ls-files -- "$folder/AGENTS.md"; done; }
existing() { while read -r doc; do [ -f "$doc" ] && echo "$doc"; done; }
unread() { existing | while read -r doc; do grep -qxF "$root/$doc" "$state/read" || echo "$doc"; done; }
as_list() { sed "s|^|- $root/|"; }

if [ "$(field .hook_event_name)" = SessionStart ]; then
  rm -rf "$states/$session" "$states/$session"-*
  cwd=$(field .cwd)
  in_repository "${cwd:-.}" || exit 0
  root=$(git -C "${cwd:-.}" rev-parse --show-toplevel) && cd "$root" || exit 0
  echo "Before you edit any file in the repository, read these documents in full with the Read tool. Edits are denied until you have read them, and after compaction you read them again. Editing a file in a folder with its own AGENTS.md also needs the AGENTS.md files on its path and those of the @whenparty/* packages it uses, and you get their list when you first read or edit a file there. The maps in these files link to the other documents a task needs."
  root_docs | existing | as_list
  echo
  set -- '*/docs/specs/*' '*/docs/PLANNED.md'
  if ! base=$(git merge-base main HEAD 2>/dev/null); then
    echo "There is no main branch to compare the requirements of this branch with."
  elif ! diff=$(git diff "$base" -- "$@"); then
    echo "git diff failed, so the requirement changes of this branch are unknown."
  elif [ -z "$diff" ]; then
    echo "This branch has no requirement changes against main."
  elif [ "$(printf '%s' "$diff" | wc -c)" -le 8000 ]; then
    echo "Requirement changes on this branch that main does not have yet:"
    echo "$diff"
  else
    echo "This branch changes requirements that main does not have yet. Read them with: git diff $base -- '$1' '$2'"
  fi
  exit 0
fi

file=$(field '.tool_input.file_path // .tool_input.notebook_path')
case "$file" in
  /*) repo_path "$file" || exit 0 ;;
  *) exit 0 ;;
esac

folders=
unit=
rest=${path%/*}
[ "$rest" = "$path" ] && rest=
while [ -n "$rest" ]; do
  part=${rest%%/*}
  folder=${folder:+$folder/}$part
  folders="$folders $folder"
  [ -n "$(git ls-files -- "$folder/AGENTS.md")" ] && unit=$folder
  [ "$rest" = "$part" ] && rest= || rest=${rest#*/}
done

packages() {
  [ -f "$unit/package.json" ] || return 0
  jq -r '(.dependencies // {}) + (.devDependencies // {}) | keys[] | select(startswith("@whenparty/"))' "$unit/package.json" |
  while read -r dependency; do
    git ls-files -- '*package.json' | while read -r manifest; do
      [ "$(jq -r .name "$manifest")" = "$dependency" ] && dirname "$manifest"
    done
  done
}

local_docs() { [ -z "$unit" ] || maps $folders $(packages); }

mkdir -p "$state"
touch "$state/read" "$state/announced"

case "$(field .hook_event_name)" in
  PreToolUse)
    missing=$({ root_docs; local_docs; } | sort -u | grep -vxF "$path" | unread)
    [ -n "$missing" ] || exit 0
    reason=$(echo "Read these documents in full with the Read tool before you edit $root/$path, then repeat the edit:"; echo "$missing" | as_list)
    jq -n --arg reason "$reason" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
    ;;
  PostToolUse)
    case "$(field .tool_name)" in
      Write) echo "$root/$path" >> "$state/read" ;;
      Read) [ -n "$(field '.tool_input.offset')$(field '.tool_input.limit')" ] || echo "$root/$path" >> "$state/read" ;;
    esac
    [ -n "$unit" ] || exit 0
    grep -qxF "$root/$unit" "$state/announced" && exit 0
    echo "$root/$unit" >> "$state/announced"
    missing=$(local_docs | sort -u | unread)
    [ -n "$missing" ] || exit 0
    context=$(echo "Before you edit files in $root/$unit/, also read these documents in full with the Read tool:"; echo "$missing" | as_list)
    jq -n --arg context "$context" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $context}}'
    ;;
esac
