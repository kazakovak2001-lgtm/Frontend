#!/usr/bin/env bash
set -euo pipefail

workspace="${1:-$PWD/integration-workspace}"
frontend_ref="${INTEGRATION_FRONTEND_REF:-agent/integration-1a-runtime-wiring}"
backend_sha="${INTEGRATION_BACKEND_SHA:-de4c2d3af531155b9ecc88a497bb151d26544922}"
frontend_repo="https://github.com/kazakovak2001-lgtm/Frontend.git"
backend_repo="https://github.com/kazakovak2001-lgtm/RobloxAIStudio2.git"

for command in git node npm docker; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

if [[ -e "$workspace" ]] && [[ -n "$(find "$workspace" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
  echo "Workspace must be empty: $workspace" >&2
  exit 1
fi

mkdir -p "$workspace"
git clone --branch "$frontend_ref" --single-branch "$frontend_repo" "$workspace/Frontend"
git clone --no-checkout "$backend_repo" "$workspace/RobloxAIStudio2"
git -C "$workspace/RobloxAIStudio2" checkout --detach "$backend_sha"

frontend_sha="$(git -C "$workspace/Frontend" rev-parse HEAD)"
actual_backend_sha="$(git -C "$workspace/RobloxAIStudio2" rev-parse HEAD)"
[[ "$actual_backend_sha" == "$backend_sha" ]] || {
  echo "Backend checkout mismatch: expected $backend_sha, received $actual_backend_sha" >&2
  exit 1
}

npm --prefix "$workspace/Frontend" ci
npm --prefix "$workspace/RobloxAIStudio2" ci

cat >"$workspace/integration.env" <<EOF
INTEGRATION_FRONTEND_DIR=$workspace/Frontend
INTEGRATION_BACKEND_DIR=$workspace/RobloxAIStudio2
INTEGRATION_FRONTEND_SHA=$frontend_sha
INTEGRATION_BACKEND_SHA=$actual_backend_sha
EOF

INTEGRATION_FRONTEND_SHA="$frontend_sha" \
INTEGRATION_BACKEND_SHA="$actual_backend_sha" \
INTEGRATION_BACKEND_DIR="$workspace/RobloxAIStudio2" \
  node "$workspace/Frontend/scripts/integration/verify-paired-repositories.mjs"

printf 'Bootstrap complete. Source %s before start/verify commands.\n' "$workspace/integration.env"
