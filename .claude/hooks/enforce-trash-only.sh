#!/bin/bash
# Enforce: use trash CLI, never rm -rf or rm -r (CLAUDE.md)
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Block rm -rf, rm -r, rm -Rf, rm --recursive (any destructive recursive delete)
if echo "$COMMAND" | grep -qE "rm\s+(-[a-zA-Z]*r[a-zA-Z]*|--recursive)"; then
	echo "Blocked: Use 'trash' instead of 'rm -rf' or 'rm -r'. Files moved to Trash are recoverable." >&2
	exit 2
fi

exit 0
