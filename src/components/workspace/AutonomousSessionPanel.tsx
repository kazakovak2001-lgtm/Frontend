import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CirclePause, Play, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { backendApi, BackendApiError } from "@/services/backendApi";
import type { AutonomousSession } from "@/services/autonomousSession";
import { getRealtimeSocket } from "@/services/realtime";
import type { Project } from "@/types";

type Mutation = "start" | "pause" | "resume" | "recover" | "cancel";

export function AutonomousSessionPanel({ project }: { project: Project }) {
  const [session, setSession] = useState<AutonomousSession>();
  const [loading, setLoading] = useState(true);
  const [mutation, setMutation] = useState<Mutation>();
  const [error, setError] = useState<string>();
  const [connected, setConnected] = useState(false);

  const reconcile = useCallback(async () => {
    try {
      const latest = await backendApi.workspace.autonomous.latest(project.id);
      setSession(latest);
      setError(undefined);
    } catch (caught) {
      if (caught instanceof BackendApiError && caught.status === 404) {
        setSession(undefined);
        setError(undefined);
      } else {
        setError(describeError(caught));
      }
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void reconcile();
    const socket = getRealtimeSocket();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleReconcile = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void reconcile(), 150);
    };
    const onConnect = () => {
      setConnected(true);
      scheduleReconcile();
    };
    const onDisconnect = () => setConnected(false);
    const onAny = (_type: string, payload: unknown) => {
      if (
        payload &&
        typeof payload === "object" &&
        (payload as Record<string, unknown>).projectId === project.id
      ) {
        scheduleReconcile();
      }
    };

    setConnected(socket.connected);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.onAny(onAny);
    return () => {
      if (timer) clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.offAny(onAny);
    };
  }, [project.id, reconcile]);

  const mutate = async (kind: Mutation, operation: () => Promise<unknown>) => {
    setMutation(kind);
    setError(undefined);
    try {
      const result = await operation();
      if (kind === "start") setSession(result as AutonomousSession);
      else await reconcile();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setMutation(undefined);
    }
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading session…</p>;
  }

  const interrupted = session?.recoveryReason === "server_restart";
  const canStart =
    !session ||
    [
      "failed",
      "cancelled",
      "preview_completed",
      "completed",
      "simulated",
    ].includes(session.status);

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Autonomous session</p>
          <p className="text-xs text-muted-foreground">
            {session
              ? session.id
              : "No session has been started for this project."}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{session?.status ?? "idle"}</Badge>
          <Badge
            variant="outline"
            className={connected ? "text-success" : "text-warning"}
          >
            {connected ? "Realtime connected" : "Realtime offline"}
          </Badge>
        </div>
      </div>

      {error && (
        <p className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {session && (
        <>
          {interrupted && (
            <p className="rounded-lg bg-warning/10 p-3 text-xs text-warning">
              The backend restarted while this session was running. Its durable
              checkpoint is recoverable; no execution is currently active.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            <Metric label="Current phase" value={session.currentPhase} />
            <Metric
              label="Checkpoints"
              value={String(session.checkpoints.length)}
            />
            <Metric
              label="Measured cost"
              value={`$${session.cost.totalCost.toFixed(4)} · ${session.cost.totalTimeMs} ms`}
            />
          </div>
          {session.checkpoints.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Durable checkpoint timeline
              </p>
              <div className="flex flex-wrap gap-1.5">
                {session.checkpoints.slice(-6).map((checkpoint) => (
                  <Badge key={checkpoint.id} variant="outline">
                    {checkpoint.phase}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {session.terminalEvidenceId && (
            <p className="break-all text-[11px] text-muted-foreground">
              Terminal evidence: {session.terminalEvidenceId}
            </p>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {canStart && (
          <Button
            size="sm"
            disabled={Boolean(mutation)}
            onClick={() =>
              void mutate("start", () =>
                backendApi.workspace.autonomous.start(project),
              )
            }
          >
            <Play className="mr-1 h-3.5 w-3.5" />
            {mutation === "start" ? "Starting…" : "Start autonomous"}
          </Button>
        )}
        {session?.status === "running" && (
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(mutation)}
            onClick={() =>
              void mutate("pause", () =>
                backendApi.workspace.autonomous.pause(session.id),
              )
            }
          >
            <CirclePause className="mr-1 h-3.5 w-3.5" />
            {mutation === "pause" ? "Pausing…" : "Pause"}
          </Button>
        )}
        {session?.status === "paused" && !interrupted && (
          <Button
            size="sm"
            disabled={Boolean(mutation)}
            onClick={() =>
              void mutate("resume", () =>
                backendApi.workspace.autonomous.resume(session.id),
              )
            }
          >
            <Play className="mr-1 h-3.5 w-3.5" />
            {mutation === "resume" ? "Resuming…" : "Resume"}
          </Button>
        )}
        {session?.status === "paused" && interrupted && (
          <Button
            size="sm"
            disabled={Boolean(mutation)}
            onClick={() =>
              void mutate("recover", () =>
                backendApi.workspace.autonomous.recover(session.id),
              )
            }
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            {mutation === "recover" ? "Recovering…" : "Recover checkpoint"}
          </Button>
        )}
        {(session?.status === "running" || session?.status === "paused") && (
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(mutation)}
            onClick={() =>
              void mutate("cancel", () =>
                backendApi.workspace.autonomous.cancel(session.id),
              )
            }
          >
            <X className="mr-1 h-3.5 w-3.5" />
            {mutation === "cancel" ? "Cancelling…" : "Cancel"}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={Boolean(mutation)}
          onClick={() => void reconcile()}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function describeError(error: unknown): string {
  if (error instanceof BackendApiError && error.status === 503) {
    return "Durable storage is temporarily unavailable. The last confirmed state is unchanged; retry when service recovers.";
  }
  return error instanceof Error
    ? error.message
    : "Autonomous session request failed";
}
