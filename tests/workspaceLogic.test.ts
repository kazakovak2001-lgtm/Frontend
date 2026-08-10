import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKSPACE_MODULE_KEYS,
  WORKSPACE_MODULE_STAGES,
  buildWorkspaceBlockers,
  describeRealtimeSnapshot,
  describeWorkspaceRun,
  getWorkspaceModuleKeys,
  getWorkspaceNextAction,
  summarizeWorkspaceResult,
  type WorkspaceDecisionContext,
} from "../src/components/workspace/workspaceLogic.ts";

function context(
  overrides: Partial<WorkspaceDecisionContext["readiness"]> = {},
): WorkspaceDecisionContext {
  return {
    readiness: {
      hasBlueprint: true,
      hasExecution: true,
      hasCompletedExecution: true,
      canValidate: true,
      studioConnected: true,
      studioArtifactVerified: true,
      studioVerificationStatus: "verified",
      ...overrides,
    },
    degradedSources: [],
    latestExecution: { status: "completed" },
  };
}

test("stage registry assigns every module exactly once", () => {
  const assigned = WORKSPACE_MODULE_STAGES.flatMap((stage) => [
    ...getWorkspaceModuleKeys(stage),
  ]);

  assert.equal(new Set(assigned).size, WORKSPACE_MODULE_KEYS.length);
  assert.deepEqual([...assigned].sort(), [...WORKSPACE_MODULE_KEYS].sort());
  assert.deepEqual(getWorkspaceModuleKeys("define"), [
    "knowledge",
    "design",
    "memory",
  ]);
  assert.deepEqual(getWorkspaceModuleKeys("validate"), [
    "controller",
    "simulation",
    "economy",
    "world",
    "quality",
  ]);
});

test("omitting a stage preserves the complete tool inventory", () => {
  assert.deepEqual(getWorkspaceModuleKeys(), WORKSPACE_MODULE_KEYS);
});

test("next action follows the durable workflow gates", () => {
  assert.equal(getWorkspaceNextAction(undefined, "operate").stage, "define");
  assert.equal(
    getWorkspaceNextAction(context({ hasCompletedExecution: false }), "define")
      .stage,
    "generate",
  );
  assert.equal(getWorkspaceNextAction(context(), "define").stage, "validate");
  assert.equal(
    getWorkspaceNextAction(context({ studioConnected: false }), "validate")
      .stage,
    "integrate",
  );
  assert.deepEqual(
    getWorkspaceNextAction(
      context({
        studioArtifactVerified: false,
        studioVerificationStatus: "acknowledged",
      }),
      "validate",
    ),
    {
      stage: "integrate",
      title: "Complete Studio verification",
      description:
        "Sync the generated package and wait for exact artifact receipts.",
    },
  );
  assert.equal(
    getWorkspaceNextAction(
      context({
        studioArtifactVerified: false,
        studioVerificationStatus: "failed",
        studioVerificationError: "Receipt mismatch",
      }),
      "validate",
    ).title,
    "Resolve Studio verification",
  );
  assert.equal(getWorkspaceNextAction(context(), "validate").stage, "operate");
});

