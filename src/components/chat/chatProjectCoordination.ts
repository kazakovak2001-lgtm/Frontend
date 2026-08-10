import { createLatestRequestGuard } from "../../services/autonomousSession.ts";
import type { Conversation } from "../../services/backendApi.ts";
import type { ChatMessage } from "../../types/index.ts";

export interface ChatOperationToken {
  readonly projectId: string;
  readonly requestId: number;
}

export interface ChatProjectScope {
  /** Bind to a (possibly new) project and invalidate every prior operation. */
  rebind(projectId: string): void;
  /** Invalidate outstanding operations without changing the bound project (effect cleanup). */
  invalidateAll(): void;
  beginReconciliation(): ChatOperationToken;
  beginMutation(): ChatOperationToken;
  isReconciliationCurrent(token: ChatOperationToken): boolean;
  isMutationCurrent(token: ChatOperationToken): boolean;
}

/**
 * ChatPanel is reused across project navigation rather than remounted, so a
 * history load or send/clear started for one project can resolve after the
 * user has switched to another. Every operation captures both the project id
 * it belongs to and an independent per-kind request id; a result may only
 * publish state if the bound project still matches AND the guard for its kind
 * is still current. Reads (history reconciliation) and writes (send, clear)
 * use separate guards so an in-flight send can never be superseded by a
 * history reload, or vice versa — but send and clear share one guard because
 * they are both mutations of the same conversation: a clear must be able to
 * supersede a pending send, and a newer send must supersede an older one.
 */
export function createChatProjectScope(projectId: string): ChatProjectScope {
  let boundProjectId = projectId;
  const reconciliationGuard = createLatestRequestGuard();
  const mutationGuard = createLatestRequestGuard();

  return {
    rebind(nextProjectId) {
      boundProjectId = nextProjectId;
      reconciliationGuard.invalidate();
      mutationGuard.invalidate();
    },
    invalidateAll() {
      reconciliationGuard.invalidate();
      mutationGuard.invalidate();
    },
    beginReconciliation() {
      return {
        projectId: boundProjectId,
        requestId: reconciliationGuard.begin(),
      };
    },
    beginMutation() {
      return { projectId: boundProjectId, requestId: mutationGuard.begin() };
    },
    isReconciliationCurrent(token) {
      return (
        token.projectId === boundProjectId &&
        reconciliationGuard.isCurrent(token.requestId)
      );
    },
    isMutationCurrent(token) {
      return (
        token.projectId === boundProjectId &&
        mutationGuard.isCurrent(token.requestId)
      );
    },
  };
}

/**
 * Pure projection of a loaded conversation (or its absence) into panel
 * state. A project with no prior conversation must clear to an empty,
 * unbound state rather than leaving a previously displayed project's
 * messages/conversationId in place.
 */
export function deriveConversationState(
  conversation: Conversation | undefined,
): { conversationId: string | undefined; messages: ChatMessage[] } {
  if (!conversation) {
    return { conversationId: undefined, messages: [] };
  }
  return {
    conversationId: conversation.id,
    messages: conversation.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        id: message.id,
        role: message.role === "user" ? "user" : "assistant",
        content: message.content,
        createdAt: message.createdAt,
      })),
  };
}
