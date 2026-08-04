#!/usr/bin/env bash
set -euo pipefail

: "${INTEGRATION_FRONTEND_DIR:?Source integration.env first}"
: "${INTEGRATION_BACKEND_DIR:?Source integration.env first}"
: "${INTEGRATION_FRONTEND_SHA:?Source integration.env first}"
: "${INTEGRATION_BACKEND_SHA:?Source integration.env first}"
export INTEGRATION_FRONTEND_DIR INTEGRATION_BACKEND_DIR
export INTEGRATION_FRONTEND_SHA INTEGRATION_BACKEND_SHA

backend_container="roblox-ai-studio-backend-integration-1a"
frontend_container="roblox-ai-studio-frontend-integration-1a"
backend_image="roblox-ai-studio-backend:integration-1a"
frontend_image="roblox-ai-studio-frontend:integration-1a"
api_url="http://127.0.0.1:5051/api"
socket_url="http://127.0.0.1:5051"
frontend_origin="http://127.0.0.1:4173"

node "$INTEGRATION_FRONTEND_DIR/scripts/integration/verify-paired-repositories.mjs"

docker rm --force "$frontend_container" "$backend_container" >/dev/null 2>&1 || true

docker build \
  --file "$INTEGRATION_BACKEND_DIR/Dockerfile.backend" \
  --label "org.opencontainers.image.revision=$INTEGRATION_BACKEND_SHA" \
  --tag "$backend_image" \
  "$INTEGRATION_BACKEND_DIR"

docker run --detach \
  --name "$backend_container" \
  --publish 5051:5000 \
  --env NODE_ENV=production \
  --env PORT=5000 \
  --env STORAGE_PROVIDER=inmemory \
  --env FRONTEND_URL="$frontend_origin" \
  "$backend_image" >/dev/null

for attempt in $(seq 1 30); do
  if curl --fail --silent "$socket_url/health" >/tmp/integration-1a-backend-health.json; then
    grep --quiet '"status":"healthy"' /tmp/integration-1a-backend-health.json
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    docker logs "$backend_container" >&2 || true
    exit 1
  fi
  sleep 1
done

docker build \
  --build-arg VITE_API_URL="$api_url" \
  --build-arg VITE_SOCKET_URL="$socket_url" \
  --label "org.opencontainers.image.revision=$INTEGRATION_FRONTEND_SHA" \
  --tag "$frontend_image" \
  "$INTEGRATION_FRONTEND_DIR"

docker run --detach \
  --name "$frontend_container" \
  --publish 4173:3000 \
  --env PORT=3000 \
  --env HOST=0.0.0.0 \
  --env PUBLIC_ORIGIN="$frontend_origin" \
  "$frontend_image" >/dev/null

for attempt in $(seq 1 30); do
  if curl --fail --silent "$frontend_origin/health" >/tmp/integration-1a-frontend-health.json; then
    grep --quiet '"status":"healthy"' /tmp/integration-1a-frontend-health.json
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    docker logs "$frontend_container" >&2 || true
    exit 1
  fi
  sleep 1
done

mkdir -p "$INTEGRATION_FRONTEND_DIR/artifacts/integration-1a"
npm --prefix "$INTEGRATION_FRONTEND_DIR" install --no-save --package-lock=false playwright@1.57.0
npm --prefix "$INTEGRATION_FRONTEND_DIR" exec -- playwright install chromium
E2E_API_URL="$api_url" \
E2E_FRONTEND_ORIGIN="$frontend_origin" \
  node "$INTEGRATION_FRONTEND_DIR/scripts/integration/browser-runtime-smoke.mjs" \
  >"$INTEGRATION_FRONTEND_DIR/artifacts/integration-1a/browser-runtime.json"

E2E_API_URL="$api_url" \
E2E_SOCKET_URL="$socket_url" \
E2E_CONTRACT_MODE=production \
E2E_BACKEND_SHA="$INTEGRATION_BACKEND_SHA" \
E2E_FRONTEND_SHA="$INTEGRATION_FRONTEND_SHA" \
E2E_BACKEND_NODE_ENV=production \
E2E_STORAGE_PROVIDER=inmemory \
E2E_FRONTEND_ORIGIN="$frontend_origin" \
E2E_EVIDENCE_PATH="$INTEGRATION_FRONTEND_DIR/artifacts/integration-1a/contract.json" \
  npm --prefix "$INTEGRATION_FRONTEND_DIR" run test:e2e:integration

printf 'Frontend: %s\nBackend: %s\n' "$frontend_origin" "$socket_url"
