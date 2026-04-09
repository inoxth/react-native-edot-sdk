# CLAUDE.md

See [`AGENTS.md`](./AGENTS.md) for detailed package knowledge.

## Commands

```bash
yarn build              # bob build (commonjs + module + typescript)
yarn lint               # oxlint src/
yarn typecheck          # tsc --noEmit
yarn test               # jest
```

## Code Style

- Named exports only
- No React Native imports in instrumentation files beyond what's needed
- Each instrumentation setup function returns a teardown function
