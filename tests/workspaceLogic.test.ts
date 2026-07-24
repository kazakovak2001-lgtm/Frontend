import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKSPACE_MODULE_KEYS,
  WORKSPACE_MODULE_STAGES,
  buildWorkspaceBlockers,
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
    getWorkspaceNextAction(
      context({ hasCompletedExecution: false }),
      "define",
    ).stage,
    "generate",
  );
  assert.equal(getWorkspaceNextAction(context(), "define").stage, "validate");
  assert.equal(
    getWorkspaceNextAction(context({ studioConnected: false }), "validate")
      .stage,
    "integrate",
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
    "Real generated-artifact delivery is pending STUDIO-1 verification.",
  ]);
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
