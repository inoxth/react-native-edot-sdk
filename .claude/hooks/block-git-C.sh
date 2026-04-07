#!/bin/bash
# Enforce: never use git -C <path>
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE "git\s+-C\s"; then
  echo "Blocked: Never use 'git -C <path>' — run git directly in the project directory." >&2
  exit 2
fi

exit 0
