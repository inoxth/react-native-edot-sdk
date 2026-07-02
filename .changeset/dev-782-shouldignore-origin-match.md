---
"@inoxth/react-native-edot-sdk": patch
---

Match `serverUrl` by origin (scheme + host + effective port) in `shouldIgnore` instead of a raw string prefix. Fixes two matcher bugs: lookalike hosts that share a string prefix (e.g. `https://apm.example.com.evil.test`) were silently excluded from tracing, and the server exclusion missed when the port normalized differently (explicit `:443` vs none). (DEV-782)
