Take the instructions in your @CLAUDE.md file and turn them into
deterministic Claude Code hooks in this project directory.

Not all the instructions will be deterministic: only do the ones you can,
such as instructions to use one CLI command over another, or disallowing
certain CLI commands.

Hooks should be added to `.claude/settings.json` under the `hooks` key,
using the `PreToolUse` event with a `Bash` matcher.

Use separate bash scripts in `.claude/hooks/` for running the hooks:

```sh
#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -q "drop table"; then
  echo "Blocked: dropping tables is not allowed" >&2
  exit 2
fi

exit 0
```

First, confirm with the user which hooks will be created.

Second, implement the hooks.

Third, provide the user with instructions to test the newly created hooks
(by restarting Claude Code).
