# CLAUDE.md

See [`AGENTS.md`](./AGENTS.md) for detailed project knowledge.

## Commands

```bash
yarn typecheck          # TypeScript check (composite build)
yarn test               # Jest across all packages
yarn lint               # oxlint (not eslint)
yarn fmt                # oxfmt (not prettier)
yarn build              # bob build for all @inox-edot/* packages
```

## Code Style

- **Package manager**: yarn 4 (never npm/pnpm)
- **Linter**: oxlint — **Formatter**: oxfmt
- **No commented-out code** — delete it
- **Named exports only**
- **No `any`/`unknown`/`as Type`/`!`/`@ts-ignore`** — define proper types
