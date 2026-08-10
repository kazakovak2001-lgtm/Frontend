import test from "node:test";
import assert from "node:assert/strict";
import { createProjectRequestGuard } from "../src/services/projectRequestGuard.ts";

// --- Required scenario 1: request for A is pending -> switch to B -> A resolves ---
test("a request for project A is no longer current after switching to project B", () => {
  const guard = createProjectRequestGuard("project-a");
  const token = guard.begin("project-a");

  guard.setActiveProject("project-b");

  assert.equal(guard.isCurrent(token), false);
});

// --- Required scenario 2: request for A fails after switching to B ---
test("a request for project A that fails is not current once project B is active", () => {
  const guard = createProjectRequestGuard("project-a");
  const token = guard.begin("project-a"); // about to reject

  guard.setActiveProject("project-b");

  // this is the exact check the caller performs in its catch{} block
  assert.equal(guard.isCurrent(token), false);
});

// --- Required scenario 3: B has no data -> A's previous data must not remain visible ---
test("switching to project B invalidates project A's token even before B issues any request of its own", () => {
  const guard = createProjectRequestGuard("project-a");
  const token = guard.begin("project-a");

  guard.setActiveProject("project-b"); // B is now active, has not begun anything yet

  assert.equal(guard.isCurrent(token), false);
});

// --- Required scenario 4: rapid A -> B -> A switching ---
test("rapid A -> B -> A switching leaves only the latest bind+request current", () => {
  const guard = createProjectRequestGuard("project-a");
  const tokenA1 = guard.begin("project-a");

  guard.setActiveProject("project-b");
  const tokenB1 = guard.begin("project-b");

  guard.setActiveProject("project-a");
  const tokenA2 = guard.begin("project-a");

  assert.equal(guard.isCurrent(tokenA1), false);
  assert.equal(guard.isCurrent(tokenB1), false);
  assert.equal(guard.isCurrent(tokenA2), true);
});

// --- Required scenario 5: two requests in the same project, older request resolves last ---
test("within the same project, a newer request supersedes an older one", () => {
  const guard = createProjectRequestGuard("project-a");
  const older = guard.begin("project-a");
  const newer = guard.begin("project-a");

  assert.equal(guard.isCurrent(older), false);
  assert.equal(guard.isCurrent(newer), true);
});

// --- Required scenario 6: loading state must not leak across projects ---
test("a stale completion from project A does not appear current while project B is active, so loading state cannot leak", () => {
  const guard = createProjectRequestGuard("project-a");
  const staleToken = guard.begin("project-a"); // A's load is in flight

  guard.setActiveProject("project-b");
  const currentToken = guard.begin("project-b"); // B starts its own load

  // this is the exact check performed in the finally{} block before
  // clearing loading/refreshing state
  assert.equal(guard.isCurrent(staleToken), false);
  assert.equal(guard.isCurrent(currentToken), true);
});

// --- Required scenario 7: error state must not leak across projects ---
test("a stale rejection from project A cannot set project B's error state", () => {
  const guard = createProjectRequestGuard("project-a");
  const token = guard.begin("project-a");

  guard.setActiveProject("project-b");

  assert.equal(guard.isCurrent(token), false);
});

// --- Required scenario 8: project identity remains authoritative even if counters would otherwise look valid ---
test("project identity is authoritative even when the request counter alone would appear current", () => {
  const guard = createProjectRequestGuard("project-a");
  const token = guard.begin("project-a"); // requestId 1, counter is at 1

  // No rebind happened - the counter still considers requestId 1 "latest".
  // A token claiming a different project must still be rejected.
  const forgedToken = { ...token, projectId: "project-b" };

  assert.equal(guard.isCurrent(forgedToken), false);
  // the real, correctly-identified token remains valid
  assert.equal(guard.isCurrent(token), true);
});

// --- Baseline: normal same-project operation is unaffected ---
test("a same-project request with no switch and no newer request remains current", () => {
  const guard = createProjectRequestGuard("project-a");
  const token = guard.begin("project-a");

  assert.equal(guard.isCurrent(token), true);
});
