import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProjectQualityInput,
  selectQualityArtifactIds,
} from "../src/services/projectQualityArtifacts.ts";
import type {
  ArtifactTransferResult,
  ProjectSnapshot,
} from "../src/services/workspaceStudioSync.ts";

const snapshot: ProjectSnapshot = {
  projectId: "exec-latest",
  version: "1.0.0-latest",
  artifacts: [
    {
      id: "artifact-lua",
      type: "lua",
      name: "generatedScripts.lua",
      stage: "LUA_GENERATION",
      size: 400,
      hash: "0123456789abcdef",
      version: 1,
      createdAt: 2,
      reviewStatus: "pending",
    },
    {
      id: "artifact-assets",
      type: "asset-plan",
      name: "assetPlan.json",
      stage: "ASSET_PLANNING",
      size: 100,
      hash: "fedcba9876543210",
      version: 1,
      createdAt: 1,
      reviewStatus: "pending",
    },
    {
      id: "artifact-export",
      type: "manifest",
      name: "exportManifest.json",
      stage: "EXPORT",
      size: 100,
      hash: "0011223344556677",
      version: 1,
      createdAt: 3,
      reviewStatus: "pending",
    },
  ],
  generatedAt: 3,
  artifactCount: 3,
};

const transfer: ArtifactTransferResult = {
  artifacts: [
    {
      id: "artifact-lua",
      type: "lua",
      name: "generatedScripts.lua",
      stage: "LUA_GENERATION",
      size: 400,
      createdAt: 2,
      reviewStatus: "pending",
      content: {
        scripts: [
          {
            path: "ServerScriptService/PlayableWorld.server.lua",
            content:
              'local event = Instance.new("RemoteEvent")\nevent:FireClient(player, 1)',
          },
          {
            path: "StarterPlayerScripts/ObjectiveHud.client.lua",
            content:
              'local gui = Instance.new("ScreenGui")\nevent.OnClientEvent:Connect(function() end)',
          },
        ],
      },
    },
    {
      id: "artifact-assets",
      type: "asset-plan",
      name: "assetPlan.json",
      stage: "ASSET_PLANNING",
      size: 100,
      createdAt: 1,
      reviewStatus: "pending",
      content: {
        assetPlan: {
          models: [{ id: "model-world", name: "World" }],
          sounds: [{ id: "sound-pickup", name: "Pickup" }],
        },
      },
    },
  ],
  missing: [],
  totalSize: 500,
  payloadExceeded: false,
};

test("selects only the real Lua and asset-plan artifacts", () => {
  assert.deepEqual(selectQualityArtifactIds(snapshot), [
    "artifact-lua",
    "artifact-assets",
  ]);
});

test("maps generated server and client Lua without changing source", () => {
  const input = buildProjectQualityInput("project-1", transfer);

  assert.equal(input.projectId, "project-1");
  assert.equal(input.scripts.length, 2);
  assert.deepEqual(
    input.scripts.map(({ name, type, path }) => ({ name, type, path })),
    [
      {
        name: "PlayableWorld",
        type: "ServerScript",
        path: "ServerScriptService/PlayableWorld.server.lua",
      },
      {
        name: "ObjectiveHud",
        type: "LocalScript",
        path: "StarterPlayerScripts/ObjectiveHud.client.lua",
      },
    ],
  );
  assert.match(input.scripts[0].content, /RemoteEvent/);
  assert.match(input.scripts[1].content, /OnClientEvent/);
  assert.deepEqual(input.dependencyGraph.nodes, [
    "ServerScriptService/PlayableWorld.server.lua",
    "StarterPlayerScripts/ObjectiveHud.client.lua",
  ]);
  assert.deepEqual(input.assets, [
    {
      name: "World",
      type: "model",
      targetService: "Workspace",
      placeholder: true,
    },
    {
      name: "Pickup",
      type: "sound",
      targetService: "SoundService",
      placeholder: true,
    },
  ]);
});

test("fails closed when the latest snapshot has no generated Lua", () => {
  assert.throws(
    () =>
      selectQualityArtifactIds({
        ...snapshot,
        artifacts: snapshot.artifacts.filter(
          (artifact) => artifact.stage !== "LUA_GENERATION",
        ),
        artifactCount: 2,
      }),
    /Generated Lua artifacts are unavailable/,
  );
});

test("fails closed for missing or malformed transferred Lua", () => {
  assert.throws(
    () =>
      buildProjectQualityInput("project-1", {
        ...transfer,
        missing: ["artifact-lua"],
      }),
    /Generated artifacts are incomplete/,
  );
  assert.throws(
    () =>
      buildProjectQualityInput("project-1", {
        ...transfer,
        artifacts: [
          {
            ...transfer.artifacts[0],
            content: { scripts: [] },
          },
        ],
      }),
    /does not contain scripts/,
  );
});
