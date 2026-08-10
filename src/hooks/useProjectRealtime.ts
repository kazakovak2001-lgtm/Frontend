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
import {
  reduceRealtimeAgents,
  reduceRealtimeSnapshotPatch,
} from "@/hooks/realtimeAgentEvents";
import type { Agent, LogEntry } from "@/types";

export interface RealtimeEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

const INITIAL_SNAPSHOT: WorkspaceRealtimeSnapshot = {
  connected: false,
  status: "unknown",
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

      const snapshotPatch = reduceRealtimeSnapshotPatch(type, payload);
      if (snapshotPatch) update(snapshotPatch);

      if (
        type === "step.started" ||
        type === "step.completed" ||
        type === "step.failed"
      ) {
        setAgents((current) => reduceRealtimeAgents(current, type, payload));
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
