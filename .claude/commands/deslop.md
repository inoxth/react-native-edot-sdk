# Remove AI Code Slop

Review the diff against main diligently. Ensure non-repeated, clean code that follows best practices in React and TypeScript.

## Remove

- **Redundant comments**: Trivial or obvious comments that can be easily understood from the code itself
- **Unnecessary state**: State that can be achieved with Tailwind CSS or derived from existing state
- **Defensive over-engineering**: Extra try/catch blocks or null checks abnormal for that area (especially for trusted/validated codepaths)
- **Type hacks**: `any`, `unknown` (without immediate Zod validation), `as Type`, `as unknown as X`, `!` non-null assertions, `@ts-ignore`/`@ts-expect-error`. Always define explicit types — use `interface`/`type`, union types, or generics instead. Search existing types in `packages/entities` and shared modules before creating new ones.
- **Duplicate types**: Types or interfaces that already exist elsewhere in the codebase — reuse and extend, never duplicate
- **Reinvented helpers**: Code that duplicates existing utilities in the codebase — reuse what exists
- **Style inconsistencies**: Anything that doesn't match the surrounding file's conventions

## Check for

- **Unnecessary re-renders**: Missing memoization, inline object/function definitions in JSX, or state changes that trigger excessive updates
- **Non-idiomatic patterns**: Anything that deviates from established React/TS patterns in this codebase

## Ask

Flag anything remotely weird or questionable—ask rather than assume.

## Output

Report with a 1-3 sentence summary of changes made.
