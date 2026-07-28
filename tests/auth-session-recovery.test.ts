import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer, type ViteDevServer } from "vite";

let vite: ViteDevServer | undefined;
const originalFetch = globalThis.fetch;

after(async () => {
  globalThis.fetch = originalFetch;
  await vite?.close();
});

async function loadBackendApi(caseName: string) {
  vite ??= await createServer({
    root: process.cwd(),
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });

  return vite.ssrLoadModule(
    `/src/services/backendApi.ts?auth-test=${encodeURIComponent(caseName)}`,
  ) as Promise<{
    BackendApiError: new (
      message: string,
      status: number,
      details?: unknown,
    ) => Error & { status: number };
    backendApi: {
      auth: { me(): Promise<{ id: string; email: string; name: string }> };
      projects: { list(): Promise<unknown[]> };
    };
  }>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("restores an expired access session through the refresh cookie", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let meCalls = 0;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });

    if (url.endsWith("/platform/auth/refresh")) {
      return jsonResponse({ success: true, data: { refreshed: true } });
    }

    if (url.endsWith("/platform/auth/me")) {
      meCalls += 1;
      if (meCalls === 1) {
        return jsonResponse({ success: false, error: "Access expired" }, 401);
      }
      return jsonResponse({
        success: true,
        data: {
          user: {
            id: "user-1",
            email: "developer@example.com",
            displayName: "Developer",
            tier: "pro",
          },
        },
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  const { backendApi } = await loadBackendApi("refresh-success");
  const user = await backendApi.auth.me();

  assert.deepEqual(user, {
    id: "user-1",
    email: "developer@example.com",
    name: "Developer",
    plan: "Pro",
    avatarUrl: undefined,
  });
  assert.equal(meCalls, 2);
  assert.deepEqual(
    calls.map(({ url }) => new URL(url).pathname),
    [
      "/api/platform/auth/me",
      "/api/platform/auth/refresh",
      "/api/platform/auth/me",
    ],
  );
  assert.ok(calls.every(({ init }) => init?.credentials === "include"));
});

test("surfaces definitive session expiration when refresh is rejected", async () => {
  const paths: string[] = [];

  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);

    if (path.endsWith("/platform/auth/me")) {
      return jsonResponse({ success: false, error: "Access expired" }, 401);
    }
    if (path.endsWith("/platform/auth/refresh")) {
      return jsonResponse({ success: false, error: "Session expired" }, 401);
    }
    throw new Error(`Unexpected request: ${path}`);
  };

  const { backendApi, BackendApiError } = await loadBackendApi("refresh-failed");

  await assert.rejects(
    backendApi.auth.me(),
    (error: unknown) =>
      error instanceof BackendApiError && error.status === 401,
  );
  assert.deepEqual(paths, [
    "/api/platform/auth/me",
    "/api/platform/auth/refresh",
  ]);
});

test("deduplicates refresh calls across concurrent protected requests", async () => {
  let projectCalls = 0;
  let refreshCalls = 0;

  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;

    if (path.endsWith("/projects")) {
      projectCalls += 1;
      if (projectCalls <= 2) {
        return jsonResponse({ success: false, error: "Access expired" }, 401);
      }
      return jsonResponse({ success: true, data: [] });
    }

    if (path.endsWith("/platform/auth/refresh")) {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return jsonResponse({ success: true, data: { refreshed: true } });
    }

    throw new Error(`Unexpected request: ${path}`);
  };

  const { backendApi } = await loadBackendApi("refresh-deduplicated");
  const [left, right] = await Promise.all([
    backendApi.projects.list(),
    backendApi.projects.list(),
  ]);

  assert.deepEqual(left, []);
  assert.deepEqual(right, []);
  assert.equal(refreshCalls, 1);
  assert.equal(projectCalls, 4);
});
