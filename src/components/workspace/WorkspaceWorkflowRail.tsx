import type { ComponentType } from "react";
import {
  Activity,
  Blocks,
  FileCheck2,
  PlugZap,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const WORKSPACE_STAGES = [
  "define",
  "generate",
  "validate",
  "integrate",
  "operate",
] as const;

export type WorkspaceStage = (typeof WORKSPACE_STAGES)[number];
export type WorkspaceStageStatus = "ready" | "active" | "blocked" | "idle";

interface StageDefinition {
  id: WorkspaceStage;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const STAGES: StageDefinition[] = [
  {
    id: "define",
    label: "Define",
    description: "Brief, blueprint and AI conversation",
    icon: Blocks,
  },
  {
    id: "generate",
    label: "Generate",
    description: "Execution, agents and live progress",
    icon: Activity,
  },
  {
    id: "validate",
    label: "Validate",
    description: "Simulation, economy and quality tools",
    icon: FileCheck2,
  },
  {
    id: "integrate",
    label: "Integrate",
    description: "Manifest, package and Roblox Studio",
    icon: PlugZap,
  },
  {
    id: "operate",
    label: "Operate",
    description: "History, diagnostics and settings",
    icon: Settings2,
  },
];

export function isWorkspaceStage(value: unknown): value is WorkspaceStage {
  return WORKSPACE_STAGES.includes(value as WorkspaceStage);
}

export function WorkspaceWorkflowRail({
  activeStage,
  statuses,
  onStageChange,
}: {
  activeStage: WorkspaceStage;
  statuses: Partial<Record<WorkspaceStage, WorkspaceStageStatus>>;
  onStageChange: (stage: WorkspaceStage) => void;
}) {
  return (
    <nav aria-label="Project workflow" className="mb-6 min-w-0">
      <div className="grid min-w-0 gap-2 md:grid-cols-5">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const status = statuses[stage.id] ?? "idle";
          const selected = activeStage === stage.id;

          return (
            <Button
              key={stage.id}
              type="button"
              variant="ghost"
              aria-current={selected ? "step" : undefined}
              onClick={() => onStageChange(stage.id)}
              className={cn(
                "h-auto min-h-24 min-w-0 justify-start overflow-hidden whitespace-normal rounded-xl border p-3 text-left md:min-h-20 xl:min-h-24",
                selected
                  ? "border-primary/50 bg-primary/10 shadow-sm"
                  : "border-border/60 bg-card/40 hover:bg-card/70",
              )}
            >
              <span className="flex min-w-0 w-full items-start gap-2.5">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                    selected
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border/60 bg-background/60 text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 overflow-hidden">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 font-medium">
                      {index + 1}. {stage.label}
                    </span>
                    <StageStatusBadge status={status} />
                  </span>
                  <span className="mt-1 block whitespace-normal break-words text-xs font-normal leading-relaxed text-muted-foreground md:hidden xl:block">
                    {stage.description}
                  </span>
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}

function StageStatusBadge({ status }: { status: WorkspaceStageStatus }) {
  const label =
    status === "active"
      ? "Active"
      : status === "ready"
        ? "Ready"
        : status === "blocked"
          ? "Blocked"
          : "Idle";

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 shrink-0 px-1.5 text-[10px] font-medium",
        status === "active" && "border-primary/40 text-primary",
        status === "ready" && "border-success/40 text-success",
        status === "blocked" && "border-warning/40 text-warning",
        status === "idle" && "border-border/60 text-muted-foreground",
      )}
    >
      {label}
    </Badge>
  );
}
