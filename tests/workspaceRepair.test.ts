import assert from "node:assert/strict";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import {
  parseRepairDeliverResult,
  parseRepairDeliveriesEnvelope,
  parseRepairDeliveryRecord,
  parseRepairSession,
} from "../src/services/workspaceRepair.ts";

const validDeliveryRecord = {
  timestamp: 1000,
  executionId: "exec-1",
  studioId: "studio-1",
  source: "latest-repair",
  success: true,
};

const validIterationRecord = {
  iteration: 1,
  changedArtifacts: ["artifact-lua"],
  scoreBefore: 40,
  scoreAfter: 80,
  duration: 1200,
  repairsApplied: 1,
  timestamp: 2000,
  newExecutionId: "exec-2",
  parentExecutionId: "exec-1",
  strategyResults: [],
};

const validSession = {
  projectId: "project-a",
  status: "completed",
  currentIteration: 1,
  maxIterations: 2,
  targetScore: 80,
  currentScore: 80,
  history: [validIterationRecord],
  deliveries: [validDeliveryRecord],
  startedAt: 1500,
  totalRepairs: 1,
};

test("parseRepairSession accepts a valid session", () => {
  const session = parseRepairSession(validSession);
  assert.equal(session.projectId, "project-a");
  assert.equal(session.status, "completed");
  assert.equal(session.history.length, 1);
  assert.equal(session.history[0].newExecutionId, "exec-2");
  assert.equal(session.deliveries.length, 1);
  assert.equal(session.deliveries[0].source, "latest-repair");
});

test("parseRepairSession defaults deliveries to an empty array when absent", () => {
  const { deliveries, ...withoutDeliveries } = validSession;
  const session = parseRepairSession(withoutDeliveries);
  assert.deepEqual(session.deliveries, []);
});

test("parseRepairSession rejects an invalid status", () => {
  assert.throws(
    () => parseRepairSession({ ...validSession, status: "unknown" }),
    /Repair session status/,
  );
});

test("parseRepairSession rejects a missing required field", () => {
  const { projectId, ...withoutProjectId } = validSession;
  assert.throws(
    () => parseRepairSession(withoutProjectId),
    /Repair session project id/,
  );
});

test("parseRepairDeliveryRecord accepts a valid record and rejects a bad source", () => {
  const record = parseRepairDeliveryRecord(validDeliveryRecord);
  assert.equal(record.executionId, "exec-1");
  assert.throws(
    () =>
      parseRepairDeliveryRecord({ ...validDeliveryRecord, source: "manual" }),
    /Delivery source/,
  );
});

test("parseRepairDeliveriesEnvelope accepts a null Studio state", () => {
  const envelope = parseRepairDeliveriesEnvelope({
    deliveries: [validDeliveryRecord],
    currentStudioState: null,
  });
  assert.equal(envelope.deliveries.length, 1);
  assert.equal(envelope.currentStudioState, null);
});

test("parseRepairDeliverResult accepts a valid deliver response", () => {
  const result = parseRepairDeliverResult({
    executionId: "exec-2",
    syncResult: {
      success: true,
      sessionId: "session-1",
      payloadId: "payload-1",
      itemsSynced: 3,
      totalSize: 100,
      durationMs: 50,
    },
  });
  assert.equal(result.executionId, "exec-2");
  assert.equal(result.syncResult.itemsSynced, 3);
});

test("parseRepairDeliverResult rejects a malformed sync result", () => {
  assert.throws(
    () =>
      parseRepairDeliverResult({
        executionId: "exec-2",
        syncResult: { success: true },
      }),
    /Repair sync session id/,
  );
});

let vite: ViteDevServer | undefined;
const originalFetch = globalThis.fetch;
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

after(async () => {
  globalThis.fetch = originalFetch;
  await vite?.close();
});

async function loadRepairApi() {
  vite ??= await createServer({
    root: repositoryRoot,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    resolve: { alias: { "@": path.resolve(repositoryRoot, "src") } },
    server: { middlewareMode: true },
  });
  return vite.ssrLoadModule(
    "/src/services/backendApi.ts?workspace-repair-test",
  ) as Promise<{
    backendApi: {
      workspace: {
        repair: {
          run(
            projectId: string,
            executionId: string,
            config?: { maxIterations?: number },
          ): Promise<unknown>;
          get(projectId: string): Promise<unknown>;
          deliver(
            projectId: string,
            options?: { studioId?: string; executionId?: string },
          ): Promise<unknown>;
          deliveries(projectId: string): Promise<unknown>;
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

test("repair.run posts projectId, executionId and config to /repair/run", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return jsonResponse(validSession);
  };

  const { backendApi } = await loadRepairApi();
  await backendApi.workspace.repair.run("project-a", "exec-1", {
    maxIterations: 2,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/repair\/run$/);
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    projectId: "project-a",
    executionId: "exec-1",
    config: { maxIterations: 2 },
  });
});

test("repair.get and repair.deliveries hit the right GET paths", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/deliveries")) {
      return jsonResponse({ deliveries: [], currentStudioState: null });
    }
    return jsonResponse(validSession);
  };

  const { backendApi } = await loadRepairApi();
  await backendApi.workspace.repair.get("project-a");
  await backendApi.workspace.repair.deliveries("project-a");

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/repair\/project-a$/);
  assert.match(calls[1].url, /\/repair\/project-a\/deliveries$/);
});

test("repair.deliver posts an empty body for latest-repair and an executionId for rollback", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return jsonResponse({
      executionId: "exec-2",
      syncResult: {
        success: true,
        sessionId: "session-1",
        payloadId: "payload-1",
        itemsSynced: 1,
        totalSize: 10,
        durationMs: 5,
      },
    });
  };

  const { backendApi } = await loadRepairApi();
  await backendApi.workspace.repair.deliver("project-a");
  await backendApi.workspace.repair.deliver("project-a", {
    executionId: "exec-1",
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/repair\/project-a\/deliver$/);
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {});
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
    executionId: "exec-1",
  });
});
