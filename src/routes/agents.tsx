import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, Activity, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { AppLayout } from "@/layouts/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { AgentCard } from "@/components/agents/AgentCard";
import { Button } from "@/components/ui/button";
import { backendApi, type RealtimeAgent } from "@/services/backendApi";
import { toast } from "sonner";

export const Route = createFileRoute("/agents")({
  head: () => ({ meta: [{ title: "AI Agents — Roblox AI Studio" }] }),
  component: AgentsPage,
});

function AgentsPage() {
  const [agents, setAgents] = useState<RealtimeAgent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setAgents(await backendApi.workspace.agents());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Agent load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const total = agents.length;
  const completed = agents.filter((a) => a.status === "completed").length;
  const running = agents.filter((a) => a.status === "running").length;
  const queued = agents.filter(
    (a) => a.status === "queued" || a.status === "idle",
  ).length;

  const stats = [
    { label: "Total agents", value: total, icon: Bot, color: "text-primary" },
    {
      label: "Completed",
      value: completed,
      icon: CheckCircle2,
      color: "text-success",
    },
    { label: "Running", value: running, icon: Activity, color: "text-cyan" },
    {
      label: "Queued",
      value: queued,
      icon: Clock,
      color: "text-muted-foreground",
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="AI Agents"
        description="Agents registered by the live Roblox AI Studio backend."
        actions={
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
        }
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
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={{ ...agent, icon: "Bot" }} />
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-cyan/30 bg-cyan/10 p-4 text-sm text-cyan">
        {loading
          ? "Loading the backend agent registry…"
          : `${agents.length} live agent definitions loaded from /api/system/agents.`}
      </div>
    </AppLayout>
  );
}
