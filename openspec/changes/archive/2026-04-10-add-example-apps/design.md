## Context

The SDK has a single `example/` app that demonstrates basic APIs. Developers need reference implementations for each navigation integration and for manual tracing/metrics. All examples should be self-contained React Native apps sharing the same `.env`-based configuration pattern.

## Goals / Non-Goals

**Goals:**
- Provide 4 standalone example apps demonstrating different integration patterns
- Each example uses `.env` for EDOT server config (url, service name, secret token)
- Each example is a yarn workspace member buildable independently
- Demonstrate real-world usage patterns developers can copy

**Non-Goals:**
- Production-ready app architecture (these are minimal demos)
- E2E test coverage for all examples (only basic example keeps existing Detox tests)
- Expo managed workflow support (expo-router example uses bare workflow)

## Decisions

### Directory structure: `example/<name>/` with independent apps

Each example is a full React Native app under `example/`. The root workspace config uses `example/*` glob.

**Rationale:** Separate apps avoid dependency conflicts between navigation libraries (React Navigation vs Wix vs Expo Router). Each can have its own Metro config and native projects.

### Rename existing example to `example/basic/`

Move the current `example/` contents to `example/basic/` and expand it with manual tracing and metrics demos.

**Rationale:** Reuses existing working app as the foundation for the basic example, avoiding duplicate setup.

### Shared `.env.example` pattern

Each example has:
- `.env.example` — template with placeholder values
- `.env` — gitignored, developer fills in real values
- `react-native-dotenv` for build-time env access

**Rationale:** Consistent with existing example app which already uses `react-native-dotenv` and `@env` imports.

### Navigation examples extend basic features

Each navigation example includes the same core demos (tracing, metrics, logs, user/session management) plus its navigation-specific integration.

**Rationale:** Developers see the full picture in one app rather than piecing together multiple examples.

## Risks / Trade-offs

- **Maintenance burden** — 4 example apps means 4 sets of native projects to keep updated → Mitigate by keeping examples minimal and using shared package versions
- **Disk/CI size** — Each example adds iOS Pods and Android Gradle → Mitigate by gitignoring build artifacts and node_modules
- **React Navigation version coupling** — Example pins a specific version → Document minimum version in README
