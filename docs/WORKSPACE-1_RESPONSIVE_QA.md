# WORKSPACE-1 — Production Responsive QA

**Repository:** `kazakovak2001-lgtm/Frontend`

**Status:** Implemented and validated in Frontend CI run #41

## Objective

Validate the WORKSPACE-1 workflow shell against the exact production `.output` artifact rather than a development server. The gate must prove that the application hydrates with its existing API contracts and remains usable at desktop, tablet, and mobile widths.

## Production Artifact Boundary

The CI build publishes `.output` as a short-lived artifact. The responsive job downloads that same artifact, serves bundled files from `.output/public`, and uses the Nitro/Cloudflare worker for document routes.

An isolated mock backend implements only the existing contracts required by the Workspace:

- authenticated user session;
- project list and project record;
- persisted project export and generation history;
- conversation history;
- Roblox Studio status;
- registered agents and system status.

The QA harness introduces no new application API, store, runtime dependency, package-lock entry, backend service, or deployment contract.

## Viewport Evidence

| Scenario | Viewport | Workflow layout | Context rail | Document width | Result |
| --- | ---: | --- | --- | ---: | --- |
| Desktop Define | 1440 × 1000 | 5 stages in 1 row | Beside stage canvas | 1440 px | Pass |
| Tablet Validate | 1024 × 900 | 5 stages in 1 row | Below stage canvas | 1024 px | Pass |
| Mobile Integrate | 390 × 844 | 5 stacked stages | Below stage canvas | 390 px | Pass |

All scenarios confirmed:

- no horizontal document overflow;
- all five workflow buttons visible and unclipped;
- requested stage marked with `aria-current="step"`;
- expected stage-specific tools rendered;
- no browser page errors;
- authentication and persisted Workspace export requests reached the QA backend;
- full-page screenshots and metrics were published as a fourteen-day CI artifact.

## Regressions Found and Fixed

### Chat autofocus page jump

`ChatPanel` focused its textarea with a plain `focus()` call during mount and after message completion. On the Define stage this moved the entire page toward the chat panel and displaced the sticky context rail. Both programmatic focus calls now use `focus({ preventScroll: true })`.

The browser gate allows only a four-pixel subpixel tolerance and still fails on any meaningful page jump.

### Mobile manifest overflow

The Integrate-stage manifest exposed the default `min-width: auto` behavior of cards inside responsive grids. Long JSON content expanded the grid beyond the 390-pixel viewport. The shared `Card` primitive now includes `min-w-0`, keeping the manifest scroll inside its own panel.

### Workflow rail shrink safety

The workflow rail now uses shrink-safe containers, normal text wrapping, and non-growing status badges so five stages remain inside the viewport at desktop and tablet widths.

## Required CI Gates

WORKSPACE-1 is considered validated only when all four Frontend CI jobs pass:

1. TypeScript Check;
2. Workspace Logic Tests;
3. Production Build and artifact publication;
4. Responsive Workspace QA.

## Next Phase

WORKSPACE-1 is ready to close after this pull request is merged. STUDIO-1 must then prove delivery of real generated artifacts through the existing Roblox Studio bridge; the current UI intentionally continues to report that proof as unverified.
