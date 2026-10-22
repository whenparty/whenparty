#!/bin/sh
# Runs after context compaction and puts the approved requirements back into context
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
base=$(git merge-base main HEAD 2>/dev/null) || base=main
diff=$(git diff "$base" -- '*/docs/specs/*' '*/docs/PLANNED.md' 2>/dev/null)

echo "Context was compacted. Follow docs/conventions/specs.md and reread docs/specs/ of the modules you are changing before continuing."
if [ -n "$diff" ]; then
  echo "Requirement changes on this branch that main does not have yet:"
  echo "$diff"
else
  echo "This branch has no requirement changes against main."
fi
