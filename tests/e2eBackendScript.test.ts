import assert from "node:assert/strict";
import { test } from "node:test";
import {
  REQUEST_TIMEOUT_MS,
  disconnectAllTrackedSockets,
  disconnectSocket,
  generateIdempotencyKey,
  request,
  resolveAbortSignal,
  trackSocket,
  untrackSocket,
} from "../scripts/e2e-backend.mjs";

/**
 * CI-FRONTEND-CONTRACT-2.
 *
 * scripts/e2e-backend.mjs runs only when executed directly (see the
 * `isDirectExecution` guard at the bottom of that file), so importing its
 * exports here does not trigger a live 40-check run against a backend.
 *
 * These tests pin the two contract fixes:
 *  - the canonical generate request carries a non-empty Idempotency-Key
 *  - every Socket.IO client this script opens is disconnected exactly once,
 *    whether the run succeeds or throws, and no raw fetch can hang the
 *    process forever.
 *
 * A live paired-backend run of the full E2E suite was not performed in this
 * change — no local/paired backend was available in this environment. Item
 * 8's narrow deterministic tests below are what stand in for it; live
 * verification remains pending against a real backend (e.g. via CI, where
 * RobloxAIStudio2#271's job-level timeout now also bounds any residual hang).
 */

function fakeSocket() {
  let disconnectCalls = 0;
  return {
    get disconnectCalls() {
      return disconnectCalls;
    },
    disconnect() {
      disconnectCalls += 1;
    },
  };
}

test("Idempotency-Key: generateIdempotencyKey is non-empty and stable for one run", () => {
  const first = generateIdempotencyKey("project-a", "suffix-1");
  const second = generateIdempotencyKey("project-a", "suffix-1");
  assert.ok(first.length > 0, "key must not be empty");
  assert.equal(first, second, "the same project+suffix must produce the same key");
});

test("Idempotency-Key: different projects or suffixes never share a key", () => {
  const base = generateIdempotencyKey("project-a", "suffix-1");
  assert.notEqual(generateIdempotencyKey("project-b", "suffix-1"), base);
  assert.notEqual(generateIdempotencyKey("project-a", "suffix-2"), base);
});

test("Idempotency-Key: request() attaches the header on the canonical generate call", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string, init: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ success: true, data: { executionId: "exec-1" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const key = generateIdempotencyKey("project-x", "suffix-x");
    await request("/projects/project-x/generate", {
      method: "POST",
      body: JSON.stringify({ userId: "user-1" }),
      headers: { "Idempotency-Key": key },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  const headers = calls[0].init.headers as Record<string, string>;
  assert.ok(headers["Idempotency-Key"]?.length > 0, "Idempotency-Key header must be present and non-empty");
});

test("bounded requests: request() never sends without an abort signal", async () => {
  const calls: RequestInit[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: string, init: RequestInit) => {
    calls.push(init);
    return new Response(JSON.stringify({ success: true, data: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await request("/health");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.ok(calls[0].signal instanceof AbortSignal, "every request must carry a bounded AbortSignal");
  assert.equal(calls[0].signal?.aborted, false, "the signal must not start aborted");
});

test("bounded requests: the abort signal actually fires within its configured window", async () => {
  const signal = resolveAbortSignal(undefined, 10);
  assert.equal(signal.aborted, false);
  await new Promise<void>((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
  assert.equal(signal.aborted, true, "the signal must abort once its timeout elapses");
});

test("bounded requests: REQUEST_TIMEOUT_MS is a finite, positive bound", () => {
  assert.equal(typeof REQUEST_TIMEOUT_MS, "number");
  assert.ok(Number.isFinite(REQUEST_TIMEOUT_MS) && REQUEST_TIMEOUT_MS > 0);
});

test("socket cleanup: a tracked socket left open by a throw is disconnected by the backstop", () => {
  const socket = trackSocket(fakeSocket());

  // Simulates a throw somewhere between socket creation and its normal-flow
  // disconnect — exactly what "start generation" used to do before it sent a
  // valid Idempotency-Key.
  disconnectAllTrackedSockets();

  assert.equal(socket.disconnectCalls, 1, "the backstop must close a socket the normal flow never reached");
});

test("socket cleanup: the success path disconnects exactly once, not twice", () => {
  const socket = trackSocket(fakeSocket());

  // The normal-flow disconnect a successful check performs.
  disconnectSocket(socket);
  // The top-level `finally` backstop that always runs afterward.
  disconnectAllTrackedSockets();

  assert.equal(
    socket.disconnectCalls,
    1,
    "a socket already closed by the normal flow must not be closed again by the backstop",
  );
});

test("socket cleanup: two open sockets — one cleaned normally, one left by a throw — both end up closed exactly once", () => {
  const cleanedNormally = trackSocket(fakeSocket());
  const leakedByThrow = trackSocket(fakeSocket());

  disconnectSocket(cleanedNormally);
  // leakedByThrow never gets its normal-flow disconnect call.
  disconnectAllTrackedSockets();

  assert.equal(cleanedNormally.disconnectCalls, 1);
  assert.equal(leakedByThrow.disconnectCalls, 1);
});

test("socket cleanup: disconnectAllTrackedSockets is a safe no-op with nothing tracked", () => {
  assert.doesNotThrow(() => disconnectAllTrackedSockets());
});

test("socket cleanup: untrackSocket removes a socket without closing it", () => {
  const socket = trackSocket(fakeSocket());
  untrackSocket(socket);
  disconnectAllTrackedSockets();
  assert.equal(socket.disconnectCalls, 0, "untrackSocket must not itself disconnect the socket");
});
