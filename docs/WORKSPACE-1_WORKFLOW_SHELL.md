# WORKSPACE-1 — Workflow Shell Slice

**Repository:** `kazakovak2001-lgtm/Frontend`

**Base:** `agent/workspace-1-foundation`

**Status:** Implemented; CI validation pending

## Objective

Replace the eight technical tabs on `/projects/$projectId` with a project workflow that explains what the user should do next without adding new backend endpoints, stores, or realtime clients.

## Reuse Check

This slice reuses:

- `useProjectWorkspaceData` for persisted blueprint, execution, history, chat-summary, Studio-status, and agent-registry data;
- `useProjectRealtime` for project Socket.IO state, agents, progress, and logs;
- `WorkspaceContext` for the active generation run;
- `ChatPanel` for durable project conversations;
- `WorkspaceModules` for existing backend module operations;
- `backendApi` for generation, Studio synchronization, export, and settings operations.

No parallel Workspace route, API client, project state, chat state, or generation state was introduced.

## Delivered Information Architecture

The previous navigation exposed eight tabs:

- Overview;
- Modules;
- Manifest;
- AI Chat;
- Agents;
- Live Logs;
- Settings;
- Export.

The route now exposes five deep-linkable workflow stages through the `stage` search parameter:

1. **Define** — project brief, cover, persisted blueprint readiness, and AI chat.
2. **Generate** — active run summary, agents, and live pipeline activity.
3. **Validate** — existing simulation, economy, quality, controller, and production tools.
4. **Integrate** — backend manifest, export, and Roblox Studio connection/synchronization status.
5. **Operate** — durable generation history and project settings.

## New Components

- `WorkspaceWorkflowRail` — responsive five-stage navigation with workflow readiness badges.
- `WorkspaceRunSummary` — current execution state, progress, completed steps, failed steps, and known step count.

## Preservation

- Generation start and polling behavior are unchanged.
- Project realtime events still come from `useProjectRealtime`.
- Persisted data refreshes after generation state changes.
- Chat continues to use the existing durable `/api/chat` boundary.
- Manifest export continues to use `/api/projects/:id/export`.
- Studio synchronization continues to use the existing backend route.
- The UI explicitly states that real generated-artifact delivery remains unverified until STUDIO-1.

## Remaining WORKSPACE-1 Work

- Decompose `WorkspaceModules` into stage-specific tools instead of displaying the full technical inventory in Validate.
- Replace generic JSON module outputs with typed result presenters.
- Add a persistent context rail for run health, recent activity, and blockers.
- Add focused route/component tests and responsive visual verification.

## Validation Gate

- TypeScript check;
- production build;
- no route-generation errors from optional `stage` search state;
- no new backend endpoint or data store;
- responsive workflow rail on desktop and tablet.
