import test from "node:test";
import assert from "node:assert/strict";
import { mapAgent } from "../src/services/realtimeAgentMapping.ts";

// --- authoritative status/progress are preserved unchanged ---
test("a recognized backend status is preserved unchanged", () => {
  const agent = mapAgent({ id: "a1", status: "running", progress: 42 }, 0);
  assert.equal(agent.status, "running");
  assert.equal(agent.progress, 42);
});

test("authoritative numeric progress, including 0, is preserved exactly", () => {
  const agent = mapAgent({ id: "a1", status: "idle", progress: 0 }, 0);
  assert.equal(agent.status, "idle");
  assert.equal(agent.progress, 0);
});

test("each recognized status enum value passes through unchanged", () => {
  for (const status of [
    "idle",
    "running",
    "completed",
    "queued",
    "error",
  ] as const) {
    const agent = mapAgent({ id: "a1", status, progress: 10 }, 0);
    assert.equal(agent.status, status);
  }
});

// --- missing/unrecognized status must never become "idle" ---
test("a missing backend status becomes 'unknown', not 'idle'", () => {
  const agent = mapAgent({ id: "a1" }, 0);
  assert.equal(agent.status, "unknown");
});

test("an unrecognized/legacy backend status string becomes 'unknown', not passed through and not 'idle'", () => {
  const agent = mapAgent({ id: "a1", status: "deprecated-legacy-state" }, 0);
  assert.equal(agent.status, "unknown");
});

test("a non-string backend status becomes 'unknown'", () => {
  const agent = mapAgent({ id: "a1", status: 3 }, 0);
  assert.equal(agent.status, "unknown");
});

// --- missing/invalid progress must never become 0 ---
test("a missing backend progress value stays undefined, not 0", () => {
  const agent = mapAgent({ id: "a1", status: "running" }, 0);
  assert.equal(agent.progress, undefined);
});

test("a non-numeric backend progress value stays undefined, not 0", () => {
  const agent = mapAgent({ id: "a1", status: "running", progress: "64%" }, 0);
  assert.equal(agent.progress, undefined);
});

test("a NaN/Infinity backend progress value stays undefined, not 0", () => {
  assert.equal(
    mapAgent({ id: "a1", progress: Number.NaN }, 0).progress,
    undefined,
  );
  assert.equal(
    mapAgent({ id: "a1", progress: Number.POSITIVE_INFINITY }, 0).progress,
    undefined,
  );
});

// --- legacy/incomplete payload renders an explicit unknown state on both fields at once ---
test("a fully legacy/incomplete payload maps to explicit unknown status and undefined progress together", () => {
  const agent = mapAgent({ id: "legacy-1", name: "Legacy Agent" }, 0);
  assert.equal(agent.status, "unknown");
  assert.equal(agent.progress, undefined);
  assert.equal(agent.id, "legacy-1");
  assert.equal(agent.name, "Legacy Agent");
});

// --- mixed payload: some agents authoritative, others unknown ---
test("mixed input: authoritative agents and legacy agents are each mapped correctly and independently", () => {
  const raw = [
    { id: "a1", status: "running", progress: 55 },
    { id: "a2" },
    { id: "a3", status: "completed", progress: 100 },
    { id: "a4", status: "not-a-real-status" },
  ];
  const mapped = raw.map((entry, index) => mapAgent(entry, index));

  assert.deepEqual(
    mapped.map((agent) => [agent.status, agent.progress]),
    [
      ["running", 55],
      ["unknown", undefined],
      ["completed", 100],
      ["unknown", undefined],
    ],
  );
});
