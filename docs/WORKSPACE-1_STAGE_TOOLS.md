# WORKSPACE-1 — Stage-Scoped Tools and Result Presentation

**Repository:** `kazakovak2001-lgtm/Frontend`

**Status:** Implemented; CI validation pending

## Objective

Reduce the technical-module overload in the project Workspace without duplicating any backend integration. Preserve all existing operations while introducing one stage-aware tool registry and replacing raw JSON as the primary result UI.

## Reuse Audit

The previous `WorkspaceModules` component already owned the button actions and local operation states for fourteen backend tool groups. Creating separate stage components with their own request logic would duplicate those calls and make loading/error behavior inconsistent.

This slice therefore refactors the existing component in place:

- the same `backendApi.workspace.*` operations remain canonical;
- the same local operation state and toast behavior remain in use;
- no new endpoint, API client, store, agent, or Socket.IO channel is added;
- the dedicated Integrate-stage Studio panel remains canonical, so the duplicate Studio module card is removed from the generic tool inventory.

## Stage Registry

The tool registry assigns each existing module group to the workflow stage where it supports a user decision:

| Stage | Tool groups |
| --- | --- |
| Define | Knowledge; Concept/Architect/Domain; Memory/Collaboration |
| Generate | Planning/Autonomous Generation; Compile/Lua/Assets |
| Validate | Project Controller; Simulation; Economy; World/Lifecycle; Playtest/Repair/Evaluation |
| Integrate | Project Versioning |
| Operate | System/Agents; Analytics; Distributed Runtime/Diagnostics |

`WorkspaceModules` accepts an optional `stage` prop. Omitting it preserves the existing all-tools behavior while route placement is migrated incrementally.

## Result Presentation

`WorkspaceModuleResult` replaces the always-visible `<pre>{JSON.stringify(...)}</pre>` block with:

- prioritized operational fields such as status, success, connectivity, health, quality score, progress, counts, duration, version, warnings, errors, and recommendations;
- compact summaries for arrays and nested records;
- a collapsed diagnostic response containing the complete payload for engineering inspection.

This is intentionally schema-tolerant because the existing backend modules return heterogeneous payloads. Dedicated domain presenters can replace the generic summary incrementally without changing the action registry.

## Preservation

- Every existing action remains connected to its original backend method.
- The default all-tools inventory remains available during incremental route migration.
- System status still loads automatically only when the System tool is visible.
- Errors remain visible and continue to trigger the existing toast feedback.
- Full backend responses remain inspectable.

## Next Slice

Place stage-scoped instances into the five workflow canvases and add a persistent context rail. The route must reuse this registry rather than recreate module buttons or request state.

## Validation Gate

- TypeScript check;
- production build;
- no missing backend action;
- no duplicate Studio module card;
- default all-tools compatibility;
- collapsed raw response rather than raw JSON as primary content.
