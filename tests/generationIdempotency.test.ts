import assert from "node:assert/strict";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";

/**
 * MAR-004 — the frontend's half of the idempotent-start contract.
 *
 * The backend requires an `Idempotency-Key` header on
 * `POST /projects/:id/generate` and returns the run a key already started
 * rather than a conflict or a silent second generation. None of that matters
 * if the canonical caller never sends the header, which is what this pins.
 *
 * The key has to be reused for a genuine retry and dropped for a genuinely
 * new attempt, and the only signal available client-side is whether `fetch`
 * produced an HTTP response at all. A response — success or an error status
 * — is the server having spoken, and the next click is a new attempt. A
 * rejected `fetch` means nothing is known, and a retry has to carry the same
 * key the unanswered attempt used.
 */

let vite: ViteDevServer | undefined;
const originalFetch = globalThis.fetch;
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

after(async () => {
  globalThis.fetch = originalFetch;
  await vite?.close();
});

async function loadBackendApi() {
  vite ??= await createServer({
    root: repositoryRoot,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    resolve: { alias: { "@": path.resolve(repositoryRoot, "src") } },
    server: { middlewareMode: true },
  });
  return vite.ssrLoadModule(
    "/src/services/backendApi.ts?generation-idempotency-test",
  ) as Promise<{
    backendApi: {
      ai: {
        startGeneration(
          projectId: string,
          userId?: string,
        ): Promise<{ executionId: string; status: string }>;
      };
    };
  }>;
}

function jsonResponse(data: unknown, success = true): Response {
  return new Response(
    JSON.stringify(
      success ? { success: true, data } : { success: false, error: data },
    ),
    {
      status: success ? 200 : 409,
      headers: { "Content-Type": "application/json" },
    },
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test("startGeneration sends an Idempotency-Key header", async () => {
  const calls: Array<RequestInit | undefined> = [];
  globalThis.fetch = async (_input, init) => {
    calls.push(init);
    return jsonResponse({
      executionId: "exec-1",
      status: "generation_started",
    });
  };

  const { backendApi } = await loadBackendApi();
  await backendApi.ai.startGeneration("project-a");

  assert.equal(calls.length, 1);
  const headers = calls[0]?.headers as Record<string, string>;
  assert.match(headers["Idempotency-Key"], UUID_PATTERN);
});

test("a retry after a lost response reuses the same key", async () => {
  const keys: string[] = [];
  let attempt = 0;
  globalThis.fetch = async (_input, init) => {
    attempt += 1;
    keys.push((init?.headers as Record<string, string>)["Idempotency-Key"]);
    if (attempt === 1) {
      // No HTTP response at all — the exact case a lost response models.
      throw new TypeError("network error");
    }
    return jsonResponse({
      executionId: "exec-1",
      status: "generation_started",
    });
  };

  const { backendApi } = await loadBackendApi();
  await assert.rejects(backendApi.ai.startGeneration("project-b"));
  await backendApi.ai.startGeneration("project-b");

  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});

test("a request after a successful start gets a fresh key", async () => {
  const keys: string[] = [];
  globalThis.fetch = async (_input, init) => {
    keys.push((init?.headers as Record<string, string>)["Idempotency-Key"]);
    return jsonResponse({
      executionId: "exec-1",
      status: "generation_started",
    });
  };

  const { backendApi } = await loadBackendApi();
  await backendApi.ai.startGeneration("project-c");
  await backendApi.ai.startGeneration("project-c");

  assert.equal(keys.length, 2);
  assert.notEqual(keys[0], keys[1]);
});

test("a request after a definitive conflict response gets a fresh key", async () => {
  const keys: string[] = [];
  let attempt = 0;
  globalThis.fetch = async (_input, init) => {
    attempt += 1;
    keys.push((init?.headers as Record<string, string>)["Idempotency-Key"]);
    if (attempt === 1) {
      // A real HTTP response — the server answered, even though the answer
      // was a conflict. That is a definitive outcome, unlike the network
      // failure in the retry test above.
      return jsonResponse(
        "A generation is already running for this project",
        false,
      );
    }
    return jsonResponse({
      executionId: "exec-2",
      status: "generation_started",
    });
  };

  const { backendApi } = await loadBackendApi();
  await assert.rejects(backendApi.ai.startGeneration("project-d"));
  await backendApi.ai.startGeneration("project-d");

  assert.equal(keys.length, 2);
  assert.notEqual(keys[0], keys[1]);
});

test("two different projects never share a key", async () => {
  const keysByProject = new Map<string, string>();
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const projectId = decodeURIComponent(
      url.match(/\/projects\/([^/]+)\/generate$/)?.[1] ?? "",
    );
    keysByProject.set(
      projectId,
      (init?.headers as Record<string, string>)["Idempotency-Key"],
    );
    return jsonResponse({
      executionId: "exec-x",
      status: "generation_started",
    });
  };

  const { backendApi } = await loadBackendApi();
  await backendApi.ai.startGeneration("project-e");
  await backendApi.ai.startGeneration("project-f");

  assert.notEqual(
    keysByProject.get("project-e"),
    keysByProject.get("project-f"),
  );
});
