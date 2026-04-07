#!/bin/bash
# Enforce: never push to remote — developer handles pushing
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE "git\s+push(\s|$)"; then
  echo "Blocked: Never push to remote — the developer handles pushing." >&2
  exit 2
fi

exit 0
