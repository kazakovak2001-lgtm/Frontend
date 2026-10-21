import assert from "node:assert/strict";
import { test } from "node:test";
import { createLatestRequestGuard } from "../src/services/autonomousSession.ts";

/**
 * FRONTEND-GENERATION-ACCEPTANCE-1. `projects.$projectId.tsx` polls
 * `/projects/:id/generation/:executionId/status` on a fixed interval. If a
 * poll's response is slow, a later poll can be issued and resolve first; the
 * slow response arriving afterwards must not overwrite the newer status it
 * raced against. This pins the guard the polling effect uses to enforce
 * that ordering, modelling the exact out-of-order-resolution shape a slow
 * network can produce.
 */

test("a poll response that resolves after a newer poll was issued is discarded", () => {
  const guard = createLatestRequestGuard();
  const applied: string[] = [];

  function applyIfCurrent(requestId: number, status: string) {
    if (guard.isCurrent(requestId)) applied.push(status);
  }

  // Poll A begins (e.g. reports "running"), then poll B begins before A's
  // response lands.
  const pollA = guard.begin();
  const pollB = guard.begin();

  // B's response arrives first (fast network), then A's arrives late
  // (slow network) reporting an older status.
  applyIfCurrent(pollB, "completed");
  applyIfCurrent(pollA, "running");

  assert.deepEqual(
    applied,
    ["completed"],
    "the stale 'running' response from poll A must not overwrite poll B's 'completed'",
  );
});

test("in-order resolution still applies every response", () => {
  const guard = createLatestRequestGuard();
  const applied: string[] = [];

  function applyIfCurrent(requestId: number, status: string) {
    if (guard.isCurrent(requestId)) applied.push(status);
  }

  const pollA = guard.begin();
  applyIfCurrent(pollA, "running");
  const pollB = guard.begin();
  applyIfCurrent(pollB, "completed");

  assert.deepEqual(applied, ["running", "completed"]);
});

test("a response after the poll is torn down (effect cleanup) is discarded", () => {
  const guard = createLatestRequestGuard();
  const applied: string[] = [];

  function applyIfCurrent(requestId: number, status: string) {
    if (guard.isCurrent(requestId)) applied.push(status);
  }

  const pollA = guard.begin();
  guard.invalidate(); // effect cleanup: execution id changed, project switched, or unmount
  applyIfCurrent(pollA, "running");

  assert.deepEqual(applied, []);
});
