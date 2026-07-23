import { createFileRoute } from "@tanstack/react-router";
import { Bot, Activity, CheckCircle2, Clock } from "lucide-react";
import { AppLayout } from "@/layouts/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { AgentCard } from "@/components/agents/AgentCard";
import { AGENT_BLUEPRINT } from "@/constants";

export const Route = createFileRoute("/agents")({
  head: () => ({ meta: [{ title: "AI Agents — Roblox AI Studio" }] }),
  component: AgentsPage,
});

function AgentsPage() {
  const total = AGENT_BLUEPRINT.length;
  const completed = AGENT_BLUEPRINT.filter((a) => a.status === "completed").length;
  const running = AGENT_BLUEPRINT.filter((a) => a.status === "running").length;
  const queued = AGENT_BLUEPRINT.filter((a) => a.status === "queued" || a.status === "idle").length;

  const stats = [
    { label: "Total agents", value: total, icon: Bot, color: "text-primary" },
    { label: "Completed", value: completed, icon: CheckCircle2, color: "text-success" },
    { label: "Running", value: running, icon: Activity, color: "text-cyan" },
    { label: "Queued", value: queued, icon: Clock, color: "text-muted-foreground" },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="AI Agents"
        description="The autonomous pipeline that turns your prompt into a complete Roblox game."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/60 bg-card/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {AGENT_BLUEPRINT.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-cyan/30 bg-cyan/10 p-4 text-sm text-cyan">
        These agents represent the planned generation pipeline. Live orchestration connects in a future release.
      </div>
    </AppLayout>
  );
}
