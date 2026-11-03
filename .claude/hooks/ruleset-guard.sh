#!/bin/sh
command=$(jq -r '.tool_input.command // empty')
[ -n "$command" ] || exit 0

matches() { printf '%s\n' "$1" | grep -Eiq -- "$2"; }
has_flag() { printf '%s\n' "$1" | grep -Eq -- "[[:space:]]($2)([[:space:]=]|$)"; }
writes='(-X|--method|--request)[[:space:]=]*["'"'"']?(POST|PUT|PATCH|DELETE)'

changes_rules() {
  matches "$1" 'ruleset|/protection|branchprotectionrule' || return 1
  if matches "$1" '(^|[^[:alnum:]_-])gh[[:space:]]+api([[:space:]]|$)'; then
    if matches "$1" 'graphql'; then
      matches "$1" 'mutation'
    elif matches "$1" '(-X|--method)[[:space:]=]*["'"'"']?GET'; then
      return 1
    else
      matches "$1" "$writes" || has_flag "$1" '-f|-F|--field|--raw-field|--input'
    fi
  elif matches "$1" 'api\.github\.com'; then
    matches "$1" "$writes" || has_flag "$1" '-d|-F|--data[a-z-]*|--json|--form'
  else
    return 1
  fi
}

printf '%s\n' "$command" | sed -e :a -e '/\\$/N; s/\\\n//; ta' | tr ';|&' '\n\n\n' | while IFS= read -r part; do
  if changes_rules "$part"; then
    jq -n --arg reason "This command would change a ruleset or branch protection on GitHub, which agents do not do. Stop and ask the user. .github/docs/github-setup.md describes the ruleset on main." '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
    break
  fi
done
