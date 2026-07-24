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
  const blockers = buildBlockers(workspace);
  const nextAction = getNextAction(workspace, activeStage);
  const status = runStatus ?? workspace?.latestExecution?.status ?? projectStatus;
  const activity = recentActivity.slice(-4).reverse();

  return (
    <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start" aria-label="Workspace context">
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
          {currentStep || describeRun(status)}
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
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
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

function buildBlockers(workspace?: WorkspaceReadModel): string[] {
  if (!workspace) return ["Workspace data has not loaded yet."];

  const blockers: string[] = [];
  if (!workspace.readiness.hasBlueprint) {
    blockers.push("A durable blueprint has not been generated.");
  }
  if (
    workspace.readiness.hasExecution &&
    !workspace.readiness.hasCompletedExecution
  ) {
    blockers.push("The latest generation execution is not complete.");
  }
  if (!workspace.readiness.studioConnected) {
    blockers.push("Roblox Studio is not connected to this project.");
  }
  if (!workspace.readiness.studioArtifactVerified) {
    blockers.push("Real generated-artifact delivery is pending STUDIO-1 verification.");
  }
  if (workspace.latestExecution?.error_message) {
    blockers.push(workspace.latestExecution.error_message);
  }
  blockers.push(...workspace.degradedSources);
  return blockers.slice(0, 4);
}

function getNextAction(
  workspace: WorkspaceReadModel | undefined,
  activeStage: WorkspaceStage,
): { stage: WorkspaceStage; title: string; description: string } {
  if (!workspace?.readiness.hasBlueprint) {
    return {
      stage: "define",
      title: "Complete the project definition",
      description: "Confirm the brief and generate the first durable blueprint.",
    };
  }
  if (!workspace.readiness.hasCompletedExecution) {
    return {
      stage: "generate",
      title: "Complete a generation run",
      description: "Start or inspect the execution until a completed package exists.",
    };
  }
  if (activeStage !== "validate" && workspace.readiness.canValidate) {
    return {
      stage: "validate",
      title: "Validate the generated experience",
      description: "Run governance, simulation, economy and quality checks.",
    };
  }
  if (!workspace.readiness.studioConnected) {
    return {
      stage: "integrate",
      title: "Connect Roblox Studio",
      description: "Review the package and establish the Studio bridge.",
    };
  }
  return {
    stage: "operate",
    title: "Review project operations",
    description: "Inspect durable history, system health and project settings.",
  };
}

function describeRun(status: string): string {
  if (["running", "starting", "generation_started", "pending_start"].includes(status)) {
    return "The generation pipeline is active.";
  }
  if (["completed", "ready", "exported"].includes(status)) {
    return "The latest known run completed successfully.";
  }
  if (["failed", "error"].includes(status)) {
    return "The latest known run needs attention.";
  }
  return "No active generation run is reported.";
}

function stageLabel(stage: WorkspaceStage): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}
