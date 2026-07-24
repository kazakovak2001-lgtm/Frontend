# WORKSPACE-1 — Native Workflow Logic Tests

**Repository:** `kazakovak2001-lgtm/Frontend`

**Status:** Implemented; CI validation pending

## Objective

Add focused regression coverage for the workflow decisions introduced by WORKSPACE-1 without installing a second frontend test framework or changing the dependency graph.

## Existing Infrastructure Check

The standalone frontend did not contain a unit-test runner. Its supported runtime is already Node.js 22.12 or newer, which provides the native `node:test` runner and TypeScript type stripping.

This slice therefore uses:

```bash
node --experimental-strip-types --test tests/workspaceLogic.test.ts
```

No Vitest, Jest, DOM emulator, browser runner, new dependency, or lockfile update is introduced.

## Production Logic Boundary

Pure workflow logic is extracted into `src/components/workspace/workspaceLogic.ts` and consumed directly by production components:

- `WorkspaceModules` uses the exported stage-to-tool registry;
- `WorkspaceContextRail` uses the exported blocker, next-action, and run-description functions;
- `WorkspaceModuleResult` uses the exported heterogeneous-payload summarizer.

The tests therefore verify the same functions used by the application rather than a parallel test-only implementation.

## Coverage

The native test suite verifies:

1. every advanced Workspace tool is assigned to exactly one workflow stage;
2. the compatibility mode still exposes the complete tool inventory;
3. next-action recommendations follow durable blueprint, execution, validation, Studio, and operations gates;
4. blockers reflect missing blueprint, incomplete execution, Studio connectivity, artifact verification, execution errors, and degraded data sources;
5. module result summaries prioritize operational fields over arbitrary payload fields;
6. arrays and nested records produce stable compact summaries;
7. active, completed, failed, and idle run states produce distinct descriptions.

## CI Gate

The Frontend CI workflow now contains three independent jobs:

- TypeScript Check;
- Workspace Logic Tests;
- Production Build.

A pull request cannot be considered WORKSPACE-1 complete unless all three jobs pass.

## Preservation

- browser TypeScript configuration does not include the root `tests/` directory;
- application bundle behavior is unchanged apart from importing the extracted pure functions;
- backend contracts and realtime behavior are unchanged;
- no dependency or lockfile churn is introduced.

## Next Gate

After CI passes, WORKSPACE-1 still requires responsive visual verification of the workflow rail, stage canvas, and context rail before the phase can be formally closed and STUDIO-1 begins.
