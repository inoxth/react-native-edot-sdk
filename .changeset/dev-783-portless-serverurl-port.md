---
"@inoxth/react-native-edot-sdk": patch
---

Normalize a portless `serverUrl` to its scheme-default port (`:443` for https, `:80` for http) before it reaches the native agents, on both the JS `initialize` and native pre-init paths. Previously iOS silently fell back to apm-agent-ios's hardcoded `:8200` for a portless URL while Android used the scheme default, so the same config targeted different ports per platform — causing silent data loss on iOS when the collector was on 443. Explicit ports are respected. (DEV-783)
