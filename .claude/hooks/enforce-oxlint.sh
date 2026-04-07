#!/bin/bash
# Enforce: use oxlint, never eslint
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE "(^|\s|npx\s+)eslint(\s|$)"; then
  echo "Blocked: Use 'oxlint' instead of 'eslint' in this project." >&2
  exit 2
fi

exit 0
