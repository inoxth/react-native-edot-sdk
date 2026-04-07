---
paths: "**/*.{ts,tsx}"
---

## TypeScript Rules

### Naming Conventions

- PascalCase for interfaces, types, classes, components
- camelCase for functions, variables, methods
- SCREAMING_SNAKE_CASE for constants
- kebab-case for file names

### Type Safety — No Compiler Overrides

**Always define explicit types.** Every variable, parameter, and return value should have a clear, specific type — use `interface` or `type` to describe the shape of your data. Never leave types implicit when the compiler can't infer them precisely.

**Before defining a new type or interface**, search the codebase (`packages/entities`, shared types, existing feature modules) for an existing one. Reuse and extend existing types — never duplicate.

Banned (enforced by Biome + code review):

- **`any`** — never use. Always define a proper `interface` or `type` that describes the actual data shape. If the shape varies, use union types or generics.
- **`unknown`** — never use as a lazy escape hatch. Define the actual type. Only acceptable at true system boundaries (JSON parsing, external API responses) where the shape is genuinely not known at compile time — and in those cases, immediately validate with Zod `.parse()` to get a concrete type.
- **`as Type`** / **`as unknown as Type`** — use type narrowing (`if`, `in`, `instanceof`), Zod `.parse()`, or `satisfies` instead.
- **`!` (non-null assertion)** — use optional chaining `?.`, explicit `if` checks, or assertion functions.
- **`@ts-ignore`** / **`@ts-expect-error`** — banned without explanation.

**Exception:** `as const` is allowed (narrows types, doesn't widen).

For detailed fix patterns and examples, use the `/typescript-type-safety` skill.

- Use explicit return types on exported functions

### Imports

- Group imports: external → internal → relative
- Use named exports over default exports
- No circular dependencies

### Async/Await

- Always handle promise rejections
- Route handlers: use `Result.tryPromise` + `TaggedError` from `better-result`
- try/catch reserved for: middleware (observe-and-rethrow), fire-and-forget background tasks
- Avoid floating promises — use `.catch()` for intentional fire-and-forget
