import type { Agent } from "../types/index.ts";
import type { WorkspaceRealtimeSnapshot } from "../contexts/WorkspaceContext.tsx";
import { normalizeAgentProgress } from "../services/realtimeAgentMapping.ts";

export type RealtimeEventPayload = Record<string, unknown>;

export { normalizeAgentProgress };

/**
 * Pure per-agent list reducer for realtime pipeline events. `useProjectRealtime`
 * is the only caller; this is extracted so the truthfulness invariants below
 * are unit-testable without a React render:
 *
 * - a step's progress is only ever a number when the event payload reports
 *   one; a step that hasn't reported progress stays `undefined`, never `0`.
 * - a step that fails does not have its last-known progress overwritten -
 *   only `status` changes for an agent already being tracked.
 * - an event type this reducer does not recognize leaves the agent list
 *   completely unchanged (no synthetic status/progress is invented).
 */
export function reduceRealtimeAgents(
  agents: readonly Agent[],
  type: string,
  payload: RealtimeEventPayload,
): Agent[] {
  if (type === "step.started" || type === "step.completed") {
    const agentId = String(payload.agentId ?? payload.stepId ?? "agent");
    const completed = type === "step.completed";
    const next: Agent = {
      id: agentId,
      name: agentId,
      role: String(payload.stepId ?? "Pipeline step"),
      description: completed
        ? "Completed by the backend pipeline."
        : "Currently executing on the backend.",
      status: completed ? "completed" : "running",
      progress: completed ? 100 : normalizeAgentProgress(payload.progress),
      icon: "Bot",
    };
    const found = agents.some((agent) => agent.id === agentId);
    return found
      ? agents.map((agent) => (agent.id === agentId ? next : agent))
      : [...agents, next];
  }

  if (type === "step.failed") {
    const agentId = String(payload.agentId ?? payload.stepId ?? "agent");
    const found = agents.find((agent) => agent.id === agentId);
    if (found) {
      return agents.map((agent) =>
        agent.id === agentId ? { ...agent, status: "error" } : agent,
      );
    }
    return [
      ...agents,
      {
        id: agentId,
        name: agentId,
        role: String(payload.stepId ?? "Pipeline step"),
        description: String(payload.error ?? "Backend step failed."),
        status: "error",
        progress: normalizeAgentProgress(payload.progress),
        icon: "Bot",
      },
    ];
  }

  return agents as Agent[];
}

export type WorkspaceRealtimeSnapshotPatch = Partial<
  Pick<WorkspaceRealtimeSnapshot, "status" | "progress" | "currentStep">
>;

/**
 * Pure snapshot-patch reducer. Returns `undefined` for any event this
 * reducer does not recognize, so a stale or unrelated event can never
 * fabricate a terminal ("completed"/"failed") snapshot state.
 *
 * Progress is only ever set to a concrete number here for the two events
 * whose meaning makes the number a direct, non-estimated fact: a run that
 * just started has done 0% of its work, and a run that just completed has
 * done 100%. No other event synthesizes a percentage - in particular, a
 * step completing does *not* nudge the overall run's progress by a guessed
 * increment, since the backend does not report what fraction of the whole
 * run that one step represents.
 */
export function reduceRealtimeSnapshotPatch(
  type: string,
  payload: RealtimeEventPayload,
): WorkspaceRealtimeSnapshotPatch | undefined {
  if (type === "pipeline.started" || type === "generation.started") {
    return { status: "running", progress: 0 };
  }
  if (type === "pipeline.completed" || type === "generation.completed") {
    return { status: "completed", progress: 100 };
  }
  if (type === "pipeline.failed" || type === "generation.failed") {
    return { status: "failed" };
  }
  if (type === "step.started" || type === "step.completed") {
    return { status: "running", currentStep: String(payload.stepId ?? "") };
  }
  return undefined;
}
