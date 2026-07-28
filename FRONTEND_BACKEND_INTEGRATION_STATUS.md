# Frontend ↔ Backend integration status

## Architecture

The Frontend repository is the presentation layer. `RobloxAIStudio2` remains the source of truth for authentication, projects, AI execution, generation, diagnostics, persistence and Roblox Studio integration.

All browser calls pass through `src/services/backendApi.ts`. It normalizes API envelopes and project/user models, includes httpOnly cookie credentials, performs one refresh-and-retry on expired sessions and exposes typed operations to contexts and screens. Socket.IO is isolated in `src/services/realtime.ts` and consumed through `WorkspaceContext` plus `useProjectRealtime`.

## Screen and control map

| Screen                                    | Connected behavior                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/login`, `/register`, `/forgot-password` | Cookie login, registration, non-enumerating reset request and validation/error states           |
| `/dashboard`                              | Authenticated project totals, recent projects, live generation state and navigation             |
| `/projects`                               | Backend list, search/filter, open, duplicate and confirmed delete                               |
| `/projects/new`                           | Validated project creation; generation is queued until the workspace joins its realtime room    |
| `/projects/:projectId`                    | Unified overview, modules, manifest, persistent AI chat, agents, live logs, settings and export |
| `/agents`                                 | Backend agent registry/status with refresh and error states                                     |
| `/settings`                               | Profile PATCH, persisted preferences, theme and explicit external-service availability states   |
| App shell                                 | Auth guard, project/agent search, project-aware notifications, account menu and logout          |

Every active button is either a submit control, link, dialog/menu trigger or has an async handler with loading/error feedback. Unsupported billing and API-key management are shown as unavailable capabilities instead of fake actions.

## Workspace module map

| Workspace capability                       | Backend contract                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Project generation/status/history/export   | `/api/projects/*`                                                      |
| Persistent AI chat                         | `/api/ai/chat`, `/api/chat/*`                                          |
| System and agent status                    | `/api/system/*`                                                        |
| Analytics                                  | `/api/analytics/*`                                                     |
| Knowledge                                  | `/api/knowledge/*`                                                     |
| Simulation and economy                     | `/api/simulate/*`, `/api/economy/*`                                    |
| Concept, architect and domain intelligence | `/api/concept/*`, `/api/ai/game-architect/*`, `/api/domain/*`          |
| Planning, DAG and generation core          | `/api/plan/*`, `/api/v2/plan/dag`, `/api/generate/*`                   |
| Stable compile, Lua and assets             | `/api/v1/compile`, `/api/lua/*`                                        |
| World and lifecycle                        | `/api/world/*`, `/api/lifecycle/*`                                     |
| Playtest, repair and agent evaluation      | `/api/playtest/*`, `/api/repair/*`, `/api/evaluation/*`                |
| Memory and agent collaboration             | `/api/memory/*`, `/api/agents/*`                                       |
| Autonomous and distributed execution       | `/api/autonomous/*`, `/api/distributed/*`                              |
| Diagnostics, registry and versions         | `/api/debug/*`, `/api/platform/registry/*`, `/api/platform/versions/*` |
| AI project controller                      | `/api/controller/*`                                                    |
| Roblox Studio status and sync              | `/api/projects/:id/studio/*`                                           |

Versioned and transport-level endpoints are deliberately not duplicated as separate UI modules. The frontend uses the stable v1 compile contract, v2 only for DAG/status inspection, and project-scoped Studio routes instead of exposing plugin protocol controls to browser users.

## Studio verification contract

The Workspace validates `artifactVerified`, `verificationStatus`, command,
verified execution/artifact count and verification error from the
project-scoped Studio status response. `studioArtifactVerified` becomes true
only when the backend reports a consistent `verified` state with exact
execution/count evidence. Malformed or contradictory claims fail closed to the
disconnected/degraded read model.

The Integrate stage distinguishes idle, queued, delivered, acknowledged,
verified and failed states. Backend-verified sessions show the exact evidence
and no longer retain the historical permanent STUDIO-1 blocker.

## Realtime contract

The workspace opens one credentialed Socket.IO connection, joins `project:<projectId>` after route mount and leaves it during cleanup. It accepts only events whose payload contains the active `projectId`.

Handled events include:

- `pipeline.started`, `pipeline.completed`, `pipeline.failed`
- `generation.started`, `generation.completed`, `generation.failed`
- `step.started`, `step.completed`, `step.failed`
- project-scoped agent task, decision and conflict events

The REST `executionId` and realtime `pipelineId` are the same identifier. REST polling remains a fallback when Socket.IO is temporarily unavailable.

## Runtime configuration

```env
VITE_API_URL=https://api.example.com/api
VITE_SOCKET_URL=https://api.example.com
```

If `VITE_SOCKET_URL` is omitted, the Socket.IO origin is derived from `VITE_API_URL`. Production must use HTTPS and configure the backend `FRONTEND_URL`. A same-site deployment or reverse proxy is recommended for cookie sessions.

## Verification

```bash
npx tsc --noEmit
npm run test:workspace
npm run test:e2e:integration
npm run build
```

The native suite contains 12 checks, including verified, pending, failed,
malformed and disconnected Studio responses plus Workspace blocker/next-action
behavior. The integration suite contains 40 checks. It covers authenticated
REST and Socket.IO behavior, all user-facing module groups, full project
lifecycle, persistent chat, guarded Studio sync, explicit disconnected
verification state, cross-user project isolation, export, settings, deletion,
logout and login restoration. TypeScript, production build and responsive
browser QA are also required before merge.

## External runtime dependencies

- Real model output requires at least one configured LLM provider key; without it, the backend intentionally reports stub mode.
- Password-reset email delivery requires an email provider. The public request contract is already connected and does not reveal account existence.
- Studio synchronization requires a live Roblox Studio plugin session. The browser reports `disconnected` and rejects sync honestly when no bridge is connected.
- Durable multi-instance production data requires the configured PostgreSQL storage provider; the default in-memory provider is suitable for local development and tests.
