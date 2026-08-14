# Mint a Request Transaction for every traced request

Status: accepted

## Context

Kibana's service map drew no edge from the Android service to the hosts it called, while
the same app on iOS drew it. Diagnosed on the Flutter fleet (DEV-1231) and confirmed here
(DEV-1232).

At OTLP intake, apm-data classifies a span as a **transaction** when
`root || kind == Server || kind == Consumer`, and as a **span** otherwise. Only the span
branch computes `span.destination.service.resource` — the transaction branch has no
destination at all. That field is what the service map draws an external edge from, what
the Dependencies view lists, and what APM Server aggregates span-destination metrics from.

`fetch.ts` and `xhr.ts` created their request spans with no parent
(`startClientSpan(name, attrs, null, …)`), so every traced request arrived as a root, was
recorded as a transaction that called nothing, and left no edge to draw.

iOS was never doing anything different — it was being rescued. `ElasticSpanProcessor.onEnd`
in apm-agent-ios 1.2.1 treats any parentless span carrying `http.url` as an HTTP span,
builds a second span around it, reparents the real span beneath it and exports both. The
request span stops being a root on the way out, so it lands as an exit span with a
destination. `co.elastic.otel.android:agent-sdk` 1.1.0 has no equivalent processor, so
Android kept the roots.

## Decision

The SDK gives every traced request a parent of its own — a **Request Transaction** —
rather than relying on an agent to supply one. `instrumentation/httpSpans.ts` owns it;
`fetch.ts` and `xhr.ts` call it:

```ts
transactionSpanId = startRequestTransaction(spanName);
spanId = startClientSpan(spanName, attrs, transactionSpanId, HTTP_INSTRUMENTATION_NAME);
```

It is a **deliberate copy of the parent `ElasticSpanProcessor` manufactures** on iOS — the
same values on every axis this SDK can match — so both platforms and both fleets emit one
shape. This mirrors the Flutter plugin's ADR-0016, which is the same decision taken there:

| | The iOS agent's parent | The Request Transaction | Flutter |
|---|---|---|---|
| Name | the child's | the same | the same |
| Kind | the child's, so `client` | `client` | `client` |
| Attributes | `type`, `session.id`, both added natively to every span | none of its own | none of its own |
| Status | none | none | none |
| Events | none | none | none |
| Start / end | the child's exactly | **brackets the child** — the bridge owns the clock | the child's exactly |

Nothing is ever recorded on the Request Transaction. Two properties look like oversights and
are not:

- **It carries no `http.url`.** A parentless span with that key is precisely what the iOS
  agent wraps, so a transaction carrying it would be wrapped in turn and one request would
  export three spans. It carries no `screen.name` / `screen.id` either — screen
  correlation stays on the exit span.
- **It carries no status, and neither does the request span.** See below: failure is said
  with an event, not a status, on the whole request path.

### Failure is an exception event, not a span status

No span on the request path carries a status. A 4xx or 5xx records an `exception` event on
the **request span** — `exception.type` is the status code so a query can group by it,
`exception.message` the reason phrase (`response.statusText` / `xhr.statusText`, falling
back to `HTTP <code>`) — and so do a timeout, a network failure and a cancellation, told
apart by their type (`TimeoutError`, `NetworkError`, `AbortError`). That is what
apm-agent-ios's own `URLSessionInstrumentation` does for the traffic it instruments, so a
request reads the same however it was made, and it matches the Flutter plugin's ADR-0016.

This is why `endSpan` gained a status sentinel. Unset is **not** the same as `Ok`: intake
derives `event.outcome` from `http.status_code` only for a span that carries no status, so
ending a 5xx exit span `Ok` would report it as a success. `endHttpSpan` therefore passes
`-1`, which `EdotReactNativeModuleImpl.endSpan` and `EdotReactNative.swift:endSpan` handle
by ending the span without calling `setStatus`.

The 400 floor is shared by both transports (`FAILURE_STATUS_FLOOR` in `httpSpans.ts`).
`fetch.ts` previously used `response.ok`, which made a `304` a failure; XHR used `>= 400`.
They now agree with each other and with Flutter.

It applies on **both platforms, with no platform branch.** The SDK's parent lands first, so
`ElasticSpanProcessor` finds nothing to rescue and iOS keeps exporting two spans per request
rather than three. Requests excluded from tracing (the collector host per ADR-0003,
`ignoreUrls`) mint nothing — the ignore check runs first.

W3C propagation is unchanged: `getTraceparent` still reads the request span, so the callee's
parent is the exit span, not the Request Transaction.

### Where RN cannot match Flutter

One axis remains:

