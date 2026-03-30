#!/bin/bash
# Session End Hook — Remove lock + remind about uncommitted changes

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOCK_FILE="$PROJECT_DIR/.claude/.lock"

# --- Remove Lock ---
rm -f "$LOCK_FILE"

# --- Check for uncommitted changes ---
cd "$PROJECT_DIR" || exit 0
DIRTY=$(git status --porcelain 2>/dev/null | head -5)
if [ -n "$DIRTY" ]; then
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionEnd\",\"additionalContext\":\"Uncommitted changes remain. Remember to commit.\"}}"
fi

exit 0
