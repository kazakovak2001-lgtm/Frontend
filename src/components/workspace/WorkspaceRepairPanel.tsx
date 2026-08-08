import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, RotateCcw, UploadCloud, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { backendApi, BackendApiError } from "@/services/backendApi";
import {
  canSyncWorkspaceStudio,
  type WorkspaceStudioStatus,
} from "@/services/workspaceStudioStatus";
import { createLatestRequestGuard } from "@/services/autonomousSession";
import type {
  RepairDeliveryRecord,
  RepairSession,
} from "@/services/workspaceRepair";
import type { Project } from "@/types";

type Mutation = "run" | "deliver" | `rollback:${string}`;

export function WorkspaceRepairPanel({
  project,
  latestExecutionId,
  studio,
}: {
  project: Project;
  latestExecutionId?: string;
  studio?: WorkspaceStudioStatus;
}) {
  const [session, setSession] = useState<RepairSession>();
  const [deliveries, setDeliveries] = useState<RepairDeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutation, setMutation] = useState<Mutation>();
  const [error, setError] = useState<string>();
  const reconciliationGuard = useRef(createLatestRequestGuard()).current;

  const reconcile = useCallback(async () => {
    const requestId = reconciliationGuard.begin();
    try {
      const [nextSession, nextDeliveries] = await Promise.all([
        backendApi.workspace.repair.get(project.id).catch((caught) => {
          if (caught instanceof BackendApiError && caught.status === 404) {
            return undefined;
          }
          throw caught;
        }),
        backendApi.workspace.repair.deliveries(project.id),
      ]);
      if (!reconciliationGuard.isCurrent(requestId)) return;
      setSession(nextSession);
      setDeliveries(nextDeliveries.deliveries);
      setError(undefined);
    } catch (caught) {
      if (!reconciliationGuard.isCurrent(requestId)) return;
      setError(describeError(caught));
    } finally {
      if (reconciliationGuard.isCurrent(requestId)) setLoading(false);
    }
  }, [project.id, reconciliationGuard]);

  useEffect(() => {
    reconciliationGuard.invalidate();
    setLoading(true);
    setSession(undefined);
    setDeliveries([]);
    setError(undefined);
    void reconcile();
    return () => reconciliationGuard.invalidate();
  }, [project.id, reconcile, reconciliationGuard]);

  const mutate = async (kind: Mutation, operation: () => Promise<unknown>) => {
    reconciliationGuard.invalidate();
    setMutation(kind);
    setError(undefined);
    try {
      await operation();
      await reconcile();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setMutation(undefined);
    }
  };

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground">Loading repair session…</p>
    );
  }

  const knownExecutionIds = Array.from(
    new Set(
      (session?.history ?? []).flatMap((record) =>
        [record.parentExecutionId, record.newExecutionId].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ),
  );
  const hasRepairedExecution = Boolean(
    session?.history.some((record) => record.newExecutionId),
  );
  const canDeliver = canSyncWorkspaceStudio(studio) && hasRepairedExecution;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Repair</p>
          <p className="text-xs text-muted-foreground">
            {session
              ? `${session.totalRepairs} repair attempt${session.totalRepairs === 1 ? "" : "s"} · latest score ${session.currentScore}`
              : "No repair session has been started for this project."}
          </p>
        </div>
        {session && <Badge variant="outline">{session.status}</Badge>}
      </div>

      {error && (
        <p
          role="alert"
          className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={Boolean(mutation) || !latestExecutionId}
          onClick={() =>
            void mutate("run", () =>
              backendApi.workspace.repair.run(project.id, latestExecutionId!, {
                maxIterations: 2,
              }),
            )
          }
        >
          <Wrench className="mr-1 h-3.5 w-3.5" />
          {mutation === "run" ? "Running…" : "Run repair"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={Boolean(mutation) || !canDeliver}
          onClick={() =>
            void mutate("deliver", () => backendApi.workspace.repair.deliver(project.id))
          }
        >
          <UploadCloud className="mr-1 h-3.5 w-3.5" />
          {mutation === "deliver" ? "Delivering…" : "Redeliver latest"}
        </Button>
      </div>

      {knownExecutionIds.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Roll back to a known execution
          </p>
          <div className="flex flex-wrap gap-1.5">
            {knownExecutionIds.map((executionId) => (
              <Button
                key={executionId}
                size="sm"
                variant="ghost"
                className="h-auto py-1 text-xs"
                disabled={Boolean(mutation) || !canSyncWorkspaceStudio(studio)}
                onClick={() =>
                  void mutate(`rollback:${executionId}`, () =>
                    backendApi.workspace.repair.deliver(project.id, {
                      executionId,
                    }),
                  )
                }
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                {mutation === `rollback:${executionId}`
                  ? "Rolling back…"
                  : executionId}
              </Button>
            ))}
          </div>
        </div>
      )}

      {session && session.history.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Repair history
          </p>
          <div className="space-y-2">
            {session.history.map((record) => (
              <div
                key={`${record.parentExecutionId}-${record.iteration}`}
                className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">
                    {record.parentExecutionId}
                    {record.newExecutionId ? ` → ${record.newExecutionId}` : " (no change)"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(record.timestamp).toLocaleString()} · score{" "}
                    {record.scoreBefore} → {record.scoreAfter}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={record.newExecutionId ? "text-success" : "text-muted-foreground"}
                >
                  {record.newExecutionId ? "repaired" : "no change"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {deliveries.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Delivery audit trail
          </p>
          <div className="space-y-2">
            {deliveries.map((delivery, index) => (
              <div
                key={`${delivery.timestamp}-${index}`}
                className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">
                    {delivery.executionId}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(delivery.timestamp).toLocaleString()} ·{" "}
                    {delivery.source}
                    {delivery.error ? ` · ${delivery.error}` : ""}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={delivery.success ? "text-success" : "text-destructive"}
                >
                  {delivery.success ? "delivered" : "failed"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function describeError(error: unknown): string {
  if (error instanceof BackendApiError && error.status === 503) {
    return "Durable storage is temporarily unavailable. The last confirmed state is unchanged; retry when service recovers.";
  }
  return error instanceof Error ? error.message : "Repair request failed";
}
