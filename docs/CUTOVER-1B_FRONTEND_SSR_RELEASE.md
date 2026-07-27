# CUTOVER-1B — Frontend SSR Release Artifact

**Status:** In implementation  
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

## Validation contract

The focused pull request must prove:

- TypeScript passes;
- Workspace logic tests pass;
- the production `.output` build passes;
- existing responsive QA still passes through the extracted shared adapter;
- the Frontend Docker image builds;
- the production container starts;
- `GET /health` returns HTTP 200 with a frontend healthy payload;
- `GET /` returns HTTP 200 and an HTML document;
- the aggregate Frontend Merge Gate passes.

## Follow-up boundary

CUTOVER-1B does not compose the Frontend and backend release artifacts. The next slice must define:

- deploy-time origins and TLS termination;
- backend CORS `FRONTEND_URL`;
- frontend build-time API and Socket.IO URLs;
- cookie domain and secure-cookie behavior;
- authenticated REST and Socket.IO smoke tests;
- rollback to the independently verified CUTOVER-1A and CUTOVER-1B artifacts.

## Rollback

Revert the CUTOVER-1B pull request. The existing `.output` production build and responsive QA remain the baseline.
