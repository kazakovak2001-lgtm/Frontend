import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";

/**
 * GENERATION-SURFACE-CANONICALIZATION-1.
 *
 * The canonical production Generate action is the page-level "Generate"
 * button, which calls `backendApi.ai.startGeneration` -> the durable
 * `POST /projects/:id/generate`. The Workspace "Planning & Autonomous
 * Generation" card used to also expose a "Generation core" button calling
 * `POST /generate/game` (generation-v2): a separate, non-durable pipeline
 * that never writes an execution, a history entry or an ArtifactStore
 * artifact, sitting right next to the real Generate action on the same
 * stage. A user could not tell the two apart from the UI, and only one of
 * them survives a restart or reaches Studio.
 *
 * This pins that the shadow surface is gone from the client entirely: no
 * button reaches it, and the client no longer even exposes a function that
 * could call it. The backend route itself is untouched — the e2e diagnostic
 * script (`scripts/e2e-backend.mjs`) still calls it directly by URL, not
 * through this client, which is the one proven legitimate caller left.
 */

let vite: ViteDevServer | undefined;
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

after(async () => {
  await vite?.close();
});

async function loadModule<T>(specifier: string): Promise<T> {
  vite ??= await createServer({
    root: repositoryRoot,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    resolve: { alias: { "@": path.resolve(repositoryRoot, "src") } },
    server: { middlewareMode: true },
  });
  return vite.ssrLoadModule(specifier) as Promise<T>;
}

test("the backend API client no longer exposes a generation-v2 call", async () => {
  const { backendApi } = await loadModule<{
    backendApi: { workspace: Record<string, unknown> };
  }>("/src/services/backendApi.ts?generation-surface-canonicalization-test");

  assert.equal(
    "generationCore" in backendApi.workspace,
    false,
    "backendApi.workspace must not expose a generation-v2 caller",
  );
});

test("the canonical generate action still targets the durable project-scoped route", async () => {
  const { backendApi } = await loadModule<{
    backendApi: {
      ai: { startGeneration: (projectId: string) => Promise<unknown> };
    };
  }>("/src/services/backendApi.ts?generation-surface-canonicalization-test-2");

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(
      JSON.stringify({
        success: true,
        data: { executionId: "exec-1", status: "generation_started" },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    await backendApi.ai.startGeneration("project-canon");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/projects\/project-canon\/generate$/);
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.ok(headers["Idempotency-Key"], "canonical start must carry a key");
});

test("no Workspace UI source references the generation-v2 endpoint or label", () => {
  const workspaceDir = path.join(repositoryRoot, "src/components/workspace");
  const offenders: string[] = [];
  for (const file of fs.readdirSync(workspaceDir)) {
    if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
    const source = fs.readFileSync(path.join(workspaceDir, file), "utf8");
    if (
      /generate\/game/i.test(source) ||
      /generationCore/.test(source) ||
      />\s*Generation core\s*</.test(source)
    ) {
      offenders.push(file);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `generation-v2 UI reference(s) found in: ${offenders.join(", ")}`,
  );
});
