import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FolderKanban,
  Rocket,
  Bot,
  Activity,
  PlusCircle,
  ArrowRight,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { AppLayout } from "@/layouts/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { StudioCapabilities } from "@/components/StudioCapabilities";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/contexts/ProjectsContext";
import { useAuth } from "@/contexts/AuthContext";
import { MOCK_ACTIVITY } from "@/constants/mock-data";
import { formatRelativeTime } from "@/utils/format";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Roblox AI Studio" }] }),
  component: DashboardPage,
});

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: string;
}) {
  return (
    <Card className="border-border/60 bg-card/50 p-5">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-xs font-medium text-success">
            <TrendingUp className="h-3.5 w-3.5" /> {trend}
          </span>
        )}
      </div>
      <p className="mt-4 font-display text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Card>
  );
}

function DashboardPage() {
  const { projects, duplicateProject, deleteProject } = useProjects();
  const { user } = useAuth();

  const generating = projects.filter((p) => p.status === "generating").length;
  const exported = projects.filter((p) => p.status === "exported").length;
  const recent = projects.slice(0, 3);

  return (
    <AppLayout>
      <PageHeader
        title={`Welcome back, ${user?.name ?? "Developer"} 👋`}
        description="Here's what's happening across your studio."
        actions={
          <Button asChild className="bg-gradient-primary text-primary-foreground shadow-glow">
            <Link to="/projects/new">
              <PlusCircle className="mr-1 h-4 w-4" /> New Project
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FolderKanban} label="Total projects" value={String(projects.length)} trend="+2" />
        <StatCard icon={Bot} label="Generating now" value={String(generating)} />
        <StatCard icon={Rocket} label="Exported games" value={String(exported)} trend="+1" />
        <StatCard icon={Activity} label="Active agents" value="8" />
      </div>

      {/* Studio capabilities */}
      <div className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-lg font-semibold">Studio capabilities</h2>
          <span className="text-xs text-muted-foreground">Powered by AI</span>
        </div>
        <StudioCapabilities />
      </div>

      {/* Quick actions */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { title: "New project", desc: "Describe a game idea", to: "/projects/new", icon: PlusCircle },
          { title: "Browse projects", desc: "Manage your games", to: "/projects", icon: FolderKanban },
          { title: "AI Agents", desc: "See the pipeline", to: "/agents", icon: Bot },
        ].map((a) => (
          <Link key={a.to} to={a.to}>
            <Card className="group flex items-center gap-4 border-border/60 bg-card/50 p-4 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <a.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Recent projects */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent projects</h2>
            <Link to="/projects" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {recent.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onDuplicate={(id) => {
                  duplicateProject(id);
                  toast.success("Project duplicated.");
                }}
                onDelete={(id) => {
                  deleteProject(id);
                  toast.success("Project deleted.");
                }}
              />
            ))}
          </div>
        </div>

        {/* Activity */}
        <div>
          <h2 className="mb-4 font-display text-lg font-semibold">Recent activity</h2>
          <Card className="border-border/60 bg-card/50 p-2">
            <ul className="divide-y divide-border/60">
              {MOCK_ACTIVITY.map((a) => (
                <li key={a.id} className="flex gap-3 p-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      {formatRelativeTime(a.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
