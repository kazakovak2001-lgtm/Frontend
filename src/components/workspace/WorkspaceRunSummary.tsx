import type { ReactNode } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { WorkspaceExecution } from "@/services/workspaceReadModel";

export function WorkspaceRunSummary({
  projectStatus,
  runStatus,
  progress,
  currentStep,
  latestExecution,
}: {
  projectStatus: string;
  runStatus?: string;
  progress: number;
  currentStep?: string;
  latestExecution?: WorkspaceExecution;
}) {
  const status = runStatus ?? latestExecution?.status ?? projectStatus;
  const completedSteps =
    latestExecution?.pipeline_steps.filter((step) => step.status === "completed")
      .length ?? 0;
  const failedSteps =
    latestExecution?.pipeline_steps.filter((step) => step.status === "failed")
      .length ?? 0;
  const totalSteps = latestExecution?.pipeline_steps.length ?? 0;

  return (
    <Card className="border-border/60 bg-card/50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Current generation run</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentStep || describeStatus(status)}
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-border/60 capitalize">
          {status.replaceAll("_", " ")}
        </Badge>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Execution progress</span>
          <span>{Math.max(0, Math.min(progress, 100))}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric
          icon={<CheckCircle2 className="h-4 w-4 text-success" />}
          label="Completed steps"
          value={String(completedSteps)}
        />
        <Metric
          icon={<AlertTriangle className="h-4 w-4 text-warning" />}
          label="Failed steps"
          value={String(failedSteps)}
        />
        <Metric
          icon={<Clock3 className="h-4 w-4 text-muted-foreground" />}
          label="Known steps"
          value={String(totalSteps)}
        />
      </div>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function describeStatus(status: string): string {
  switch (status) {
    case "running":
    case "generation_started":
    case "starting":
    case "pending_start":
      return "The generation pipeline is running.";
    case "completed":
    case "ready":
      return "The latest generation run completed.";
    case "failed":
      return "The latest generation run requires attention.";
    default:
      return "No active generation run. Start generation when the project brief is ready.";
  }
}