test("blockers reflect missing durable and Studio conditions", () => {
  assert.deepEqual(buildWorkspaceBlockers(undefined), [
    "Workspace data has not loaded yet.",
  ]);

  const blockers = buildWorkspaceBlockers({
    readiness: {
      hasBlueprint: false,
      hasExecution: true,
      hasCompletedExecution: false,
      canValidate: false,
      studioConnected: false,
      studioArtifactVerified: false,
      studioVerificationStatus: "idle",
    },
    degradedSources: ["agent registry: unavailable"],
    latestExecution: {
      status: "failed",
      error_message: "Pipeline failed at compile",
    },
  });

  assert.deepEqual(blockers, [
    "A durable blueprint has not been generated.",
    "The latest generation execution is not complete.",
    "Roblox Studio is not connected to this project.",
    "Pipeline failed at compile",
  ]);

  assert.deepEqual(
    buildWorkspaceBlockers(
      context({
        studioArtifactVerified: false,
        studioVerificationStatus: "delivered",
      }),
    ),
    ["Generated artifacts reached Roblox Studio and await acknowledgement."],
  );
  assert.deepEqual(
    buildWorkspaceBlockers(
      context({
        studioArtifactVerified: false,
        studioVerificationStatus: "failed",
        studioVerificationError: "Receipt hash did not match.",
      }),
    ),
    ["Studio artifact verification failed: Receipt hash did not match."],
  );
  assert.deepEqual(
    buildWorkspaceBlockers(
      context({
        studioArtifactVerified: false,
        studioVerificationStatus: "verified",
        studioVerificationError:
          "Studio verification belongs to execution execution-old; the latest execution is execution-new.",
      }),
    ),
    [
      "Studio verification belongs to execution execution-old; the latest execution is execution-new.",
    ],
  );
  assert.deepEqual(buildWorkspaceBlockers(context()), []);
});

test("result summary prioritizes operational fields", () => {
  assert.deepEqual(
    summarizeWorkspaceResult({
      arbitrary: "later",
      status: "healthy",
      qualityScore: 94,
      warnings: ["one", "two"],
    }),
    [
      { label: "Status", value: "healthy" },
      { label: "Quality Score", value: "94" },
      { label: "Warnings", value: "2 items" },
      { label: "Arbitrary", value: "later" },
    ],
  );
});

test("result summary handles arrays and nested records", () => {
  assert.deepEqual(
    summarizeWorkspaceResult([{ id: "agent-1", status: "running" }]),
    [
      { label: "Items", value: "1" },
      { label: "First item", value: "agent-1" },
    ],
  );
  assert.deepEqual(summarizeWorkspaceResult({ report: { status: "passed" } }), [
    { label: "Report", value: "passed" },
  ]);
});

test("run descriptions distinguish active, completed, failed and idle", () => {
  assert.equal(
    describeWorkspaceRun("running"),
    "The generation pipeline is active.",
  );
  assert.equal(
    describeWorkspaceRun("completed"),
    "The latest known run completed successfully.",
  );
  assert.equal(
    describeWorkspaceRun("failed"),
    "The latest known run needs attention.",
  );
  assert.equal(
    describeWorkspaceRun("draft"),
    "No active generation run is reported.",
  );
});

test("an unrecognized run status is never folded into 'no active generation run'", () => {
  const described = describeWorkspaceRun("some-future-backend-status");
  assert.notEqual(described, "No active generation run is reported.");
  assert.equal(
    described,
    'Generation status "some-future-backend-status" is not recognized by this UI.',
  );
});

test("the explicit 'unknown' status gets its own truthful description, distinct from both 'draft' and generic unrecognized text", () => {
  const described = describeWorkspaceRun("unknown");
  assert.equal(described, "Generation status is not yet known.");
  assert.notEqual(described, "No active generation run is reported.");
});

test("realtime snapshot description shows progress only while genuinely running", () => {
  assert.equal(
    describeRealtimeSnapshot({ status: "running", progress: 42 }),
    "running · 42%",
  );
});

test("realtime snapshot description never fabricates status/progress when no snapshot has been reported yet", () => {
  assert.equal(describeRealtimeSnapshot(undefined), "Status not yet reported");
  assert.equal(
    describeRealtimeSnapshot({ status: "unknown", progress: 0 }),
    "Status not yet reported",
  );
});

test("realtime snapshot description shows a terminal status without a stale/irrelevant percentage", () => {
  assert.equal(
    describeRealtimeSnapshot({ status: "completed", progress: 100 }),
    "completed",
  );
  assert.equal(
    describeRealtimeSnapshot({ status: "failed", progress: 30 }),
    "failed",
  );
});
