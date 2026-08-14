# Issue tracker: Linear

Issues and PRDs for this repo live in **Linear**. Use the connected **Linear MCP tools** (`mcp__claude_ai_Linear__*`) for all operations — there is no CLI.

## Scope

- **Project**: EDOT SDK Multi Platform
- **Team**: DELI Dev Tasks (key `DEV`)

Resolve the project and team **by name** at runtime (`list_projects` / `list_teams` with a `query`) — the MCP is already authenticated to the right workspace, so no IDs, workspace slug, or URLs are hardcoded here. Always create issues under the **DELI Dev Tasks** team, attached to the **EDOT SDK Multi Platform** project.

## Conventions

- **Create an issue**: `save_issue` with `title`, `description` (markdown), `team: "DELI Dev Tasks"`, `project: "EDOT SDK Multi Platform"`. `save_issue` both creates and updates — omit `id` to create.
- **Title prefix**: every issue title starts with `[React-Native]` — the project spans multiple platforms, so the prefix identifies which one. Apply it on create; don't strip it on update.
- **Read an issue**: `get_issue` by id or `DEV-<n>` identifier.
- **List issues**: `list_issues` filtered by `project: "EDOT SDK Multi Platform"` (and `team`/`label`/`state` as needed).
- **Comment**: `save_comment` with the issue id and `body`.
- **Labels**: discover with `list_issue_labels` (team `DELI Dev Tasks`); set via `save_issue` `labels`. Labels are created lazily — if a triage label doesn't exist yet, create it with `create_issue_label`.
- **Workflow state**: discover with `list_issue_statuses` (team `DELI Dev Tasks`); set via `save_issue` `state` (`Todo`, `In Progress`, `In Review`, `Done`, `Canceled`).
- **Close**: set state to `Done`; for "won't fix", set state to `Canceled`.

## When a skill says "publish to the issue tracker"

Create a Linear issue via `save_issue` under team **DELI Dev Tasks**, project **EDOT SDK Multi Platform**, with the title prefixed `[React-Native]`.

## When a skill says "fetch the relevant ticket"

Use `get_issue` (by `DEV-<n>` identifier or id).
