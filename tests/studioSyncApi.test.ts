import assert from "node:assert/strict";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";

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
    calls.push({ url: String(input), init });
    return jsonResponse({});
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
