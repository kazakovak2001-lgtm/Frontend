# WORKSPACE-1 — Stage Composition and Context Rail

**Repository:** `kazakovak2001-lgtm/Frontend`

**Status:** Implemented; CI validation pending

## Objective

Complete the workflow-shell composition by placing the existing stage-scoped tool registry into the correct canvases and keeping the most important project context visible while users move between Define, Generate, Validate, Integrate, and Operate.

## Architecture Change

The project route previously owned both orchestration and approximately five hundred lines of stage-specific presentation. This made generation polling, project mutations, navigation, and visual layout difficult to review independently.

This slice separates responsibilities:

- `projects.$projectId.tsx` owns project loading, generation start/polling, mutations, refresh, and stage navigation;
- `WorkspaceStageCanvas` owns the presentation of the active workflow stage;
- `WorkspaceContextRail` owns cross-stage run state, blockers, next decision, and recent realtime activity;
- `WorkspaceModules` remains the sole owner of advanced backend tool actions and their operation state.

No new data store, HTTP client, backend endpoint, or realtime subscription is introduced.

## Scoped Tool Placement

| Workflow stage | Embedded scoped tools |
| --- | --- |
| Define | Knowledge, concept/architecture/domain, memory/collaboration |
| Generate | Planning/autonomous generation, compile/Lua/assets |
| Validate | Controller, simulation, economy, world/lifecycle, quality |
| Integrate | Project versioning; the dedicated Studio panel remains canonical |
| Operate | System/agents, analytics, distributed runtime/diagnostics |

The previous all-tools compatibility mode remains available inside `WorkspaceModules`, but the project route now uses explicit stage scopes.

## Persistent Context Rail

The context rail shows:

- current run status and progress;
- realtime connection state and current step;
- the next recommended workflow decision;
- up to four blockers or degraded data sources;
- the latest realtime activity entries;
- a refresh action that reuses the existing Workspace read-model refresh.

The rail derives all information from the existing project, Workspace read model, active run, and realtime hook. It does not persist or independently fetch data.

## Preservation

- generation start and polling behavior are unchanged;
- project mutations and navigation remain in the route;
- ChatPanel, AgentCard, Studio sync, manifest export, durable history, and settings retain their existing contracts;
- stage search deep links remain unchanged;
- STUDIO-1 remains responsible for generated-artifact delivery proof.

## Validation Gate

- TypeScript check;
- production build;
- every stage renders only its assigned tool groups;
- no duplicate Studio card or backend operation;
- context rail remains non-blocking below desktop width;
- route orchestration remains behaviorally unchanged.
