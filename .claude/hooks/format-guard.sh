#!/bin/sh
input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[ -n "$command" ] || exit 0
dir=$(printf '%s' "$input" | jq -r '.cwd // empty')
[ -n "$dir" ] || dir=${CLAUDE_PROJECT_DIR:-.}

. "$(dirname "$0")/repo-path.sh"

deny() {
  jq -n --arg reason "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
}

unquote() { printf '%s' "$1" | sed -e "s/^[\"']//" -e "s/[\"']\$//"; }

resolve() {
  next=$(unquote "$2")
  case $next in
    /*) printf '%s' "$next" ;;
    *) printf '%s/%s' "$1" "$next" ;;
  esac
}

cd_target() {
  from=$1
  shift
  [ "$1" = cd ] || return 1
  shift
  [ "$1" = -- ] && shift
  [ $# -gt 0 ] || return 1
  resolve "$from" "$1"
}

commit_target() {
  target=$1
  shift
  while [ $# -gt 0 ]; do
    case $1 in
      git | */git) break ;;
    esac
    shift
  done
  [ $# -gt 0 ] || return 1
  shift
  while [ $# -gt 0 ]; do
    word=$1
    shift
    case $word in
      -C)
        [ $# -gt 0 ] || return 1
        target=$(resolve "$target" "$1")
        shift
        ;;
      -C?*) target=$(resolve "$target" "${word#-C}") ;;
      -c) shift ;;
      -*) ;;
      commit)
        printf '%s' "$target"
        return 0
        ;;
      *) return 1 ;;
    esac
  done
  return 1
}

changed() {
  git -C "$root" diff -z --name-only --diff-filter=d "$base"
  git -C "$root" ls-files -z --others --exclude-standard
}

check() {
  in_repository "$1" || return 0
  root=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null) || return 0
  prettier=$root/node_modules/.bin/prettier
  if [ ! -x "$prettier" ]; then
    deny "Prettier is not installed in $root, so format-guard.sh cannot check the files of this commit. Run \`pnpm deps:cached\` in $root, then commit again."
    return 1
  fi
  base=$(git -C "$root" merge-base HEAD origin/main 2>/dev/null || git -C "$root" merge-base HEAD main 2>/dev/null)
  if [ -n "$base" ] && ! changed | tr '\0' '\n' | grep -Eq '^(\.prettierrc\.json|\.prettierignore|package\.json|pnpm-lock\.yaml)$'; then
    [ -n "$(changed | tr '\0' '\n')" ] || return 0
    out=$(cd "$root" && changed | xargs -0 "$prettier" --list-different --ignore-unknown --no-error-on-unmatched-pattern 2>&1)
  else
    out=$(cd "$root" && "$prettier" --list-different . 2>&1)
  fi && return 0
  deny "Prettier finds files of this branch that are not formatted, or cannot parse them, so the format check of CI would fail:
$(printf '%s\n' "$out" | head -c 4000)
Run node_modules/.bin/prettier --write with these files from $root, add them, then commit again."
  return 1
}

set -f
printf '%s\n' "$command" | sed -e :a -e '/\\$/N; s/\\\n//; ta' | tr ';|&' '\n\n\n' | while IFS= read -r part; do
  if next=$(cd_target "$dir" $part); then
    dir=$next
  elif target=$(commit_target "$dir" $part); then
    check "$target" || break
  fi
done
