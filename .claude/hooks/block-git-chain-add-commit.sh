#!/bin/bash
# Enforce: git add and git commit must be separate commands
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE "git\s+add\s.*&&.*git\s+commit"; then
  echo "Blocked: Run 'git add' and 'git commit' as separate commands, never chained with &&." >&2
  exit 2
fi

exit 0
