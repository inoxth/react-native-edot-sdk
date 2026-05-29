#!/usr/bin/env bash
#
# Publish @inoxth/* packages to npm.
#
# WHY THIS SCRIPT EXISTS
# ----------------------
# Yarn 4 uses a `workspace:*` protocol to link sibling workspaces during
# development. That protocol is yarn-specific — npm has no idea what it
# means. If `npm publish` is invoked directly from a yarn 4 workspace dir
# (the default behavior of `yarn changeset publish`), the published tarball
# contains the literal string "workspace:*" in its dependencies, which
# breaks every consumer downstream.
#
# Workaround: pack with `yarn pack` first (yarn substitutes workspace:*
# with the concrete sibling version at pack time), then upload the
# already-finalized tarball with `npm publish <tgz>`. See
# https://github.com/changesets/changesets/issues/432.
#
# WHAT THIS SCRIPT DOES
# ---------------------
# For each package in the fixed-group from .changeset/config.json:
#   1. yarn pack         → tarball with workspace:* substituted
#   2. assert            → fail loudly if substitution didn't happen
#   3. npm view          → skip if this name@version is already on registry
#   4. npm publish <tgz> → upload (auth: ~/.npmrc + WebAuthn locally,
#                          NODE_AUTH_TOKEN or Trusted Publishing in CI)
#
# OUTPUT FORMAT
# -------------
# Emits "🦋 success packages published successfully:" lines so
# changesets/action@v1 can parse the output and auto-create GitHub releases.

set -euo pipefail

# Where packed tarballs go. Override with PACK_DIR=... for testing.
PACK_DIR="${PACK_DIR:-/tmp/edot-publish}"
mkdir -p "$PACK_DIR"

# Pull the list of publishable packages from changesets config. This keeps
# the script in sync with the fixed-group declaration (single source of truth)
# rather than hardcoding package names here.
PACKAGES=()
while IFS= read -r line; do
  PACKAGES+=("$line")
done < <(jq -r '.fixed[0][]' .changeset/config.json)

PUBLISHED=()

for ws in "${PACKAGES[@]}"; do
  # Derive a flat filename from the scoped package name:
  #   @inoxth/react-native-edot-shared → inoxth-react-native-edot-shared.tgz
  filename="$(printf '%s' "$ws" | sed 's|^@||; s|/|-|g').tgz"
  tarball="$PACK_DIR/$filename"

  # Pack the workspace. `yarn pack` is the step that substitutes workspace:*
  # → concrete sibling version. The on-disk package.json is untouched; only
  # the tarball's embedded package.json gets the resolved versions.
  yarn workspace "$ws" pack --out "$tarball"

  # Safety net: assert the tarball is free of any leftover workspace:
  # protocol references. If yarn pack ever stops substituting (regression,
  # config change, wrong yarn version, etc.), abort BEFORE uploading broken
  # tarballs to the public registry — unpublishing scoped packages requires
  # a 72h window and a 24h republish hold afterward.
  if tar -xzOf "$tarball" package/package.json | grep -q '"workspace:'; then
    echo "ERROR: $tarball still contains workspace: protocol references." >&2
    echo "       yarn pack failed to substitute. Aborting before npm publish." >&2
    echo "       Offending content:" >&2
    tar -xzOf "$tarball" package/package.json | grep '"workspace:' >&2
    exit 1
  fi

  # Read the version straight from the packed tarball (post-substitution
  # truth) so the idempotency check matches what would actually be uploaded.
  version="$(tar -xzOf "$tarball" package/package.json | jq -r .version)"

  # Idempotency: if this exact name@version is already on the registry, skip.
  # Lets the workflow re-run safely after partial failures (e.g. one
  # WebAuthn timeout out of four) without erroring on already-published
  # entries.
  if npm view "${ws}@${version}" version >/dev/null 2>&1; then
    echo "Skipping ${ws}@${version} — already published"
    continue
  fi

  # Override publishConfig.provenance per environment:
  # - CI with id-token: write → OIDC available, generate Sigstore attestation
  # - Local → no OIDC, skip attestation so WebAuthn flow can complete
  provenance_flag="--no-provenance"
  if [ -n "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ]; then
    provenance_flag="--provenance"
  fi

  echo "Publishing ${ws}@${version}..."
  npm publish "$tarball" --access public $provenance_flag

  PUBLISHED+=("${ws}@${version}")
done

# Output in the format changesets/action@v1 expects so it can auto-create
# GitHub releases from a successful publish run.
if [ ${#PUBLISHED[@]} -gt 0 ]; then
  echo ""
  echo "🦋  success packages published successfully:"
  for entry in "${PUBLISHED[@]}"; do
    echo "🦋  $entry"
  done
fi
