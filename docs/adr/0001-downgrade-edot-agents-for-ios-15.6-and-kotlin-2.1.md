# Downgrade EDOT native agents to support iOS 15.6 and Kotlin 2.1.20

Status: accepted

## Context

A customer has a **hard requirement to support iOS 15.6** and builds on stock **React Native 0.81 (Kotlin 2.1.20)**. The current SDK pins:

- `apm-agent-ios` **2.x** — requires **iOS 16** (the floor cannot be lowered while on 2.x), and
- `co.elastic.otel.android:agent-sdk` **1.5.0** — requires **Kotlin 2.3.0** (its strict `kotlin-stdlib:2.3.0` crashes the RN-default 2.1.20 compiler with an internal compiler error).

Neither minimum can be met without downgrading the native EDOT agents.

## Decision

Pin the native agents to the **newest releases that still meet the customer's minimums**:

- **iOS** → `apm-agent-ios` **1.2.1** (iOS 13; the iOS-16 bump landed in 1.3.0). This forces OpenTelemetry-Swift down from **2.x → exactly 1.13.0**.
- **Android** → `co.elastic.otel.android:agent-sdk` **1.1.0** (built with Kotlin 2.1.21; 1.2.0+ require Kotlin ≥ 2.2). Also pin `opentelemetry-api` → **1.51.0** to match the agent's bundled OpenTelemetry-Java.

To compile and run against these older agents, **remove** the SDK features whose supporting APIs don't exist in them (see Consequences). Ship as a breaking **0.2.0**.

## Considered options

- **Keep 2.x / 1.5.0; require consumers to raise Kotlin to 2.3.0 (iOS stays 16).** Rejected — cannot satisfy iOS 15.6 at all.
- **Drop the EDOT agents and build on raw OpenTelemetry.** Rejected — loses the Elastic APM value (sessions, synthetic transactions, lifecycle/crash instrumentation) the SDK exists to provide.
- **Reimplement the lost features against the old agents** (e.g. a custom `SpanProcessor` for attribute injection). Rejected for now — cost outweighs value; chose subtraction for a smaller, verifiable surface.

## Consequences

**Removed** (both platforms unless noted):

- `setUser` / `setSessionAttribute` / `setGlobalAttribute` — no span-attribute interceptor in iOS 1.2.1
- `attributeRedactions` (spans + logs) — same missing interceptor on iOS
- Central config / OpAMP / `managementUrl` / `remoteManagement`
- iOS: the custom resource-aware metrics pipeline — 1.2.1's `MeterProvider` is already resource-aware, so `recordMetric` uses the agent's global provider and app/system metrics come from the agent
- iOS tuning: `withKeepalive` / `withMemoryRebound`

**Retained:** traces, fetch/XHR auto-instrumentation, JS errors, navigation, startup, logs, `recordMetric`, sessions, `ignoreSpanNames` / `ignoreLogPatterns`, JS-side URL sanitization.

**Other effects:**

- iOS native module must migrate OpenTelemetry-Swift **2.x → 1.13.0** at the API level and rework the podspec SPM layout (unified 1.x package vs the 2.x split into `opentelemetry-swift-core` + `opentelemetry-swift`).
- iOS agent config rename: `withExportUrl` → `withServerUrl`.
- Android: agent 1.1.0 re-introduces the **`READ_PHONE_STATE`** manifest permission (optional, runtime-guarded — only used for an optional cellular network-subtype attribute). We **leave it and document the opt-out** (`tools:node="remove"`) rather than strip it from a library manifest, because the app owns its merged manifest and a library-side removal is non-idiomatic and can conflict with consumers who legitimately need it.
- Maintenance: both agents are several releases behind upstream; future fixes/features won't be available until the customer's minimums rise.
