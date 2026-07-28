import test from "node:test";
import assert from "node:assert/strict";
import {
  canSyncWorkspaceStudio,
  describeWorkspaceStudioVerification,
  disconnectedWorkspaceStudioStatus,
  isWorkspaceStudioArtifactVerified,
  parseWorkspaceStudioStatus,
} from "../src/services/workspaceStudioStatus.ts";

const connectedStatus = {
  status: "connected",
  studioId: "studio-test",
  bridgeVersion: "2.4.0",
  pendingChanges: 0,
  artifactVerified: false,
  verificationStatus: "idle",
};

test("verified Studio responses expose exact backend evidence", () => {
  const status = parseWorkspaceStudioStatus({
    ...connectedStatus,
    lastSyncAt: "2026-07-28T09:00:00.000Z",
    artifactVerified: true,
    verificationStatus: "verified",
    lastCommandId: "command-verified",
    verifiedExecutionId: "execution-verified",
    verifiedArtifactCount: 3,
  });

  assert.equal(
    isWorkspaceStudioArtifactVerified(status, "execution-verified"),
    true,
  );
  assert.equal(
    isWorkspaceStudioArtifactVerified(status, "execution-newer"),
    false,
  );
  assert.equal(canSyncWorkspaceStudio(status), true);
  assert.equal(status.verifiedExecutionId, "execution-verified");
  assert.equal(status.verifiedArtifactCount, 3);
  assert.equal(
    describeWorkspaceStudioVerification(status),
    "3 generated artifacts verified for execution execution-verified.",
  );
});

test("pending Studio responses preserve each delivery state", () => {
  const expected = {
    queued: "Generated project artifacts are queued for Roblox Studio.",
    delivered:
      "The generated export reached Roblox Studio and awaits acknowledgement.",
    acknowledged:
      "Roblox Studio acknowledged the export and is applying its artifacts.",
  } as const;

  for (const [verificationStatus, description] of Object.entries(expected)) {
    const status = parseWorkspaceStudioStatus({
      ...connectedStatus,
      status: "syncing",
      verificationStatus,
      pendingChanges: 1,
    });
    assert.equal(isWorkspaceStudioArtifactVerified(status, undefined), false);
    assert.equal(canSyncWorkspaceStudio(status), false);
    assert.equal(status.verificationStatus, verificationStatus);
    assert.equal(describeWorkspaceStudioVerification(status), description);
  }
});

test("failed Studio responses preserve the verification error", () => {
  const status = parseWorkspaceStudioStatus({
    ...connectedStatus,
    status: "error",
    verificationStatus: "failed",
    verificationError: "Receipt hash did not match.",
  });

  assert.equal(isWorkspaceStudioArtifactVerified(status, undefined), false);
  assert.equal(canSyncWorkspaceStudio(status), true);
  assert.equal(status.verificationError, "Receipt hash did not match.");
  assert.equal(
    describeWorkspaceStudioVerification(status),
    "Receipt hash did not match.",
  );
});

test("malformed Studio verification claims fail closed", () => {
  assert.throws(
    () =>
      parseWorkspaceStudioStatus({
        ...connectedStatus,
        artifactVerified: "true",
        verificationStatus: "verified",
      }),
    /Invalid Studio artifact verification/,
  );
  assert.throws(
    () =>
      parseWorkspaceStudioStatus({
        ...connectedStatus,
        artifactVerified: true,
        verificationStatus: "delivered",
      }),
    /Invalid Studio verification claim/,
  );
  assert.throws(
    () =>
      parseWorkspaceStudioStatus({
        ...connectedStatus,
        artifactVerified: true,
        verificationStatus: "verified",
      }),
    /Incomplete Studio verification evidence/,
  );
  assert.throws(
    () =>
      parseWorkspaceStudioStatus({
        ...connectedStatus,
        artifactVerified: true,
        verificationStatus: "verified",
        verifiedExecutionId: "execution-empty",
        verifiedArtifactCount: 0,
      }),
    /Incomplete Studio verification evidence/,
  );
});

test("disconnected Studio responses remain unverified", () => {
  const backendStatus = parseWorkspaceStudioStatus({
    status: "disconnected",
    bridgeVersion: "2.4.0",
    pendingChanges: 0,
    artifactVerified: false,
    verificationStatus: "idle",
  });
  const unavailableStatus = disconnectedWorkspaceStudioStatus();

  assert.equal(
    isWorkspaceStudioArtifactVerified(backendStatus, "execution-current"),
    false,
  );
  assert.equal(
    isWorkspaceStudioArtifactVerified(unavailableStatus, "execution-current"),
    false,
  );
  assert.equal(canSyncWorkspaceStudio(backendStatus), false);
  assert.equal(canSyncWorkspaceStudio(unavailableStatus), false);
  assert.equal(
    describeWorkspaceStudioVerification(backendStatus),
    "Connect Roblox Studio before verifying generated artifacts.",
  );
});
