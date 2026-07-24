# WORKSPACE-1 — Workflow-Oriented Workspace Foundation

**Repository:** `kazakovak2001-lgtm/Frontend`

**Status:** Audit complete; implementation active

**Dependency:** Backend CORE-1 completed and PostgreSQL restart-verified

## Objective

Transform the existing `/projects/$projectId` route into one coherent project command center. Preserve existing components, API calls, realtime events, and project ownership contracts while replacing the scattered tab/module experience with a workflow-oriented information architecture.

## Reuse Audit

The canonical frontend already contains the required capabilities:

- `/projects/$projectId` owns project loading, generation start/status, history, manifest, realtime state, settings, export, agents, logs, chat, and module entry points.
- `WorkspaceModules` exposes the existing backend domains and must be decomposed rather than duplicated.
- `ChatPanel` already restores, writes, and deletes persisted project conversations.
- `useProjectRealtime` already owns Socket.IO project events.
- `WorkspaceContext` already owns active runs and realtime snapshots.
- `backendApi` already centralizes authenticated backend access.

No second Workspace route, chat store, realtime client, project context, or backend adapter will be created.

## Findings

### 1. Route concentration

`src/routes/projects.$projectId.tsx` is more than 600 lines and combines orchestration, polling, project mutations, manifest export, navigation, and eight visual tabs.

### 2. Technical navigation instead of user workflow

The route exposes these tabs:

- Overview
- Modules
- Manifest
- AI Chat
- Agents
- Live Logs
- Settings
- Export

`WorkspaceModules` then exposes fifteen technical module groups in one grid. The user must understand backend subsystem names before understanding what to do next.

### 3. Raw payload presentation

Every module writes its result into a generic state object and renders `JSON.stringify(data)` in a `<pre>` block. Connected data exists, but it is not converted into decisions, warnings, next actions, or progress.

### 4. Client-generated pseudo-blueprints

`backendApi.projectToBlueprint()` constructs a blueprint from the frontend `Project` record for simulation, economy, and world operations. `projectQualityInput()` uses a fixed Lua script and asset fixture for playtest and repair.

After CORE-1, canonical Workspace operations must prefer the backend-persisted blueprint, execution, and manifest. Structural fixtures may remain only in explicit demo/test paths.

### 5. Correct existing durable boundaries

- Project chat already uses `/api/chat` and is now restart-durable.
- Project history already uses `/api/projects/:id/history`.
- Manifest/export already uses `/api/projects/:id/export`.
- Generation status already uses the persisted execution endpoint.

These paths must be reused.

### 6. Studio boundary

The backend Studio sync route currently builds a `studio-sync-fallback` package containing placeholder Lua/config artifacts. WORKSPACE-1 may present Studio connection and readiness, but must not claim that real generated artifacts are synchronized. Replacing the fallback package belongs to STUDIO-1.

## Target Information Architecture

### Persistent project header

- project identity and status;
- realtime connectivity;
- primary generation action;
- current execution progress;
- highest-priority blocker or next decision.

### Workflow rail

1. **Define** — project brief, blueprint readiness, AI conversation.
2. **Generate** — generation run, agents, live execution progress.
3. **Validate** — simulation, economy, playtest, repair, quality evidence.
4. **Integrate** — manifest, generated package, Studio connection/readiness.
5. **Operate** — history, analytics, versions, diagnostics, settings.

### Main workspace canvas

Each workflow stage presents:

- current state;
- evidence and recent outputs;
- one primary action;
- secondary tools;
- blockers and recommended next step.

### Context rail

Persistent, collapsible context for:

- current run;
- recent activity/logs;
- AI chat access;
- project health.

## Delivery Sequence

### WS1-A — Typed workspace read model

- Add typed blueprint, execution, manifest, chat-summary, Studio-status, and workspace-health models to `backendApi`.
- Add one frontend composition function over existing endpoints; do not add a duplicate backend aggregate endpoint yet.
- Prefer persisted export/blueprint data over `projectToBlueprint()` for canonical operations.
- Explicitly label unavailable artifact data instead of manufacturing production fixtures.

### WS1-B — Component extraction

Extract orchestration and views from the route without changing behavior:

- `useProjectWorkspaceData`
- `WorkspaceHeader`
- `WorkspaceWorkflowRail`
- `WorkspaceRunSummary`
- stage components under `components/workspace/stages/`

### WS1-C — Workflow shell

Replace the eight-tab information architecture with the five-stage workflow rail. Preserve deep-linkable stage state through TanStack Router search parameters.

### WS1-D — Result presenters

Replace generic JSON blocks with typed summaries for the highest-value operations:

- blueprint and manifest readiness;
- generation execution;
- simulation/economy/playtest quality;
- Studio readiness;
- analytics and history.

A collapsible raw payload inspector may remain for diagnostics.

### WS1-E — Validation

- TypeScript check;
- ESLint;
- production build;
- existing backend integration smoke;
- route behavior preservation;
- responsive desktop/tablet layout;
- no new API route, Socket.IO channel, project store, or chat persistence implementation.

## Explicitly Out of Scope

- Legacy backend-repository frontend changes.
- New backend persistence framework.
- New project/chat/realtime stores.
- Real artifact-to-Studio package replacement.
- Legacy frontend deletion.
- Adding new AI agents or backend module families.

## First Implementation Slice

Implement WS1-A and the non-visual extraction portion of WS1-B:

1. typed canonical workspace records;
2. persisted project workspace loader;
3. route orchestration hook;
4. tests/build verification;
5. then replace the current tabs with the workflow shell.
