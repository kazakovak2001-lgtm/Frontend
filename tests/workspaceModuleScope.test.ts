import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceModuleScope } from "../src/components/workspace/workspaceModuleScope.ts";
import { WORKSPACE_MODULE_KEYS } from "../src/components/workspace/workspaceLogic.ts";

const KEYS = WORKSPACE_MODULE_KEYS;

// --- Required scenario 1 (pending A -> switch to B -> A resolves) ---
test("a request for one key started under project A is no longer current after switching to project B", () => {
  const scope = createWorkspaceModuleScope(KEYS, "project-a");
  const token = scope.begin("economy", "project-a");

  scope.setActiveProject("project-b");

  assert.equal(scope.isCurrent(token), false);
});

// --- Required scenario 2 (A fails after switching to B) ---
test("a request that fails after switching to project B is not current in the catch path", () => {
  const scope = createWorkspaceModuleScope(KEYS, "project-a");
  const token = scope.begin("build", "project-a");

  scope.setActiveProject("project-b");

  assert.equal(scope.isCurrent(token), false);
});

// --- Required scenario 3 (B has no data -> A's data must not remain displayed) ---
test("switching to project B invalidates every key's outstanding token, even for keys B never touched", () => {
  const scope = createWorkspaceModuleScope(KEYS, "project-a");
  const tokens = KEYS.map((key) => scope.begin(key, "project-a"));

  scope.setActiveProject("project-b");

  for (const token of tokens) {
    assert.equal(scope.isCurrent(token), false);
  }
});

// --- Required scenario 4 (rapid A -> B -> A switching) ---
test("rapid A -> B -> A switching leaves only the latest bind+request current for a key", () => {
  const scope = createWorkspaceModuleScope(KEYS, "project-a");
  const tokenA1 = scope.begin("design", "project-a");

  scope.setActiveProject("project-b");
  const tokenB1 = scope.begin("design", "project-b");

  scope.setActiveProject("project-a");
  const tokenA2 = scope.begin("design", "project-a");

  assert.equal(scope.isCurrent(tokenA1), false);
  assert.equal(scope.isCurrent(tokenB1), false);
  assert.equal(scope.isCurrent(tokenA2), true);
});

// --- Required scenario 5 (two requests in the same project, older resolves last) ---
test("within the same project, a newer request for a key supersedes an older one for that key", () => {
  const scope = createWorkspaceModuleScope(KEYS, "project-a");
  const older = scope.begin("quality", "project-a");
  const newer = scope.begin("quality", "project-a");

  assert.equal(scope.isCurrent(older), false);
  assert.equal(scope.isCurrent(newer), true);
});

// --- Required scenario 6 (loading state must not leak across projects) ---
test("a stale completion from project A does not appear current while project B has its own in-flight request for the same key", () => {
  const scope = createWorkspaceModuleScope(KEYS, "project-a");
  const staleToken = scope.begin("planning", "project-a");

  scope.setActiveProject("project-b");
  const currentToken = scope.begin("planning", "project-b");

  assert.equal(scope.isCurrent(staleToken), false);
  assert.equal(scope.isCurrent(currentToken), true);
});

// --- Required scenario 7 (error state must not leak across projects) ---
test("a stale rejection from project A cannot set project B's error state for a key", () => {
  const scope = createWorkspaceModuleScope(KEYS, "project-a");
  const token = scope.begin("controller", "project-a");

  scope.setActiveProject("project-b");

  assert.equal(scope.isCurrent(token), false);
});

// --- Required scenario 8 (project identity authoritative even if counters would look valid) ---
test("project identity is authoritative per key even when the request counter alone would appear current", () => {
  const scope = createWorkspaceModuleScope(KEYS, "project-a");
  const token = scope.begin("memory", "project-a");

  const forgedToken = { ...token, projectId: "project-b" };

  assert.equal(scope.isCurrent(forgedToken), false);
  assert.equal(scope.isCurrent(token), true);
});

// --- WorkspaceModules-specific: independent keys must not share one counter ---
test("a request for one key does not supersede an outstanding request for a different key", () => {
  const scope = createWorkspaceModuleScope(KEYS, "project-a");
  const economyToken = scope.begin("economy", "project-a");
  const buildToken = scope.begin("build", "project-a");

  assert.equal(scope.isCurrent(economyToken), true);
  assert.equal(scope.isCurrent(buildToken), true);

  scope.begin("economy", "project-a"); // a second economy request starts

  // the unrelated, still-outstanding build request must be unaffected
  assert.equal(scope.isCurrent(buildToken), true);
  assert.equal(scope.isCurrent(economyToken), false);
});

// --- Baseline: normal same-project operation is unaffected ---
test("a same-project request for a key with no switch remains current", () => {
  const scope = createWorkspaceModuleScope(KEYS, "project-a");
  const token = scope.begin("versions", "project-a");

  assert.equal(scope.isCurrent(token), true);
});

test("begin rejects an unknown module key", () => {
  const scope = createWorkspaceModuleScope(KEYS, "project-a");
  // @ts-expect-error - intentionally passing a key outside the known set
  assert.throws(() => scope.begin("not-a-real-key", "project-a"));
});