- **Timestamps.** `startSpan` / `startClientSpan` / `endSpan` take no time arguments; the
  native side reads the clock. The Request Transaction therefore starts a bridge call before
  the request span and ends one after it, where Flutter's plugin owns timestamps (its
  ADR-0005) and mints the pair from a single clock reading. Worth less than it sounds: on
  Android, `agent-sdk`'s `ClockExporterGateManager` rewrites the timestamps of any span
  created before its clock sync lands, from a native reading taken *per span*, so even
  Flutter's single-reading pair arrives nanoseconds apart there — its Seam 2 asserts
  duration on Android rather than equality. Duration is what both fleets can hold onto.

## Considered options

- **Keep relying on `ElasticSpanProcessor`.** Rejected — it is iOS-only, which is the bug,
  and it is an implementation detail of a pinned agent version we don't control.
- **Mirror the rescue natively in the Android module.** Rejected — reparenting after the
  fact is more machinery than not creating a root in the first place, it must be maintained
  per platform, and it leaves the two platforms fixed by two different mechanisms.
- **Say failure with a span status, on the request span or on the transaction.** Implemented
  first, in both variants, and rejected: the iOS agent reports the traffic it instruments
  with an exception event, so a status made the SDK describe the same request differently
  from the agent embedded next to it — which is what this ADR exists to end. Failing the
  transaction also reads oddly against an agent parent that carries nothing at all. The cost
  of dropping it is real and stated below.
- **End the spans `Ok` instead of unset, to avoid touching native code.** Rejected — it is
  worse than either alternative. `Ok` suppresses the intake fallback that derives
  `event.outcome` from `http.status_code`, so a 5xx exit span would report success. The
  sentinel is small and confined to `endSpan`.
- **Keep the transaction `kind: internal`.** Implemented first. Harmless on the wire (a root
  is a transaction whatever its kind) but it made the RN transaction distinguishable from
  the iOS agent's and from Flutter's for no gain.
- **Parent the request under the active view span** (`ActiveViewContext`). Rejected — the
  view span auto-ends on JS-thread idle, so it is usually already closed when a request
  starts; it doesn't exist without `@inoxth/react-native-edot-navigation`; and it folds
  every request into the screen's trace, a much larger change than the bug requires.
- **Put it behind a config flag.** Rejected — without it, Android exit spans, the
  Dependencies view and span-destination metrics are simply absent. That is a defect, not a
  preference.

## Consequences

- **One request produces two documents on both platforms**, where Android produced one.
  Ingest and storage for request telemetry roughly double there. iOS is unchanged — the
  agent was already emitting the pair.
- **The Android transaction is not new — the exit span is.** A root span was already
  recorded as a transaction, so a request already appeared as `GET <host>`; what was missing
  beneath it was the exit span carrying the destination. What changed is that transaction's
  content: it no longer carries the `http.*` fields, and `transaction.type` moves from
  `request` to `unknown`, because apm-data derives the type from HTTP attributes and the
  Request Transaction deliberately has none. **An Android query filtering transactions on
  `http.status_code`, `http.method` or `transaction.type: request` must move to span
  documents.** This is the one existing-dashboard break.
- **Transaction error rate no longer sees HTTP failure**, and on Android that is a
  regression: before this decision the request span *was* the transaction, so a 5xx landed
  on a transaction document. Where the signal went instead: the **exit span** still reports
  it, because intake derives `event.outcome` from `http.status_code` on a statusless span,
  and the Dependencies view reads failure rate per destination from those; and every failure
  is now also an **APM error document**, so error rate counts it. Alerts on transaction
  error rate for HTTP failure must move to error rate or to the exit spans.
- **Every 4xx and 5xx becomes an error document.** Accepted deliberately, and the same on
  both fleets — it is how apm-agent-ios already reports its own `URLSession` traffic. A
  service that polls an endpoint answering 404 will see that in its error rate.
- **Kibana gains, on Android:** the service-map edge to external hosts, the Dependencies
  tab, and span-destination metrics.
- **Fleet Alignment:** Flutter and RN agree on the whole request shape — two spans, same
  name, same kind, no attributes or status or events on the transaction, failure as an
  exception event typed by status code, and the same 400 floor. Timestamp equality is the
  only open difference, and it is bounded by the Android clock rewrite described above.
- **The Request Transaction must never gain an HTTP attribute.** `http.url` on it revives
  the iOS rescue and produces a third span per request. The fetch/XHR tests assert its
  attributes are exactly `{}`.
- **`withSpanContext` is not consulted.** Flutter skips the Request Transaction when a
  request runs inside `runWithParent`; the RN equivalent lives in
  `@inoxth/react-native-edot-tracer-provider`, whose context stack is private to a package
  that depends on this one. A request inside `withSpanContext` therefore hangs under a
  Request Transaction rather than under the caller's span. Tracked as DEV-1243.
- **An agent bump is a reason to re-check this.** If a future apm-agent-ios stops
  manufacturing parents, nothing here changes — the SDK already supplies one. If a future
  agent-sdk starts, the two would not collide either, since it would key off a parentless
  span and there are none.
