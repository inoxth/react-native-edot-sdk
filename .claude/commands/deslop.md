# Remove AI Code Slop

Review the diff against `main` diligently. Ensure non-repeated, clean code that follows best practices for the touched language(s): TypeScript, React Native, Swift, and Kotlin.

## Remove (all languages)

- **Redundant comments**: trivial or obvious comments that restate what the code already says
- **Commented-out code**: delete it
- **Defensive over-engineering**: extra try/catch, null/nil checks, or validation on already-validated/trusted code paths
- **Reinvented helpers**: code that duplicates existing utilities in the repo — reuse what exists
- **Style inconsistencies**: anything that doesn't match the surrounding file's conventions

## TypeScript / React Native (`packages/*/src/`)

- **Type hacks**: `any`, `unknown` (without immediate runtime/Zod validation), `as Type`, `as unknown as X`, `!` non-null assertions, `@ts-ignore`/`@ts-expect-error`. Define explicit `interface`/`type`/union/generic types instead.
- **Duplicate types**: search shared modules under `packages/*/src` before adding a new one — reuse and extend.
- **Default exports**: repo is named-exports-only.
- **Inline arrow functions / object literals** in JSX props on hot paths (e.g. `FlatList` `renderItem`, memoized children) — they retrigger renders.
- **Missing `keyExtractor` / stable keys** on list items.
- **Web-only APIs** (`window`, `document`, `localStorage`, `fetch` polyfills) — RN doesn't have them.
- **Instrumentation setup functions that don't return a teardown** (per `packages/react-native/CLAUDE.md`).

## Swift (`packages/react-native/ios/`)

- **Force unwraps** `!`, **force casts** `as!`, **force tries** `try!`, implicitly unwrapped optionals on stored properties — use `guard let` / `if let` / `try?`.
- **Empty `do { } catch { }`** blocks that silence errors.
- **Defensive `nil` checks** on non-optional values.
- **`print()` left in** — use `os_log` with the existing `co.elastic.edot` subsystem.
- **`var` where `let` works**, redundant `self.`, unnecessary type annotations.
- **New `OSLog` instances** when a file-scope one already exists.

## Kotlin (`packages/react-native/android/src/`)

- **`!!` non-null assertions**; unsafe `as` casts (use `as?` + null handling).
- **`lateinit var`** where a constructor parameter or `by lazy { }` fits.
- **Empty `try { } catch (_: Throwable) { }`** blocks that swallow errors.
- **Defensive null checks** on platform types already validated upstream.
- **`println()` left in** — use the existing logger / `Log` tag pattern.
- **`var` where `val` works**; mutable collections where immutable suffice.
- **Re-implementing `?.let` / `takeIf` / `require`** patterns the codebase already uses (see `EdotReactNativeAgent.kt`).

## Check for

- **Unnecessary re-renders** (RN): missing memoization, inline objects/functions in JSX, state changes that trigger excessive updates.
- **Native module bridge**: `NSNull` / null payloads not handled at the JS boundary.
- **Non-idiomatic patterns** vs the surrounding file's conventions in any of the four languages.

## Ask

Flag anything remotely weird or questionable — ask rather than assume.

## Output

Report with a 1–3 sentence summary of changes made.
