import assert from "node:assert/strict";
import test from "node:test";
import {
  parseArtifactTransferResult,
  parseProjectSnapshot,
  parseStudioSyncStatus,
  unavailableStudioSyncStatus,
  type ArtifactRef,
  type ProjectSnapshot,
  type StudioSyncStatus,
  type SyncChange,
} from "../src/services/workspaceStudioSync.ts";

const artifact: ArtifactRef = {
  id: "artifact-1",
  type: "lua",
  name: "Main.server.lua",
  stage: "LUA_GENERATION",
  size: 42,
  hash: "0123456789abcdef",
  version: 1,
  createdAt: 1_800_000_000_000,
  reviewStatus: "approved",
};

const snapshot: ProjectSnapshot = {
  projectId: "project-1",
  version: "1.0.0-a1b2c3d4",
  artifacts: [artifact],
  generatedAt: 1_800_000_000_001,
  artifactCount: 1,
};

const change: SyncChange = {
  changeId: "change-1",
  artifactId: artifact.id,
  artifactType: artifact.type,
  changeType: "update",
  content: "print('updated')",
  timestamp: 1_800_000_000_002,
};

test("Studio sync contract types preserve the backend field names", () => {
  const status: StudioSyncStatus = parseStudioSyncStatus({
    lastSyncTimestamp: 1_800_000_000_003,
    pendingChanges: 2,
    conflictCount: 1,
    currentVersion: snapshot.version,
    projectId: snapshot.projectId,
  });

  assert.equal(status.currentVersion, snapshot.version);
  assert.equal(change.changeType, "update");
  assert.deepEqual(parseProjectSnapshot(snapshot), snapshot);
});

test("100 generated valid sync statuses parse without losing counters", () => {
  for (let index = 0; index < 100; index += 1) {
    const parsed = parseStudioSyncStatus({
      lastSyncTimestamp: index === 0 ? null : index * 1_000,
      pendingChanges: index,
      conflictCount: 99 - index,
      currentVersion: `1.0.0-${index.toString(16).padStart(8, "0")}`,
      projectId: `project-${index}`,
    });
    assert.equal(parsed.pendingChanges, index);
    assert.equal(parsed.conflictCount, 99 - index);
    assert.equal(parsed.projectId, `project-${index}`);
  }
});

test("malformed sync status and inconsistent snapshots fail closed", () => {
  assert.throws(
    () =>
      parseStudioSyncStatus({
        lastSyncTimestamp: null,
        pendingChanges: -1,
        conflictCount: 0,
        currentVersion: "1.0.0-test",
        projectId: "project-1",
      }),
    /Invalid Studio pending changes/,
  );
  assert.throws(
    () => parseProjectSnapshot({ ...snapshot, artifactCount: 2 }),
    /Invalid Studio snapshot artifact count/,
  );
});

test("artifact transfer parser preserves missing IDs and payload limits", () => {
  const result = parseArtifactTransferResult({
    artifacts: [{ ...artifact, content: "print('ok')" }],
    missing: ["artifact-outside-project"],
    totalSize: 11,
    payloadExceeded: false,
  });

  assert.equal(result.artifacts[0].id, artifact.id);
  assert.deepEqual(result.missing, ["artifact-outside-project"]);
  assert.equal(result.payloadExceeded, false);
});

test("unavailable fallback is project-scoped and visibly degraded", () => {
  assert.deepEqual(unavailableStudioSyncStatus("project-7"), {
    lastSyncTimestamp: null,
    pendingChanges: 0,
    conflictCount: 0,
    currentVersion: "unavailable",
    projectId: "project-7",
  });
});
