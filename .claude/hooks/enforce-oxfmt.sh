#!/bin/bash
# Enforce: use oxfmt, never prettier
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE "(^|\s|npx\s+)prettier(\s|$)"; then
  echo "Blocked: Use 'oxfmt' instead of 'prettier' in this project." >&2
  exit 2
fi

exit 0
