# CLAUDE.md

See [`AGENTS.md`](./AGENTS.md) for detailed project knowledge.

## Commands

```bash
yarn typecheck          # TypeScript check (composite build)
yarn test               # Jest across all packages
yarn lint               # oxlint (not eslint)
yarn fmt                # oxfmt (not prettier)
yarn build              # bob build for all @inoxth/* packages
```

## Code Style

- **Package manager**: yarn 4 (never npm/pnpm)
- **Linter**: oxlint — **Formatter**: oxfmt
- **No commented-out code** — delete it
- **Named exports only**
- **No `any`/`unknown`/`as Type`/`!`/`@ts-ignore`** — define proper types

## Repo-Enforced Rules

`.claude/hooks/` blocks `eslint`/`prettier`, `rm -rf`/`rm -r` (use `trash`), `git push`, `git -C`, and chained `git add && git commit`. Additional TS rules in `.claude/rules/typescript.md` (Zod imports from `zod/v4`, explicit return types on exports, `unknown` only at system boundaries with immediate `.parse()`).

## Agent skills

### Issue tracker

Issues/PRDs are tracked in **Linear** — project "React Native EDOT SDK" (team DELI Dev Tasks), via the connected Linear MCP tools. See `docs/agents/issue-tracker.md`.

### Triage labels

Five triage roles → Linear labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`) + the **Canceled** state for `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
