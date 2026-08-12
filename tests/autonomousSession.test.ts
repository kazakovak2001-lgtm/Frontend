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
  assert.deepEqual(
    parsed.checkpoints.map((checkpoint) => checkpoint.timestamp),
    [110, 120, 130, 140, 150, 160, 170],
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

test("autonomous quality score stays null when nothing measured it", () => {
  // PLAYTEST-TRUTH-1. The backend used to fill this from the playtest
  // heuristic, whose total added five points when the generated source
  // contained the substring `pcall`. Nothing measures quality now, so every
  // session reports null, and the parser's null branch — previously
  // uncovered, because every fixture carried a number — has to hold.
  const parsed = parseAutonomousSession({
    ...sessionFixture(),
    qualityScore: null,
  });

  assert.equal(parsed.qualityScore, null);
});

test("autonomous quality score still rejects a non-numeric value", () => {
  // Null is a real value here; a string is still a malformed response, and
  // accepting one would let an unparsed payload read as a measurement.
  assert.throws(() =>
    parseAutonomousSession({ ...sessionFixture(), qualityScore: "80" }),
  );
});
