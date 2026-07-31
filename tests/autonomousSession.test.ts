import test from "node:test";
import assert from "node:assert/strict";
import { parseAutonomousSession } from "../src/services/autonomousSession.ts";

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
