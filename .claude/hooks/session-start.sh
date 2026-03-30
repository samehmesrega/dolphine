#!/bin/bash
# Session Start Hook — Lock + Git Safety + Ticket Sync
# 1. Creates a lock file to prevent concurrent sessions
# 2. Pulls latest changes from remote
# 3. Syncs pending tickets from DB and notifies Claude

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOCK_FILE="$PROJECT_DIR/.claude/.lock"

# --- Lock Check ---
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null | head -1)
  LOCK_TIME=$(cat "$LOCK_FILE" 2>/dev/null | tail -1)

  # Check if lock is stale (older than 4 hours)
  if [ -n "$LOCK_TIME" ]; then
    NOW=$(date +%s)
    AGE=$(( NOW - LOCK_TIME ))
    if [ "$AGE" -gt 14400 ]; then
      # Stale lock (>4h), remove it
      rm -f "$LOCK_FILE"
    else
      AGE_MIN=$(( AGE / 60 ))
      echo "Session locked by another Claude Code instance (${AGE_MIN}m ago). Remove .claude/.lock to force." >&2
      exit 2
    fi
  fi
fi

# --- Create Lock ---
SESSION_ID="${CLAUDE_SESSION_ID:-$$}"
echo "$SESSION_ID" > "$LOCK_FILE"
echo "$(date +%s)" >> "$LOCK_FILE"

# --- Git Safety ---
cd "$PROJECT_DIR" || exit 0

# Pull latest (non-destructive, won't fail if offline)
git pull --rebase --autostash 2>/dev/null || true

# --- Ticket Sync ---
PENDING_DIR="$PROJECT_DIR/agent/pending"
TICKET_OUTPUT=""

# Sync tickets from DB (silent, don't fail if DB is unreachable)
cd "$PROJECT_DIR/backend" 2>/dev/null && \
  TICKET_OUTPUT=$(npx tsx ../agent/sync-tickets.ts 2>/dev/null) || true
cd "$PROJECT_DIR"

# Count pending tickets
TICKET_COUNT=0
if [ -d "$PENDING_DIR" ]; then
  TICKET_COUNT=$(ls "$PENDING_DIR"/*.md 2>/dev/null | grep -cv '_summary.md' 2>/dev/null || echo "0")
fi

# --- Build context message ---
CONTEXT=""

# Uncommitted changes warning
DIRTY=$(git status --porcelain 2>/dev/null | head -5)
if [ -n "$DIRTY" ]; then
  CONTEXT="WARNING: Uncommitted changes detected.\\n"
fi

# Ticket notification
if [ "$TICKET_COUNT" -gt 0 ]; then
  CONTEXT="${CONTEXT}TICKETS: فيه ${TICKET_COUNT} تذكرة معلقة. اقرأ agent/pending/_summary.md لعرض التفاصيل. اسأل المستخدم: عاوز تراجع التذاكر المعلقة؟"
fi

# Output context if any
if [ -n "$CONTEXT" ]; then
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"${CONTEXT}\"}}"
fi

exit 0
