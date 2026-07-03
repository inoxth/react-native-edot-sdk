# Exclude the agent's own backend traffic from native tracing by collector host

Status: accepted

## Context

On iOS we install a custom `URLSessionInstrumentation` (apm-agent-ios's built-in
one is on/off only) so we can filter which `URLSession` requests get a native
span. Two things must be filtered out:

1. **The agent's own traffic to the APM Server.** apm-agent-ios routes it through
   `URLSession.shared`, which the swizzle would otherwise trace — and for the OTLP
   export path that feeds back (span → exported → another span).
2. **JS-initiated requests**, which React Native runs through `NSURLSession`; the
   JS `fetch`/`XHR` instrumentation already traces those (deduped via the
   `X-Edot-RN-Traced` header).

This ADR is about (1). The agent makes **two** classes of request to the collector,
both via `URLSession.shared`:

- **Signal export** — `POST /v1/{traces,metrics,logs}` (OTLP)
- **Central config** — `GET /config/v1/agents`, polled on a repeating
  `DispatchSourceTimer` by `CentralConfigFetcher`

Central config runs even though ADR 0001 lists it under *Removed*: that removal is
only at our SDK's **config surface**. apm-agent-ios 1.2.1 still instantiates
`CentralConfigFetcher` internally, and neither `AgentConfigBuilder` nor
`InstrumentationConfiguration` exposes a toggle to disable the poll — so it happens
regardless of what we expose.

The exclusion predicate has churned:

- **Pre-0.2.1:** `url.hasPrefix(serverUrl)` — a raw string prefix. Over-matched
  lookalike hosts and, more importantly, **missed the export URL** whenever
  apm-agent-ios stripped `:443`/`:80` from it (DEV-781).
- **0.2.1 (DEV-781):** narrowed to **host + `path.hasPrefix("/v1/")`**. Fixed the
  port-stripping miss for exports, but the `/v1/` filter **leaked the central-config
  GET** (`/config/v1/agents` is not under `/v1/`) — it surfaced as a spurious,
  recurring `GET <collectorHost>` transaction (DEV-785). A regression: the old
  prefix guard had covered that request for the explicit-port case.

The root failure mode is **enumerating the agent's endpoints** and hoping the list
is complete. It never was.

## Decision

Exclude a native `URLSession` request from tracing when its **host equals the
collector host** — nothing more. Drop the path condition entirely.

```swift
static func isCollectorHostRequest(_ request: URLRequest, collectorHost: String?) -> Bool {
  guard let collectorHost, let host = request.url?.host else { return false }
  return host.caseInsensitiveCompare(collectorHost) == .orderedSame
}
```

`collectorHost` is `URLComponents(string: serverUrl)?.host`.

Host-only is **complete by construction**: it covers signal export, central config,
and any future agent→collector endpoint without maintaining a path allowlist. It is
also robust to the agent stripping `:80`/`:443` from the export URL, because the port
is never compared.

## Considered options

- **Host + known agent paths (`/v1/` + `/config/`).** Rejected — precise but brittle;
  this is exactly the enumeration approach that produced DEV-785. Any new agent path
  leaks again and needs another patch.
- **Host + collector port.** Rejected — more surgical (spares other services on the
  same host, different port), but re-introduces the port-normalization complexity
  DEV-781 fought (must compute effective ports, `nil` → scheme default, to survive
  the `:80`/`:443` stripping) for a benefit that doesn't apply to a dedicated APM host.
- **Disable central config in the agent.** Not possible on apm-agent-ios 1.2.1 — no
  configuration hook exists.

## Consequences

- **Over-exclusion, accepted:** native (non-JS) app requests to the *same host* — any
  path, any port — are no longer traced natively. Negligible for a dedicated APM host,
  and JS-origin requests to that host are still traced in JS. This is the deliberate
  trade for completeness and robustness.
- **JS side unchanged.** Central config is a native apm-agent-ios request; it never
  passes through JS `fetch`/`XHR`, so the JS `sameOrigin` guard (DEV-782) was never
  involved. `urlUtils.ts` is untouched.
- **No Swift unit test.** `packages/react-native/ios` has no XCTest target; the change
  is a pure, host-only predicate verified by an iOS build and by reasoning, consistent
  with the rest of `ios/`.
- Shipped as patch **0.2.2**.
