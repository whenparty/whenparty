common_dir() { git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null; }

in_repository() {
  [ -n "$(common_dir "$1")" ] && [ "$(common_dir "$1")" = "$(common_dir "${CLAUDE_PROJECT_DIR:-.}")" ]
}

repo_path() {
  dir=$(dirname "$1")
  while [ ! -d "$dir" ]; do dir=$(dirname "$dir"); done
  in_repository "$dir" || return 1
  root=$(git -C "$dir" rev-parse --show-toplevel) || return 1
  path=$(git -C "$dir" rev-parse --show-prefix)${1#"$dir"/}
  cd "$root" && ! git check-ignore -q -- "$path"
}
