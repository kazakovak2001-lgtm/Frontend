import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  RefreshCw,
  Radio,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { WorkspaceReadModel } from "@/services/workspaceReadModel";
import type { WorkspaceStage } from "@/components/workspace/WorkspaceWorkflowRail";
import {
  buildWorkspaceBlockers,
  describeWorkspaceRun,
  getWorkspaceNextAction,
} from "@/components/workspace/workspaceLogic";
import { cn } from "@/lib/utils";

interface ActivityEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
}

export function WorkspaceContextRail({
  activeStage,
  projectStatus,
  runStatus,
  progress,
  currentStep,
  realtimeConnected,
  workspace,
  recentActivity,
  refreshing,
  onRefresh,
  onStageChange,
}: {
  activeStage: WorkspaceStage;
  projectStatus: string;
  runStatus?: string;
  progress: number;
  currentStep?: string;
  realtimeConnected: boolean;
  workspace?: WorkspaceReadModel;
  recentActivity: ActivityEntry[];
  refreshing: boolean;
  onRefresh: () => void;
  onStageChange: (stage: WorkspaceStage) => void;
}) {
  const blockers = buildWorkspaceBlockers(workspace);
  const nextAction = getWorkspaceNextAction(workspace, activeStage);
  const status = runStatus ?? workspace?.latestExecution?.status ?? projectStatus;
  const activity = recentActivity.slice(-4).reverse();

  return (
    <aside
      className="space-y-4 xl:sticky xl:top-6 xl:self-start"
      aria-label="Workspace context"
    >
      <Card className="border-border/60 bg-card/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current run
            </p>
            <p className="mt-1 font-semibold capitalize">
              {status.replaceAll("_", " ")}
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              realtimeConnected
                ? "border-success/40 text-success"
                : "border-warning/40 text-warning"
            }
          >
            <Radio className="mr-1 h-3 w-3" />
            {realtimeConnected ? "Live" : "Offline"}
          </Badge>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {currentStep || describeWorkspaceRun(status)}
        </p>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>Progress</span>
            <span>{Math.max(0, Math.min(progress, 100))}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </Card>

      <Card className="border-border/60 bg-card/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Next decision
            </p>
            <p className="mt-1 font-semibold">{nextAction.title}</p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {nextAction.description}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          onClick={() => onStageChange(nextAction.stage)}
        >
          Open {stageLabel(nextAction.stage)}
        </Button>
      </Card>

      <Card className="border-border/60 bg-card/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Blockers & readiness
          </p>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={refreshing}
            aria-label="Refresh workspace context"
            onClick={onRefresh}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
            />
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {blockers.length ? (
            blockers.map((blocker) => (
              <div
                key={blocker}
                className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 p-2.5"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {blocker}
                </p>
              </div>
            ))
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-success/20 bg-success/5 p-2.5">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                No blocking project conditions are reported.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="border-border/60 bg-card/60 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recent activity
        </p>
        <div className="mt-3 space-y-3">
          {activity.length ? (
            activity.map((entry) => (
              <div key={entry.id} className="flex gap-2.5">
                <CircleDot
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    entry.level === "error"
                      ? "text-destructive"
                      : entry.level === "warning"
                        ? "text-warning"
                        : entry.level === "success"
                          ? "text-success"
                          : "text-primary",
                  )}
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs leading-relaxed">
                    {entry.message}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Realtime project events will appear here during generation.
            </p>
          )}
        </div>
      </Card>
    </aside>
  );
}

function stageLabel(stage: WorkspaceStage): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}
