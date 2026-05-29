#!/usr/bin/env bash
# Publish @inoxth/* packages to npm.
#
# Uses `yarn pack` (substitutes the workspace:* protocol with concrete versions
# at pack time) then `npm publish <tgz>` (auth via ~/.npmrc + WebAuthn locally,
# OIDC + NODE_AUTH_TOKEN in CI). `npm publish` from a yarn 4 workspace alone
# does not substitute workspace:* — see changesets/changesets#432.
#
# Idempotent: skips versions already on the registry. Adds --provenance when
# running in GitHub Actions with id-token: write (detected via OIDC env var).

set -euo pipefail

PACK_DIR="${PACK_DIR:-/tmp/edot-publish}"
mkdir -p "$PACK_DIR"

PACKAGES=()
while IFS= read -r line; do
  PACKAGES+=("$line")
done < <(jq -r '.fixed[0][]' .changeset/config.json)

PUBLISHED=()

for ws in "${PACKAGES[@]}"; do
  filename="$(printf '%s' "$ws" | sed 's|^@||; s|/|-|g').tgz"
  tarball="$PACK_DIR/$filename"

  yarn workspace "$ws" pack --out "$tarball"

  version="$(tar -xzOf "$tarball" package/package.json | jq -r .version)"

  if npm view "${ws}@${version}" version >/dev/null 2>&1; then
    echo "Skipping ${ws}@${version} — already published"
    continue
  fi

  # Override publishConfig.provenance per environment:
  # - CI with id-token: write → OIDC available, generate attestation
  # - Local → no OIDC, skip attestation
  provenance_flag="--no-provenance"
  if [ -n "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ]; then
    provenance_flag="--provenance"
  fi

  echo "Publishing ${ws}@${version}..."
  npm publish "$tarball" --access public $provenance_flag

  PUBLISHED+=("${ws}@${version}")
done

if [ ${#PUBLISHED[@]} -gt 0 ]; then
  echo ""
  echo "🦋  success packages published successfully:"
  for entry in "${PUBLISHED[@]}"; do
    echo "🦋  $entry"
  done
fi
