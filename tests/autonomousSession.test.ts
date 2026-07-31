import test from "node:test";
import assert from "node:assert/strict";
import {
  createLatestRequestGuard,
  parseAutonomousSession,
} from "../src/services/autonomousSession.ts";

function sessionFixture() {
  return {
    id: "orch-session",
    projectId: "project-1",
    status: "paused",
    currentPhase: "paused",
    phases: [{ id: "node-blueprint", phase: "blueprint", status: "completed" }],
    checkpoints: [
      { id: "checkpoint-1", phase: "blueprint", timestamp: 100 },
      { id: "checkpoint-1", phase: "blueprint", timestamp: 100 },
    ],
    cost: { totalTokens: 10, totalCost: 0.25, totalTimeMs: 50 },
    qualityScore: 80,
    startedAt: 50,
    recoveryCount: 1,
    restartInterruptedAt: 90,
    recoveryReason: "server_restart",
    terminalEvidenceId: "orch-session:terminal:1",
  };
}

test("autonomous contract preserves recovery evidence and deduplicates checkpoints", () => {
  const parsed = parseAutonomousSession(sessionFixture());

  assert.equal(parsed.status, "paused");
  assert.equal(parsed.recoveryReason, "server_restart");
  assert.equal(parsed.restartInterruptedAt, 90);
  assert.equal(parsed.cost.totalCost, 0.25);
  assert.deepEqual(parsed.checkpoints, [
    { id: "checkpoint-1", phase: "blueprint", timestamp: 100 },
  ]);
  assert.equal(parsed.terminalEvidenceId, "orch-session:terminal:1");
});

test("autonomous contract rejects unknown lifecycle states", () => {
  assert.throws(
    () =>
      parseAutonomousSession({
        ...sessionFixture(),
        status: "optimistically-complete",
      }),
    /Invalid autonomous session status/,
  );
});

test("autonomous contract keeps the latest durable checkpoint evidence", () => {
  const parsed = parseAutonomousSession({
    ...sessionFixture(),
    checkpoints: [
      { id: "checkpoint-1", phase: "blueprint", timestamp: 100 },
      { id: "checkpoint-1", phase: "lua_generation", timestamp: 200 },
    ],
  });

  assert.deepEqual(parsed.checkpoints, [
    { id: "checkpoint-1", phase: "lua_generation", timestamp: 200 },
  ]);
});

test("autonomous contract preserves the latest checkpoint timeline position", () => {
  const parsed = parseAutonomousSession({
    ...sessionFixture(),
    checkpoints: [
      { id: "a", phase: "blueprint", timestamp: 100 },
      { id: "b", phase: "lua_generation", timestamp: 110 },
      { id: "c", phase: "asset_generation", timestamp: 120 },
      { id: "d", phase: "assembly", timestamp: 130 },
      { id: "e", phase: "playtest", timestamp: 140 },
      { id: "f", phase: "repair", timestamp: 150 },
      { id: "g", phase: "benchmark", timestamp: 160 },
      { id: "a", phase: "studio_sync", timestamp: 170 },
    ],
  });

  assert.deepEqual(
    parsed.checkpoints.map((checkpoint) => checkpoint.id),
    ["b", "c", "d", "e", "f", "g", "a"],
  );
  assert.deepEqual(parsed.checkpoints.at(-1), {
    id: "a",
    phase: "studio_sync",
    timestamp: 170,
  });
});

test("reconciliation guard rejects superseded and invalidated responses", () => {
  const guard = createLatestRequestGuard();
  const first = guard.begin();
  const second = guard.begin();

  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);

  guard.invalidate();
  assert.equal(guard.isCurrent(second), false);
});
