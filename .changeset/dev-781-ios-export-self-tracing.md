---
"@inoxth/react-native-edot-sdk": patch
---

iOS: stop the agent from tracing its own OTLP/HTTP export requests. The `URLSessionInstrumentation` self-exclusion now matches export traffic by host + `/v1/` path instead of a raw `serverUrl` string prefix — the prefix missed the agent's own requests whenever `serverUrl` carried an explicit `:443`/`:80` (apm-agent-ios strips default ports from the export URL), producing spurious `POST <apm-host>` spans. (DEV-781)
