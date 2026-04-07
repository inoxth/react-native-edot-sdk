#!/bin/bash

HOOKS_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks"
cat | npx tsx "$HOOKS_DIR/skill-activation-prompt.ts" 2>/dev/null || exit 0
