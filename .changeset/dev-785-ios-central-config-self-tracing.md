---
"@inoxth/react-native-edot-sdk": patch
---

iOS: stop the agent from tracing its own central-config poll. The `URLSessionInstrumentation` self-exclusion now matches the collector by host alone instead of host + `/v1/` path — the path filter (DEV-781) caught OTLP exports but leaked apm-agent-ios's `GET /config/v1/agents` poll, which surfaced as a recurring `GET <apm-host>` transaction. Host-only matching covers export, central config, and any future agent→collector request. (DEV-785)
