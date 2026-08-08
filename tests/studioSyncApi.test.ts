import assert from "node:assert/strict";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import type { Project } from "../src/types/index.ts";

let vite: ViteDevServer | undefined;
const originalFetch = globalThis.fetch;
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

after(async () => {
  globalThis.fetch = originalFetch;
  await vite?.close();
});

async function loadStudioApi() {
  vite ??= await createServer({
    root: repositoryRoot,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    resolve: { alias: { "@": path.resolve(repositoryRoot, "src") } },
    server: { middlewareMode: true },
  });
  return vite.ssrLoadModule(
    "/src/services/backendApi.ts?studio-sync-test",
  ) as Promise<{
    backendApi: {
      workspace: {
        playtest(project: Project): Promise<unknown>;
        studio: {
          syncStatus(projectId: string): Promise<unknown>;
          projectSnapshot(projectId: string): Promise<unknown>;
          artifacts(projectId: string, artifactIds: string[]): Promise<unknown>;
        };
      };
    };
  }>;
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("Studio sync API sends project scope on every canonical endpoint", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/studio/sync/status")) {
      return jsonResponse({
        lastSyncTimestamp: 0,
        pendingChanges: 0,
        conflictCount: 0,
        currentVersion: "version-1",
        projectId: "project/a",
      });
    }
    if (url.endsWith("/studio/sync/project")) {
      return jsonResponse({
        projectId: "project/a",
        version: "version-1",
        artifacts: [],
        generatedAt: 0,
        artifactCount: 0,
      });
    }
    return jsonResponse({
      artifacts: [],
      missing: ["artifact-1"],
      totalSize: 0,
      payloadExceeded: false,
    });
  };

  const { backendApi } = await loadStudioApi();
  await backendApi.workspace.studio.syncStatus("project/a");
  await backendApi.workspace.studio.projectSnapshot("project/a");
  await backendApi.workspace.studio.artifacts("project/a", ["artifact-1"]);

  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /\/studio\/sync\/status\?projectId=project%2Fa$/);
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
    projectId: "project/a",
  });
  assert.deepEqual(JSON.parse(String(calls[2].init?.body)), {
    projectId: "project/a",
    artifactIds: ["artifact-1"],
  });
  assert.equal(calls[1].init?.method, "POST");
  assert.equal(calls[2].init?.method, "POST");
});

test("Studio sync API rejects malformed response contracts", async () => {
  globalThis.fetch = async () => jsonResponse({});
  const { backendApi } = await loadStudioApi();

  await assert.rejects(
    backendApi.workspace.studio.syncStatus("project-a"),
    /Studio sync timestamp/,
  );
  await assert.rejects(
    backendApi.workspace.studio.projectSnapshot("project-a"),
    /Studio snapshot artifacts/,
  );
  await assert.rejects(
    backendApi.workspace.studio.artifacts("project-a", ["artifact-a"]),
    /Studio transferred artifacts/,
  );
});

test("playtest submits the latest generated Lua artifact", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const serverContent =
    'local progress = Instance.new("RemoteEvent")\nprogress:FireClient(player, 1)';
  const clientContent =
    'local gui = Instance.new("ScreenGui")\nprogress.OnClientEvent:Connect(function() end)';

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/studio/sync/project")) {
      return jsonResponse({
        projectId: "exec-latest",
        version: "1.0.0-latest",
        artifacts: [
          {
            id: "artifact-lua",
            type: "lua",
            name: "generatedScripts.lua",
            stage: "LUA_GENERATION",
            size: 300,
            hash: "0123456789abcdef",
            version: 1,
            createdAt: 2,
            reviewStatus: "pending",
          },
        ],
        generatedAt: 3,
        artifactCount: 1,
      });
    }
    if (url.endsWith("/studio/sync/artifacts")) {
      return jsonResponse({
        artifacts: [
          {
            id: "artifact-lua",
            type: "lua",
            name: "generatedScripts.lua",
            stage: "LUA_GENERATION",
            size: 300,
            createdAt: 2,
            reviewStatus: "pending",
            content: {
              scripts: [
                {
                  path: "ServerScriptService/PlayableWorld.server.lua",
                  content: serverContent,
                },
                {
                  path: "StarterPlayerScripts/ObjectiveHud.client.lua",
                  content: clientContent,
                },
              ],
            },
          },
        ],
        missing: [],
        totalSize: 300,
        payloadExceeded: false,
      });
    }
    return jsonResponse({ accepted: true });
  };

  const project: Project = {
    id: "project-real",
    name: "Real artifacts",
    description: "Quality tools must inspect generated Lua.",
    gameType: "adventure",
    genre: "Adventure",
    difficulty: "Medium",
    players: "1-10",
    targetAudience: "Everyone",
    status: "ready",
    progress: 100,
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
    thumbnailHue: 200,
  };
  const { backendApi } = await loadStudioApi();
  await backendApi.workspace.playtest(project);

  const snapshots = calls.filter(({ url }) =>
    url.endsWith("/studio/sync/project"),
  );
  const transfers = calls.filter(({ url }) =>
    url.endsWith("/studio/sync/artifacts"),
  );
  assert.equal(snapshots.length, 1);
  assert.equal(transfers.length, 1);
  assert.deepEqual(JSON.parse(String(transfers[0].init?.body)), {
    projectId: project.id,
    artifactIds: ["artifact-lua"],
  });

  const playtestCall = calls.find(({ url }) => url.endsWith("/playtest/run"));
  assert.ok(playtestCall);
  const playtestBody = JSON.parse(String(playtestCall.init?.body));

  assert.equal(playtestBody.projectId, project.id);
  assert.equal(playtestBody.scripts.length, 2);
  assert.equal(playtestBody.scripts[0].type, "ServerScript");
  assert.equal(playtestBody.scripts[0].content, serverContent);
  assert.equal(playtestBody.scripts[1].type, "LocalScript");
  assert.equal(playtestBody.scripts[1].content, clientContent);
  assert.equal(
    playtestBody.scripts.some(
      (script: { name: string }) => script.name === "Main",
    ),
    false,
  );
});
