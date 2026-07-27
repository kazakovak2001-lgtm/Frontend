# CUTOVER-1B — Frontend SSR Release Artifact

**Status:** Complete  
**Tracking issue:** #11  
**Baseline:** `main` at `a8d005d433d48e18d8e64ac176ee63c9c694b644`

## Objective

Package the canonical TanStack Start/Nitro Frontend as an independently deployable SSR release artifact before cross-repository release composition or legacy frontend removal.

## Reuse decision

The production `.output` bundle exposes a worker-style `fetch(request, env, context)` interface. The existing responsive QA already contained a proven Node HTTP adapter that:

- serves `.output/public` assets;
- protects the asset root from path traversal;
- translates Node requests to Web `Request` objects;
- translates worker `Response` objects back to Node responses.

CUTOVER-1B extracts that implementation into `scripts/runtime/frontend-node-server.mjs`. Responsive QA and the production process use the same adapter. No parallel SSR transport was introduced.

## Release boundary

The Frontend image:

1. installs dependencies and runs the existing `npm run build` contract;
2. accepts `VITE_API_URL` and `VITE_SOCKET_URL` as explicit build arguments;
3. copies only `.output` and the shared runtime adapter into the production stage;
4. starts as a non-root user through `scripts/runtime/serve-frontend.mjs`;
5. exposes an adapter-level `GET /health` endpoint that does not require the backend.

`VITE_API_URL` and `VITE_SOCKET_URL` remain build-time values because the existing API and realtime clients read them through `import.meta.env`. Changing that contract is outside this slice.

## Production-only finding

The first release-image smoke run proved that the image built, the container started, and `/health` was healthy, but the root SSR document failed. The shared asset handler treated `/` as the `.output/public` directory and attempted to read that directory as a file before the request could reach the worker.

The fix keeps one shared boundary for QA and production:

- the public root itself is never treated as a file;
- directory paths and `EISDIR` results fall through to the SSR worker;
- regular public files continue to use the existing protected asset-serving path.

No route, UI, API client, realtime client, or authentication behavior changed.

## Validation result

Frontend CI run #64 (`30306526291`) proved the complete CUTOVER-1B boundary:

- TypeScript Check passed;
- Workspace Logic Tests passed;
- Production Build passed and published `.output`;
- Frontend Docker image built successfully;
- the production container started as the configured non-root user;
- `GET /health` returned HTTP 200 with `roblox-ai-studio-frontend` healthy status;
- `GET /` returned HTTP 200 with an HTML Roblox AI Studio document;
- Responsive Workspace QA passed at desktop, tablet, and mobile widths through the extracted shared adapter;
- aggregate Frontend Merge Gate passed.

## Follow-up boundary

CUTOVER-1B does not compose the Frontend and backend release artifacts. The next slice is **CUTOVER-1C — cross-repository release composition** and must define:

- deploy-time origins and TLS termination;
- backend CORS `FRONTEND_URL`;
- frontend build-time API and Socket.IO URLs;
- cookie domain and secure-cookie behavior;
- authenticated REST and Socket.IO smoke tests;
- rollback to the independently verified CUTOVER-1A and CUTOVER-1B artifacts.

Legacy frontend removal remains prohibited until the composed release topology passes and the final cleanup gates in the backend cutover plan are satisfied.

## Rollback

Revert the CUTOVER-1B pull request. The existing `.output` production build and responsive QA remain the baseline.
