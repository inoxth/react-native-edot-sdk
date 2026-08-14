---
'@inoxth/react-native-edot-sdk': patch
---

Mint a Request Transaction for every traced `fetch`/XHR request, so the request span is never a root. apm-data classifies root spans as transactions, and transactions never carry `span.destination.service.resource` — the field Kibana's service map draws external edges from — so Android had no service-map edge, no Dependencies tab and no span-destination metrics for HTTP calls. iOS only looked correct because apm-agent-ios's `ElasticSpanProcessor` manufactured a parent for parentless `http.url` spans; Android's agent has no equivalent.

The Request Transaction is a deliberate copy of that agent-manufactured parent, matching the Flutter plugin: the request span's name, `kind=CLIENT`, and nothing else — no attributes, no status, no events. Applies to both platforms with no platform branch, so iOS still emits two spans per request rather than three.

Request failure is now reported the way apm-agent-ios reports its own `URLSession` traffic: an **exception event**, not a span status. A 4xx/5xx records `exception.type` = the status code and `exception.message` = the reason phrase; timeouts, network failures and cancellations do the same, told apart by type. No span on the request path carries a status any more — `endSpan` gained a `-1` sentinel that ends a span without setting one, because intake derives `event.outcome` from `http.status_code` only for a statusless span.

Two consequences worth planning for: **every 4xx and 5xx now becomes an APM error document**, so it counts toward the service's error rate; and **transaction error rate no longer sees HTTP failure** — read it from error rate or from the exit spans, which is also where the Dependencies view reads per-destination failure. On Android a request also produces two documents where it produced one, and the transaction loses its `http.*` fields (`transaction.type` becomes `unknown`), so a dashboard filtering transactions on `http.status_code`, `http.method` or `transaction.type: request` must move to span documents.

`fetch` previously treated any non-2xx as a failure, so a `304 Not Modified` was reported as one; both transports now use the same `>= 400` floor as the agents and the Flutter plugin. (DEV-1232)
