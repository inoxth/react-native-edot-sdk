# Feature parity after the EDOT agent downgrade (DEV-429)

Audit of what changed, per platform, after pinning the native agents to the
newest releases that meet the customer minimums (iOS 15.6 / stock RN 0.81,
Kotlin 2.1.20):

- **iOS** — `apm-agent-ios` 2.x → **1.2.1**, OpenTelemetry-Swift → **1.13.0**.
- **Android** — `co.elastic.otel.android:agent-sdk` 1.5.0 → **1.1.0**, `opentelemetry-api` 1.60.1 → **1.51.0**.

Scope: capabilities **missing or behaving differently** vs the pre-downgrade
SDK. Verified by code inspection of `epic/edot-agent-downgrade`. Runtime
confirmation (what each agent emits on a real build) is tracked in DEV-423.

Legend: ✅ works · ⚠️ works with caveat · ❌ removed/not emitted · ➖ n/a

---

## 1. Public JS API (bridge methods)

All 14 TurboModule methods are implemented on both platforms. Differences:

| API | iOS | Android | Note |
|---|---|---|---|
| `initialize`, `startSpan`, `startClientSpan`, `endSpan`, `getTraceparent`, `setSpanAttribute*`, `recordSpanException`, `emitLog`, `reportJsException`, `setTrackingConsent` | ✅ | ✅ | full parity |
| `getCurrentSessionId` | ✅ real id (`SessionManager.instance.session`) | ⚠️ returns `""` | **pre-existing** asymmetry — `agent-sdk` exposes no public session accessor (1.1.0 **and** 1.5.0). Not a downgrade regression. |
| `recordMetric` | ⚠️ exports via the **legacy** meter (`createIntCounter`/`createDoubleMeasure`); attribute values are **string-only labels** | ✅ typed (`long`/`double`/`bool`) | iOS regression vs the pre-downgrade stable-meter path (OTel-swift 2.x). Values are stringified. |

### Removed entirely (both platforms) — DEV-424/425/426, already merged

| Removed API / config | Issue |
|---|---|
| `setUser` / `clearUser` / `setSessionAttribute` / `setGlobalAttribute` / `removeGlobalAttribute` + `userAttributes` / `globalAttributes` | DEV-424 |
| `attributeRedactions` (span/log `drop`/`dropPattern`/`mask`/`maskPattern`) | DEV-425 |
| `managementUrl` / `ios.useOpAMP` / `ios.remoteManagement` | DEV-426 |

Reason: iOS 1.2.1 has no span-attribute interceptor; the older agents lack the
central-config builder APIs. No replacement.

---

## 2. Config options — declared vs actually consumed

JS-only options (`instrumentNetworkRequests`, `instrumentJsErrors`,
`instrumentAppStartup`, `appStateTracking`, `tracePropagationTargets`,
`ignoreUrls`, `urlSanitizer`, `graphqlUrls`) are handled entirely in the JS
layer and are **unaffected** by the downgrade.

Native-relevant options:

| Option | iOS consumes? | Android consumes? | Status |
|---|---|---|---|
| `serverUrl`, `serviceName` (+`ios`/`android` override), `serviceVersion`, `deploymentEnvironment` | ✅ | ✅ | OK |
| `secretToken`, `apiKey`, `exportProtocol`, `sessionSamplingRate` | ✅ | ✅ | OK |
| `trackingConsent`, `debug`, `disableAgent` | ✅ | ✅ | OK |
| `ignoreSpanNames`, `ignoreLogPatterns` | ✅ (`addSpanFilter`/`addLogFilter`) | ✅ (exporter interceptors) | OK |
| `enableAppMetricInstrumentation` | ❌ **not read** | ✅ | **iOS no-op** — iOS app-launch metrics come from the agent's built-in `AppMetrics` |
| `enableSystemMetrics` | ✅ | ✅ | re-wired on iOS (DEV-428) to gate `EdotSystemMetrics` |
| `ios.enableCrashReporting` / `enableURLSessionInstrumentation` / `enableViewControllerInstrumentation` / `enableLifecycleEvents` | ✅ | ➖ | OK (iOS-only) |
| `ios.persistencePreset` | ➖ **removed** — was dead config (never applied; persistence block removed in DEV-422), deleted in this change | ➖ | removed |
| `android.diskBufferingEnabled` | ➖ | ✅ | OK (Android-only) |

---

## 3. Native instrumentation / telemetry

| Capability | iOS before | iOS after | Android |
|---|---|---|---|
| Traces (manual + fetch/XHR), W3C propagation | ✅ | ✅ | ✅ |
| JS errors / crashes (OTel log records) | ✅ | ✅ | ✅ |
| Sessions (`session.id` on signals) | ✅ | ✅ | ✅ |
| Synthetic transaction parent for orphan HTTP spans | ✅ (`ElasticSpanProcessor`) | ✅ | ➖ |
| Native crash reporting | ✅ | ✅ (`enableCrashReporting`) | ✅ |
| App launch / responsiveness metrics | ✅ our `EdotAppMetrics.swift` | ✅ via the agent's built-in `AppMetrics` (active on 1.2.1; removed upstream only in 2.0.0) — names TBD → DEV-430 | ✅ (`EdotAppMetrics.kt`) |
| `system.cpu.usage` / `system.memory.usage` | ✅ (`EdotSystemMetrics.swift`) | ✅ **re-added** (DEV-428) — `EdotSystemMetrics.swift` rewritten to legacy observable gauges on the agent's meter provider | ✅ (`EdotSystemMetrics.kt`) |
| Resource-aware MeterProvider + central-config metric gating | ✅ (`EdotMeterProviderFactory` / `EdotCentralConfigMetricExporter`) | ❌ **removed** | ➖ (agent provider is resource-aware) |
| `recordMetric` typed attributes | ✅ (stable meter) | ⚠️ string-only labels | ✅ |

