#!/usr/bin/env bash
set -euo pipefail

docker rm --force \
  roblox-ai-studio-frontend-integration-1a \
  roblox-ai-studio-backend-integration-1a \
  >/dev/null 2>&1 || true

rm -f \
  /tmp/integration-1a-backend-health.json \
  /tmp/integration-1a-frontend-health.json

printf 'INTEGRATION-1A containers stopped.\n'
