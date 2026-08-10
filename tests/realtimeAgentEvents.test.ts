import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAgentProgress,
  reduceRealtimeAgents,
  reduceRealtimeSnapshotPatch,
} from "../src/hooks/realtimeAgentEvents.ts";

// ============================================================
// reduceRealtimeSnapshotPatch - overall run status/progress
// ============================================================

test("authoritative 'running' event patch remains running", () => {
  const patch = reduceRealtimeSnapshotPatch("pipeline.started", {});
  assert.deepEqual(patch, { status: "running", progress: 0 });
});

test("authoritative 'completed' event patch remains completed", () => {
  const patch = reduceRealtimeSnapshotPatch("generation.completed", {});
  assert.deepEqual(patch, { status: "completed", progress: 100 });
});

test("authoritative 'failed' event patch does not touch progress", () => {
  const patch = reduceRealtimeSnapshotPatch("pipeline.failed", {});
  assert.deepEqual(patch, { status: "failed" });
});

test("a step event marks the run running but does not fabricate an overall progress percentage", () => {
  const patch = reduceRealtimeSnapshotPatch("step.completed", {
    stepId: "lua_generation",
  });
  assert.equal(patch?.status, "running");
  assert.equal(
    "progress" in (patch ?? {}),
    false,
    "step events must not synthesize an overall-run progress value",
  );
});

test("an unresolved/unrecognized event type does not create a synthetic terminal snapshot state", () => {
  const patch = reduceRealtimeSnapshotPatch("some.unrelated.event", {});
  assert.equal(patch, undefined);
});

test("stale/unrecognized event data never turns into 'completed' or 'failed'", () => {
  for (const type of ["heartbeat", "log", "", "project:joined"]) {
    const patch = reduceRealtimeSnapshotPatch(type, {});
    assert.equal(patch, undefined, `type "${type}" must not produce a patch`);
  }
});

// ============================================================
// normalizeAgentProgress
// ============================================================

test("normalizeAgentProgress preserves a real number, including 0", () => {
  assert.equal(normalizeAgentProgress(0), 0);
  assert.equal(normalizeAgentProgress(73), 73);
});

test("normalizeAgentProgress returns undefined for missing/invalid values, never 0", () => {
  assert.equal(normalizeAgentProgress(undefined), undefined);
  assert.equal(normalizeAgentProgress(null), undefined);
  assert.equal(normalizeAgentProgress("50"), undefined);
  assert.equal(normalizeAgentProgress(Number.NaN), undefined);
});

// ============================================================
// reduceRealtimeAgents - per-agent status/progress
// ============================================================

test("step.completed with authoritative progress preserves it before folding to 100 on completion", () => {
  // completion always means 100% of that step, by definition of "completed"
  const agents = reduceRealtimeAgents([], "step.completed", {
    agentId: "lua_generator",
    progress: 87,
  });
  assert.equal(agents[0].status, "completed");
  assert.equal(agents[0].progress, 100);
});

test("step.started with a missing progress field does not become 0", () => {
  const agents = reduceRealtimeAgents([], "step.started", {
    agentId: "lua_generator",
  });
  assert.equal(agents[0].status, "running");
  assert.equal(agents[0].progress, undefined);
});

test("step.started with authoritative numeric progress, including 0, is preserved", () => {
  const zero = reduceRealtimeAgents([], "step.started", {
    agentId: "a1",
    progress: 0,
  });
  assert.equal(zero[0].progress, 0);

  const real = reduceRealtimeAgents([], "step.started", {
    agentId: "a2",
    progress: 33,
  });
  assert.equal(real[0].progress, 33);
});

test("step.failed on a newly-seen agent renders unknown progress, not 0", () => {
  const agents = reduceRealtimeAgents([], "step.failed", {
    agentId: "a1",
    error: "timeout",
  });
  assert.equal(agents[0].status, "error");
  assert.equal(agents[0].progress, undefined);
});

test("step.failed on an already-tracked agent only changes status, preserving its last known progress", () => {
  const before = reduceRealtimeAgents([], "step.started", {
    agentId: "a1",
    progress: 61,
  });
  const after = reduceRealtimeAgents(before, "step.failed", {
    agentId: "a1",
    error: "boom",
  });
  assert.equal(after[0].status, "error");
  assert.equal(
    after[0].progress,
    61,
    "authoritative progress must be preserved, not zeroed out on failure",
  );
});

test("an unrecognized event type leaves the agent list completely unchanged (no synthetic terminal state)", () => {
  const before = reduceRealtimeAgents([], "step.started", {
    agentId: "a1",
    progress: 40,
  });
  const after = reduceRealtimeAgents(before, "some.unrelated.event", {
    agentId: "a1",
  });
  assert.deepEqual(after, before);
});

// ============================================================
// mixed payload: some agents authoritative, others unknown
// ============================================================

test("mixed sequence: an agent with authoritative progress and a stalled agent with none coexist correctly", () => {
  let agents = reduceRealtimeAgents([], "step.started", {
    agentId: "reporting",
    progress: 20,
  });
  agents = reduceRealtimeAgents(agents, "step.started", {
    agentId: "silent",
  });

  const reporting = agents.find((a) => a.id === "reporting");
  const silent = agents.find((a) => a.id === "silent");

  assert.equal(reporting?.progress, 20);
  assert.equal(silent?.progress, undefined);
  assert.equal(reporting?.status, "running");
  assert.equal(silent?.status, "running");
});
