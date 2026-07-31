import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { Bot, type LucideIcon } from "lucide-react";
import type { Agent } from "@/types";

const AGENT_ICONS: Readonly<Record<string, LucideIcon>> = { Bot };

export function AgentCard({ agent }: { agent: Agent }) {
  const Icon = AGENT_ICONS[agent.icon] ?? Bot;

  return (
    <Card className="border-border/60 bg-card/50 p-5 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            agent.status === "running"
              ? "bg-primary/15 text-primary"
              : "bg-accent text-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <StatusBadge status={agent.status} />
      </div>
      <h3 className="mt-4 font-semibold">{agent.name}</h3>
      <p className="text-xs font-medium text-primary">{agent.role}</p>
      <p className="mt-2 text-sm text-muted-foreground">{agent.description}</p>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{agent.progress}%</span>
        </div>
        <Progress value={agent.progress} className="h-1.5" />
      </div>
    </Card>
  );
}
