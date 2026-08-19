# Generation UX acceptance checklist (FRONTEND-GENERATION-ACCEPTANCE-1)

Deterministic steps to run once a real, paired backend instance is available.
Reuses the existing two-repo integration scripts — no new test framework.
Every step must be run against a live backend; none of this substitutes for
that. Mark each row `PASS` / `FAIL` with the evidence link (log, screenshot,
or test output) next to it — do not mark a row `PASS` from memory.

## 0. Pair and boot

```bash
node scripts/integration/verify-paired-repositories.mjs
bash scripts/integration/bootstrap-two-repos.sh   # first run only
bash scripts/integration/start-two-repos.sh
```

Confirms `config/integration/paired-release.json` names the exact backend SHA
under test, then brings both repos up together.

## 1. Backend contract (raw, no UI)

```bash
node scripts/e2e-backend.mjs
```

Covers, against the real backend: project creation, `POST
/projects/:id/generate` ("start generation" check), polling
`/projects/:id/generation/:executionId/status` to a terminal state ("poll
generation to completion"), the realtime `pipeline.started` /
`pipeline.completed|failed` events carrying the same execution id as the REST
response, `/projects/:id/history` reaching a terminal record, and the
project's lifecycle status (`ready` on completion, `draft` on failure). This
is `EXPECTED_CHECK_COUNT` checks — the run fails loudly on a short count
rather than silently passing on a subset.

- [ ] All checks pass. Evidence: \_\_\_

## 2. Frontend unit/integration suite

```bash
npm run typecheck
npm run test:workspace
```

`test:workspace` includes, relevant to this slice:

- `tests/generationIdempotency.test.ts` — `Idempotency-Key` sent on
  `startGeneration`, retried on a lost response with the *same* key, a fresh
  key after any definitive answer (success or 4xx/5xx), never shared across
  projects.
- `tests/generationStatusPollingRace.test.ts` — an out-of-order (stale)
  status-poll response cannot overwrite a newer one; a response after effect
  cleanup is discarded.

- [ ] `typecheck` clean. Evidence: \_\_\_
- [ ] `test:workspace` all green. Evidence: \_\_\_

## 3. Frontend boot smoke (real browser, real backend origin)

```bash
E2E_FRONTEND_ORIGIN=http://localhost:5173 \
E2E_API_URL=http://127.0.0.1:5000/api \
node scripts/integration/browser-runtime-smoke.mjs
```

Confirms the frontend actually calls the paired backend's session endpoint
on load, not a mocked or hardcoded origin.

- [ ] Smoke passes. Evidence: \_\_\_

## 4. Manual UI walkthrough (`/projects/new` → workspace)

Perform each with the real backend running; do not simulate.

1. Create a project via `/projects/new` with a name and description.
   - [ ] Redirects to `/projects/$projectId`; generation begins automatically
     (see `src/routes/projects.new.tsx`).
2. Observe the **Generate** button in the workspace header while a run is
   in flight.
   - [ ] Button reads "Generating…" and is disabled — clicking it again (or
     rapid double-click before disable paints) does not fire a second
     `POST /projects/:id/generate` (check Network tab: one call per attempt,
     one `Idempotency-Key` value per attempt-until-a-response).
3. Watch status through to completion.
   - [ ] Distinct visible states for queued/running vs. completed vs. failed
     (`WorkspaceStageCanvas`) — a failed run is visibly and actionably
     different from a completed one, not a generic error toast only.
4. Force a failure (invalid backend state, kill backend mid-run, or a
   project already at a terminal state that 4xx's the start call).
   - [ ] Error surfaces via toast and the run state persists as `failed`,
     not silently retried into a fake `completed`.
5. Refresh the browser tab mid-run, and again after completion.
   - [ ] Mid-run: status reappears from `GET /projects/:id/history` (project
     detail's `history[0]` effect), not from `sessionStorage`/React state
     that reset on reload.
   - [ ] Post-completion: project status/progress reflects the backend's
     `GET /projects/:id` response, not a value invented client-side.
6. Reopen the same project in a second tab while the first tab's poll is
   still running.
   - [ ] Both tabs converge to the same terminal state; neither tab freezes
     on a stale `running` after the backend reports a terminal state.

- [ ] All manual steps pass. Evidence: \_\_\_

## 5. Teardown

```bash
bash scripts/integration/stop-two-repos.sh
```

## Sign-off

Do not report "full-stack acceptance" from this checklist alone unless every
section above was executed against a real, running paired backend instance
(§0–§4) in this pass — record the backend SHA from
`config/integration/paired-release.json` and the frontend SHA (`git
rev-parse HEAD`) alongside the result.
