#!/bin/bash
# Pre-Tool-Use Hook — Guard edits on protected files
# Blocks edits to .env files, credentials, and production configs

INPUT=$(cat)

# Parse JSON using node (jq not available on Windows)
TOOL_NAME=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).tool_name||'')}catch{console.log('')}})" 2>/dev/null)
FILE_PATH=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log((j.tool_input&&j.tool_input.file_path)||'')}catch{console.log('')}})" 2>/dev/null)
COMMAND=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log((j.tool_input&&j.tool_input.command)||'')}catch{console.log('')}})" 2>/dev/null)

# --- Protect .env and credential files ---
if [ -n "$FILE_PATH" ]; then
  case "$FILE_PATH" in
    *.env|*.env.*|*credentials*|*secrets*)
      echo "BLOCKED: Cannot edit protected file: $FILE_PATH" >&2
      exit 2
      ;;
  esac
fi

# --- Block dangerous bash commands ---
if [ "$TOOL_NAME" = "Bash" ] && [ -n "$COMMAND" ]; then
  # Extract only the first command (before any string arguments)
  # This prevents false positives from text inside commit messages etc.
  FIRST_WORD=$(echo "$COMMAND" | awk '{print $1}')

  # Block rm -rf on project root or important dirs
  if [ "$FIRST_WORD" = "rm" ] && echo "$COMMAND" | grep -qE "^rm\s+(-rf|-fr)\s+(/|\.\.|\*/|c:)" 2>/dev/null; then
    echo "BLOCKED: Dangerous rm command detected" >&2
    exit 2
  fi

  # Block force push to main (only actual git push commands)
  if [ "$FIRST_WORD" = "git" ] && echo "$COMMAND" | grep -qE "^git\s+push\s+.*--force.*\s+(main|master)" 2>/dev/null; then
    echo "BLOCKED: Force push to main/master is not allowed" >&2
    exit 2
  fi

  # Block git reset --hard (only actual git reset commands, not text in commit messages)
  if [ "$FIRST_WORD" = "git" ] && echo "$COMMAND" | grep -qE "^git\s+reset\s+--hard" 2>/dev/null; then
    echo "BLOCKED: git reset --hard is dangerous. Use git stash instead." >&2
    exit 2
  fi
fi

exit 0
