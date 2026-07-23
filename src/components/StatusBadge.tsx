import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectStatus, AgentStatus } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  ready: "bg-success/15 text-success border-success/30",
  exported: "bg-cyan/15 text-cyan border-cyan/30",
  generating: "bg-primary/15 text-primary border-primary/30",
  running: "bg-primary/15 text-primary border-primary/30",
  draft: "bg-muted text-muted-foreground border-border",
  idle: "bg-muted text-muted-foreground border-border",
  queued: "bg-warning/15 text-warning border-warning/30",
  completed: "bg-success/15 text-success border-success/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
};

const LABELS: Record<string, string> = {
  ready: "Ready",
  exported: "Exported",
  generating: "Generating",
  running: "Running",
  draft: "Draft",
  idle: "Idle",
  queued: "Queued",
  completed: "Completed",
  error: "Error",
};

export function StatusBadge({ status }: { status: ProjectStatus | AgentStatus }) {
  const pulsing = status === "generating" || status === "running";
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium capitalize", STATUS_STYLES[status])}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-current",
          pulsing && "animate-glow-pulse",
        )}
      />
      {LABELS[status] ?? status}
    </Badge>
  );
}
