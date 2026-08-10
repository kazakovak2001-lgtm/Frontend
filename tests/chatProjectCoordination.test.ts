import test from "node:test";
import assert from "node:assert/strict";
import {
  createChatProjectScope,
  deriveConversationState,
} from "../src/components/chat/chatProjectCoordination.ts";

function conversationFixture() {
  return {
    id: "conv-a",
    projectId: "project-a",
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    messages: [
      {
        id: "msg-system",
        conversationId: "conv-a",
        role: "system" as const,
        content: "system prompt",
        createdAt: "2026-08-10T00:00:00.000Z",
      },
      {
        id: "msg-user",
        conversationId: "conv-a",
        role: "user" as const,
        content: "hello",
        createdAt: "2026-08-10T00:00:01.000Z",
      },
      {
        id: "msg-assistant",
        conversationId: "conv-a",
        role: "assistant" as const,
        content: "hi there",
        createdAt: "2026-08-10T00:00:02.000Z",
      },
    ],
  };
}

// --- Required scenario 1: history load cannot publish across a project switch ---
test("a reconciliation token from project A is no longer current after switching to project B", () => {
  const scope = createChatProjectScope("project-a");
  const token = scope.beginReconciliation();

  scope.rebind("project-b");

  assert.equal(scope.isReconciliationCurrent(token), false);
});

// --- Required scenario 2: a send result cannot append after switching projects ---
test("a mutation token from project A cannot append messages after switching to project B", () => {
  const scope = createChatProjectScope("project-a");
  const token = scope.beginMutation();

  scope.rebind("project-b");

  assert.equal(scope.isMutationCurrent(token), false);
});

// --- Required scenario 3: a stale send cannot set conversationId while B is active ---
test("a stale mutation token cannot set a new conversationId once project B is active", () => {
  const scope = createChatProjectScope("project-a");
  const token = scope.beginMutation(); // send starts for A, about to await saveMessage(user)

  scope.rebind("project-b"); // user navigates before saveMessage resolves

  // this is the exact check ChatPanel performs right before setConversationId()
  assert.equal(scope.isMutationCurrent(token), false);
});

// --- Required scenarios 4 & 5: switching to a project with no history clears stale state ---
test("deriving state from an absent conversation clears messages", () => {
  const derived = deriveConversationState(undefined);
  assert.deepEqual(derived.messages, []);
});

test("deriving state from an absent conversation clears conversationId", () => {
  const derived = deriveConversationState(undefined);
  assert.equal(derived.conversationId, undefined);
});

// --- Required scenario 6: a stale failure cannot set B's error ---
test("a stale failure from project A cannot be treated as current once project B is active", () => {
  const scope = createChatProjectScope("project-a");
  const token = scope.beginMutation(); // send starts, will eventually reject

  scope.rebind("project-b");

  // this is the exact check ChatPanel performs in the catch{} block before
  // appending an error message
  assert.equal(scope.isMutationCurrent(token), false);
});

// --- Required scenario 7: stale completion cannot clear the active project's mutation/loading state ---
test("a stale completion from project A does not appear current while project B has its own in-flight mutation", () => {
  const scope = createChatProjectScope("project-a");
  const staleToken = scope.beginMutation(); // A's send is in flight

  scope.rebind("project-b"); // user switches to B
  const currentToken = scope.beginMutation(); // B starts its own send

  assert.equal(scope.isMutationCurrent(staleToken), false);
  assert.equal(scope.isMutationCurrent(currentToken), true);
});

// --- Required scenario 8: a newer send for the same project supersedes an older one ---
test("a newer mutation for the same project supersedes an older one", () => {
  const scope = createChatProjectScope("project-a");
  const firstSend = scope.beginMutation();
  const secondSend = scope.beginMutation();

  assert.equal(scope.isMutationCurrent(firstSend), false);
  assert.equal(scope.isMutationCurrent(secondSend), true);
});

// --- Required scenario 9: normal same-project send still publishes ---
test("a same-project mutation with no project switch remains current", () => {
  const scope = createChatProjectScope("project-a");
  const token = scope.beginMutation();

  assert.equal(scope.isMutationCurrent(token), true);
});

// --- Required scenario 10: normal same-project history load still publishes ---
test("a same-project reconciliation with no project switch remains current", () => {
  const scope = createChatProjectScope("project-a");
  const token = scope.beginReconciliation();

  assert.equal(scope.isReconciliationCurrent(token), true);
});

// --- Project-identity is load-bearing independent of request ordering (mutation-test target) ---
test("isMutationCurrent rejects a token whose project id does not match the bound project, even when the request id is still latest", () => {
  const scope = createChatProjectScope("project-a");
  const token = scope.beginMutation();
  const forgedToken = { ...token, projectId: "project-b" };

  assert.equal(scope.isMutationCurrent(forgedToken), false);
});

test("isReconciliationCurrent rejects a token whose project id does not match the bound project, even when the request id is still latest", () => {
  const scope = createChatProjectScope("project-a");
  const token = scope.beginReconciliation();
  const forgedToken = { ...token, projectId: "project-b" };

  assert.equal(scope.isReconciliationCurrent(forgedToken), false);
});

// --- Reads and writes must not share one counter ---
test("beginning a mutation does not invalidate an outstanding reconciliation, and vice versa", () => {
  const scope = createChatProjectScope("project-a");
  const historyToken = scope.beginReconciliation();
  const sendToken = scope.beginMutation();

  assert.equal(scope.isReconciliationCurrent(historyToken), true);
  assert.equal(scope.isMutationCurrent(sendToken), true);

  scope.beginMutation(); // a second send starts

  // the unrelated history read must be unaffected by a second, unrelated send
  assert.equal(scope.isReconciliationCurrent(historyToken), true);
  assert.equal(scope.isMutationCurrent(sendToken), false);
});

// --- Behavior preservation for the extracted conversation projection ---
test("deriving state from a loaded conversation filters system messages and maps roles", () => {
  const derived = deriveConversationState(conversationFixture());

  assert.equal(derived.conversationId, "conv-a");
  assert.deepEqual(derived.messages, [
    {
      id: "msg-user",
      role: "user",
      content: "hello",
      createdAt: "2026-08-10T00:00:01.000Z",
    },
    {
      id: "msg-assistant",
      role: "assistant",
      content: "hi there",
      createdAt: "2026-08-10T00:00:02.000Z",
    },
  ]);
});
