import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGeneratedOutput,
  classifyScriptPath,
  selectOutputArtifactIds,
} from "../src/services/generatedOutput.ts";
import type {
  ArtifactTransferResult,
  ProjectSnapshot,
} from "../src/services/workspaceStudioSync.ts";

type Artifact = ArtifactTransferResult["artifacts"][number];

function artifact(stage: string, content: unknown, id = stage): Artifact {
  return {
    id,
    type: "json",
    name: stage,
    stage,
    size: 1,
    createdAt: 1,
    reviewStatus: "pending",
    content,
  };
}

function transfer(
  artifacts: Artifact[],
  extra: Partial<ArtifactTransferResult> = {},
): ArtifactTransferResult {
  return {
    artifacts,
    missing: [],
    totalSize: 1,
    payloadExceeded: false,
    ...extra,
  };
}

const design = artifact("GAME_DESIGN", {
  gameplay: {
    mechanics: [{ name: "Coin collecting", description: "Pick up coins" }],
  },
  loop: "collect -> upgrade -> repeat",
  progressionModel: "Level thresholds",
  interactionSystems: ["Shop", "Leaderboard"],
  economyOrScoring: "Coins",
});
const lua = artifact("LUA_GENERATION", {
  scripts: [
    {
      path: "ServerScriptService/CoinService.server.lua",
      content: "-- CoinService\nprint('x')",
    },
    {
      path: "ReplicatedStorage/Shared/Config.lua",
      content: "return {}",
    },
  ],
});
const passing = artifact("VALIDATION", {
  passed: true,
  blockingFailures: 0,
  advisoryFailures: 1,
  checks: [
    {
      id: "lua-syntax",
      title: "Lua structure",
      status: "passed",
      enforcement: "blocking",
      details: [],
    },
    {
      id: "security",
      title: "Security",
      status: "failed",
      enforcement: "advisory",
      details: ["RemoteEvent without validation"],
    },
  ],
  limits: ["Not a runtime test"],
});

test("complete validated output is ready and keeps content verbatim", () => {
  const out = buildGeneratedOutput(transfer([design, lua, passing]));
  assert.equal(out.status, "ready");
  assert.deepEqual(
    out.files.map((f) => [f.path, f.kind]),
    [
      ["ReplicatedStorage/Shared/Config.lua", "module"],
      ["ServerScriptService/CoinService.server.lua", "server"],
    ],
  );
  assert.equal(out.files[1].content, "-- CoinService\nprint('x')");
  assert.equal(out.files[1].hasHeader, true);
  assert.equal(out.files[0].hasHeader, false);
  assert.equal(out.validation?.advisoryFailures, 1);
  const titles = out.design?.map((s) => s.title);
  assert.deepEqual(titles, [
    "Core Gameplay Loop",
    "Main Mechanics",
    "Player Progression",
    "Game Systems",
    "Economy",
  ]);
});

test("failed validation is never presented as ready", () => {
  const failed = artifact("VALIDATION", {
    passed: false,
    blockingFailures: 1,
    advisoryFailures: 0,
    checks: [
      {
        id: "lua-syntax",
        title: "Lua structure",
        status: "failed",
        enforcement: "blocking",
        details: ["no server script"],
      },
    ],
    limits: [],
  });
  const out = buildGeneratedOutput(transfer([design, lua, failed]));
  assert.equal(out.status, "validation_failed");
  assert.equal(out.validation?.passed, false);
});

test("report claiming success with a failing blocking check fails closed", () => {
  const lying = artifact("VALIDATION", {
    passed: true,
    checks: [
      {
        id: "x",
        title: "x",
        status: "failed",
        enforcement: "blocking",
        details: [],
      },
    ],
  });
  const out = buildGeneratedOutput(transfer([design, lua, lying]));
  assert.equal(out.status, "validation_failed");
  assert.equal(out.validation?.blockingFailures, 1);
});

test("missing or unreadable validation is unvalidated or incomplete, not ready", () => {
  assert.equal(
    buildGeneratedOutput(transfer([design, lua])).status,
    "unvalidated",
  );
  const unreadable = artifact("VALIDATION", { passed: "yes" });
  const out = buildGeneratedOutput(transfer([design, lua, unreadable]));
  assert.equal(out.status, "incomplete");
  assert.equal(out.validation, null);
  assert.match(out.issues.join(" "), /unreadable/);
});

test("missing artifacts and oversize payload mark output incomplete", () => {
  const out = buildGeneratedOutput(
    transfer([design, lua, passing], {
      missing: ["gone"],
      payloadExceeded: true,
    }),
  );
  assert.equal(out.status, "incomplete");
  assert.equal(out.issues.length, 2);
});

test("empty transfer is empty and malformed scripts are skipped with issues", () => {
  assert.equal(buildGeneratedOutput(transfer([])).status, "empty");
  const bad = artifact("LUA_GENERATION", {
    scripts: [
      { path: "A.lua", content: "x" },
      { path: "A.lua", content: "dup" },
      { path: "", content: "x" },
      { path: "B.lua" },
    ],
  });
  const out = buildGeneratedOutput(transfer([design, bad, passing]));
  assert.equal(out.files.length, 1);
  assert.equal(out.issues.length, 3);
  assert.equal(out.status, "incomplete");
});

test("selectOutputArtifactIds picks only output stages", () => {
  const snapshot: ProjectSnapshot = {
    projectId: "p1",
    version: "1",
    generatedAt: 1,
    artifactCount: 3,
    artifacts: ["GAME_DESIGN", "EXPORT", "VALIDATION"].map((stage, i) => ({
      id: `a${i}`,
      type: "json",
      name: stage,
      stage,
      size: 1,
      hash: "h",
      version: 1,
      createdAt: 1,
      reviewStatus: "pending",
    })),
  };
  assert.deepEqual(selectOutputArtifactIds(snapshot), ["a0", "a2"]);
});

test("classifyScriptPath", () => {
  assert.equal(
    classifyScriptPath("StarterPlayer/StarterPlayerScripts/X.client.lua"),
    "client",
  );
  assert.equal(classifyScriptPath("Workspace/X.lua"), "other");
});
