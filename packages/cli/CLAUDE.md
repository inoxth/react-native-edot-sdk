# CLAUDE.md

See [`AGENTS.md`](./AGENTS.md) for detailed package knowledge.

## Commands

```bash
yarn build              # tsc -p tsconfig.build.json
yarn lint               # oxlint src/
yarn typecheck          # tsc --noEmit
yarn test               # jest
```

## Code Style

- Node.js only — no React Native dependencies
- Uses Commander.js for CLI parsing
