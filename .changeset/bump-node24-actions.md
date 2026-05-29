---
"@inoxth/react-native-edot-shared": patch
"@inoxth/react-native-edot-sdk": patch
"@inoxth/react-native-edot-navigation": patch
"@inoxth/react-native-edot-tracer-provider": patch
---

ci: bump deprecated GitHub Actions to Node 24 supporting versions

No runtime or API changes. Pure CI tooling update so the release
pipeline keeps working past GitHub's 2026-06-02 Node 24 default
cutover. Also doubles as the first end-to-end validation of the
Trusted Publishing + OIDC + provenance attestation flow.
