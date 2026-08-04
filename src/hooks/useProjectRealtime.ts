import { useEffect, useMemo, useState } from "react";
import { getRealtimeSocket } from "@/services/realtime";
import {
  bindProjectRealtimeSocket,
  type ProjectRealtimeSocket,
} from "@/services/projectRealtimeBinding";
import {
  useWorkspace,
  type WorkspaceRealtimeSnapshot,
} from "@/contexts/WorkspaceContext";
import type { Agent, LogEntry } from "@/types";

export interface RealtimeEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

const INITIAL_SNAPSHOT: WorkspaceRealtimeSnapshot = {
  connected: false,
  status: "idle",
  progress: 0,
  updatedAt: new Date(0).toISOString(),
};

export function useProjectRealtime(projectId?: string) {
  const { setActiveProjectId, setSnapshot } = useWorkspace();
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [snapshot, setLocalSnapshot] =
    useState<WorkspaceRealtimeSnapshot>(INITIAL_SNAPSHOT);

  useEffect(() => {
    setActiveProjectId(projectId);
    return () => setActiveProjectId(undefined);
  }, [projectId, setActiveProjectId]);

  useEffect(() => {
    if (projectId) setSnapshot(projectId, snapshot);
  }, [projectId, setSnapshot, snapshot]);

  useEffect(() => {
    if (!projectId) return;
    const socket = getRealtimeSocket();
    setEvents([]);
    setAgents([]);
    setLocalSnapshot({
      ...INITIAL_SNAPSHOT,
      connected: false,
      updatedAt: new Date().toISOString(),
    });

    const update = (
      patch:
        | Partial<WorkspaceRealtimeSnapshot>
        | ((
            current: WorkspaceRealtimeSnapshot,
          ) => Partial<WorkspaceRealtimeSnapshot>),
    ) => {
      setLocalSnapshot((current) => {
        const resolved = typeof patch === "function" ? patch(current) : patch;
        return {
          ...current,
          ...resolved,
          updatedAt: new Date().toISOString(),
        };
      });
    };

    // `connected` means the server acknowledged membership in this project's
    // room, not merely that the Socket.IO transport is connected.
    const onConnect = () => update({ connected: true });
    const onDisconnect = () => update({ connected: false });
    const onAny = (type: string, rawPayload: unknown) => {
      const payload =
        rawPayload && typeof rawPayload === "object"
          ? (rawPayload as Record<string, unknown>)
          : { value: rawPayload };
      // Every project-scoped backend event carries projectId. Ignoring global
      // events prevents another user's pipeline from leaking into this view.
      if (payload.projectId !== projectId) {
        return;
      }

      const event: RealtimeEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        payload,
        timestamp:
          typeof payload.timestamp === "string"
            ? payload.timestamp
            : new Date().toISOString(),
      };
      setEvents((current) => [...current.slice(-199), event]);

      if (type === "pipeline.started" || type === "generation.started") {
        update({ status: "running", progress: 0 });
      } else if (
        type === "pipeline.completed" ||
        type === "generation.completed"
      ) {
        update({ status: "completed", progress: 100 });
      } else if (type === "pipeline.failed" || type === "generation.failed") {
        update({ status: "failed" });
      } else if (type === "step.started" || type === "step.completed") {
        const agentId = String(payload.agentId ?? payload.stepId ?? "agent");
        const completed = type === "step.completed";
        const progress = completed ? 100 : Number(payload.progress ?? 0);
        update((current) => ({
          status: "running",
          progress: completed
            ? Math.min(95, current.progress + 10)
            : Math.max(current.progress, Number(payload.progress ?? 0)),
          currentStep: String(payload.stepId ?? ""),
        }));
        setAgents((current) => {
          const next: Agent = {
            id: agentId,
            name: agentId,
            role: String(payload.stepId ?? "Pipeline step"),
            description: completed
              ? "Completed by the backend pipeline."
              : "Currently executing on the backend.",
            status: completed ? "completed" : "running",
            progress,
            icon: "Bot",
          };
          const found = current.some((agent) => agent.id === agentId);
          return found
            ? current.map((agent) => (agent.id === agentId ? next : agent))
            : [...current, next];
        });
      } else if (type === "step.failed") {
        const agentId = String(payload.agentId ?? payload.stepId ?? "agent");
        setAgents((current) => {
          const found = current.some((agent) => agent.id === agentId);
          if (found) {
            return current.map((agent) =>
              agent.id === agentId
                ? { ...agent, status: "error", progress: 0 }
                : agent,
            );
          }
          return [
            ...current,
            {
              id: agentId,
              name: agentId,
              role: String(payload.stepId ?? "Pipeline step"),
              description: String(payload.error ?? "Backend step failed."),
              status: "error",
              progress: 0,
              icon: "Bot",
            },
          ];
        });
      }
    };

    return bindProjectRealtimeSocket({
      socket: socket as unknown as ProjectRealtimeSocket,
      projectId,
      onConnect,
      onDisconnect,
      onAny,
    });
  }, [projectId]);

  const logs = useMemo<LogEntry[]>(
    () =>
      events.map((event) => ({
        id: event.id,
        level:
          event.type.includes("failed") || event.type.includes("error")
            ? "error"
            : event.type.includes("completed")
              ? "success"
              : "info",
        message: formatEvent(event),
        timestamp: event.timestamp,
      })),
    [events],
  );

  return { snapshot, events, agents, logs };
}

function formatEvent(event: RealtimeEvent) {
  const details = [
    event.payload.stepId,
    event.payload.agentId,
    event.payload.error,
  ]
    .filter(Boolean)
    .map(String)
    .join(" · ");
  return details ? `${event.type}: ${details}` : event.type;
}