→ iOS app/system metrics + the `recordMetric` typing loss are tracked in **DEV-428**.

---

## 4. Agent capability deltas (verified against upstream release notes)

**iOS `apm-agent-ios` 1.2.1 → 2.x** (releases v1.3.0, v1.4.0, 2.0.0, 2.0.1):

- **v1.3.0** — added **signal/span interceptors** (PR #283) + OTel-swift 1.17.0. This is the span-attribute interceptor our user/session/global + `attributeRedactions` features needed → unavailable in 1.2.1 (confirms DEV-424/425). The iOS-16 floor also arrives from 1.3.0 on, which is why 1.2.1 is the newest 15.6-capable release.
- **v1.4.0** — **OpAMP** support → `ios.useOpAMP` / central config unavailable in 1.2.1 (confirms DEV-426).
- **2.0.0** — OTel-swift **2.x** (stable metrics API → typed metric attributes; 1.2.1's legacy meter is why `recordMetric` is string-label-only) **and removed the agent's own `AppMetrics`** "due to incompatibility with the new OpenTelemetry-swift metrics."
  - ⚠️ **Key for DEV-428:** `AppMetrics` was removed only in **2.0.0**, so **1.2.1 still ships the agent's built-in `AppMetrics`** (MetricKit-based). Our `EdotAppMetrics`/`EdotSystemMetrics` were the 2.x workaround for exactly that removal. On 1.2.1 the agent's AppMetrics runs again (we don't disable it) → iOS is likely **not** metric-less. Open question (DEV-423): which metric names it emits, and whether `system.cpu.usage`/`system.memory.usage` are covered — those gauges were **our** addition and are the genuine iOS loss.

**Android `apm-agent-android` (`agent-sdk`) 1.1.0 → 1.5.0** (releases 1.2.0, 1.3.1, 1.4.0, 1.5.0):

- **1.1.0 (ours)** already has the instrumentation adapter, session-sample-rate setter, and disk-buffering setter — everything our SDK uses.
- **1.2.0** — central config via OpAMP (tech preview); min Kotlin source compat 1.9. We dropped the central-config surface (DEV-426), so no loss.
- **1.3.1** — **removed `READ_PHONE_STATE`** (we're on 1.1.0, which still declares it → documented opt-out, DEV-421); "close instrumentations on agent close."
- **1.4.0 / 1.5.0** — upstream OTel dependency bumps (1.5.0's transitive `kotlin-stdlib` 2.3.0 is the ICE we avoid by staying on 1.1.0).
- **No new auto-instrumentation** in 1.2–1.5 that our SDK would be missing; **no public session-id accessor** added → `getCurrentSessionId` returning `""` stands.

**Net:** Android 1.1.0 has **no meaningful capability loss** for our SDK (central config was removed by us, READ_PHONE_STATE is documented, sessions were never exposed). Every iOS loss maps exactly to a feature that landed in 1.3.0+/2.x and was intentionally dropped — **except** the metrics nuance above, which needs DEV-423 to settle.

---

## 5. Triage (recommendations — decisions are HITL)

| Gap | Recommendation |
|---|---|
| iOS app metrics | Covered by the agent's built-in `AppMetrics` on 1.2.1 — names to confirm/reconcile in DEV-430. |
| iOS `system.cpu.usage` / `system.memory.usage` | ✅ **Re-added** (DEV-428) — `EdotSystemMetrics` rewritten to legacy observable gauges on the agent's meter provider; `enableSystemMetrics` re-wired on iOS. |
| `ios.persistencePreset` dead config | ✅ **Removed** — deleted from types/config/validation/README + iOS `preInitialize` param (it did nothing on 1.2.1); added to the 0.2.0 changeset. |
| `enableAppMetricInstrumentation` / `enableSystemMetrics` no-op on iOS | Tie to the DEV-428 decision: if metrics re-added, re-wire on iOS; else document Android-only. |
| `recordMetric` string-only labels (iOS) | **Document** the limitation; optionally stringify-with-type-hint. Revisit if iOS agent ever exposes a stable meter. |
| Sessions asymmetry (Android `""`) | Pre-existing; **document**. Re-enable when `agent-sdk` exposes a public session accessor. |
| Agent changelog deltas | **Review** upstream notes (web) — file follow-ups only if a concrete capability gap is found. |

---

## 6. Net summary

- **No NEW unintended public-API breakage** beyond DEV-424/425/426 — every removed method is accounted for, and each maps to a feature that only exists in apm-agent-ios 1.3.0+/2.x.
- **Android 1.1.0: no meaningful capability loss** for our SDK.
- **iOS metrics:** app-launch metrics come from the agent's built-in `AppMetrics` (active on 1.2.1); `system.cpu.usage`/`system.memory.usage` **re-added** (DEV-428) via legacy observable gauges on the agent's meter provider, so they're cross-platform again. Metric-name reconciliation → DEV-430.
- **`ios.persistencePreset` — removed** (was dead config; deleted in this change + added to the 0.2.0 changeset).
- **Documentation items:** `recordMetric` iOS string-label limitation; `enableAppMetricInstrumentation`/`enableSystemMetrics` are Android-only; Android `getCurrentSessionId` returns `""`.
- **Agent changelog review: done** (see §4).
