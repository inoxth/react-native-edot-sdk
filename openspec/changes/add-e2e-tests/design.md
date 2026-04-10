## Context

4 example apps exist under `example/`. The basic example has a partial E2E test file but no Detox config. Navigation examples have no E2E infrastructure or testID props.

## Goals / Non-Goals

**Goals:**
- Every example has a working Detox E2E suite runnable with `npx detox test`
- Tests verify app launches, SDK initializes, and all demo screens are interactive
- Navigation examples test tab switching and stack push/pop
- Shared `.detoxrc.js` pattern across all examples

**Non-Goals:**
- Verifying telemetry actually reaches an EDOT backend (no server needed)
- Testing native crash recovery (requires release builds)

## Decisions

### Detox configuration: per-example `.detoxrc.js`

Each example gets its own `.detoxrc.js` with both `ios.sim.release` and `android.emu.release` configurations. iOS points to the Xcode workspace/scheme, Android points to the Gradle assembleRelease task. This keeps examples independent — you can run E2E for one without building others.

### testID naming convention: `kebab-case` with screen prefix

Pattern: `{screen}-{element}` (e.g., `home-btn-set-user`, `demos-btn-network`, `network-btn-fetch`). Prefixing with screen name avoids collisions across screens.

### Test structure: one test file per example with describe blocks per screen

Rather than many small test files, each example gets a single `e2e/app.test.js` with `describe` blocks for each screen/flow. This matches the existing basic example pattern.

### E2E test scope: UI presence + interaction, not telemetry verification

Tests verify elements are visible and tappable, and that the app doesn't crash. They don't verify spans/metrics reach a backend — that would require a running EDOT server.

## Risks / Trade-offs

- **Detox iOS build times** — each example needs a separate build (~3-5 min each) → Mitigate by only running the example being developed
- **testID maintenance** — adding testIDs to existing screens changes source files → Keep IDs minimal, only on interactive elements
- **Wix Navigation Detox quirks** — Wix Navigation has known Detox compatibility issues → May need special Detox adapter configuration
