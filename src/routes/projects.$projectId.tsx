import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  FileCode,
  MessageSquare,
  Bot,
  ScrollText,
  Settings2,
  Download,
  LayoutGrid,
  Folder,
  FileText,
  Lock,
  ArrowLeft,
} from "lucide-react";
import { AppLayout } from "@/layouts/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { AgentCard } from "@/components/agents/AgentCard";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CoverGeneratorDialog } from "@/components/projects/CoverGeneratorDialog";
import { useProjects } from "@/contexts/ProjectsContext";
import { AGENT_BLUEPRINT } from "@/constants";
import { MOCK_LOGS } from "@/constants/mock-data";
import { formatDate } from "@/utils/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({ meta: [{ title: "Project — Roblox AI Studio" }] }),
  component: ProjectDetailPage,
});

const FILE_TREE = [
  { name: "ServerScriptService", type: "folder", items: ["MainGame.lua", "DataStore.lua", "RebirthSystem.lua"] },
  { name: "ReplicatedStorage", type: "folder", items: ["Remotes", "PetModule.lua", "Config.lua"] },
  { name: "StarterGui", type: "folder", items: ["ShopUI.rbxm", "HUD.rbxm", "Inventory.rbxm"] },
];

const LOG_COLORS: Record<string, string> = {
  info: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive",
};

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const { getProject, deleteProject } = useProjects();
  const navigate = useNavigate();
  const project = getProject(projectId);

  if (!project) {
    return (
      <AppLayout>
        <EmptyState
          icon={<Folder className="h-6 w-6" />}
          title="Project not found"
          description="It may have been deleted or never existed."
          action={
            <Button asChild>
              <Link to="/projects">Back to projects</Link>
            </Button>
          }
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/projects">Projects</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <CoverGeneratorDialog project={project} />
          <Button variant="outline" asChild className="border-border/60">
            <Link to="/projects"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 bg-card/50 p-1">
          <TabsTrigger value="overview"><LayoutGrid className="mr-1.5 h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="files"><FileCode className="mr-1.5 h-4 w-4" />Files</TabsTrigger>
          <TabsTrigger value="chat"><MessageSquare className="mr-1.5 h-4 w-4" />AI Chat</TabsTrigger>
          <TabsTrigger value="agents"><Bot className="mr-1.5 h-4 w-4" />Agents</TabsTrigger>
          <TabsTrigger value="logs"><ScrollText className="mr-1.5 h-4 w-4" />Logs</TabsTrigger>
          <TabsTrigger value="settings"><Settings2 className="mr-1.5 h-4 w-4" />Settings</TabsTrigger>
          <TabsTrigger value="export"><Download className="mr-1.5 h-4 w-4" />Export</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          {project.coverUrl ? (
            <Card className="overflow-hidden border-border/60 bg-card/50 p-0">
              <img
                src={project.coverUrl}
                alt={`${project.name} cover`}
                className="aspect-video w-full object-cover"
              />
            </Card>
          ) : (
            <Card className="flex items-center justify-between gap-4 border-dashed border-border/60 bg-card/30 p-5">
              <div>
                <p className="font-medium">No intro cover yet</p>
                <p className="text-sm text-muted-foreground">
                  Generate a logo &amp; title screen for your game.
                </p>
              </div>
              <CoverGeneratorDialog project={project} />
            </Card>
          )}
          {project.status === "generating" && (
            <Card className="border-primary/30 bg-card/50 p-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Generation in progress</span>
                <span className="text-muted-foreground">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-2" />
            </Card>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Game type", value: project.gameType },
              { label: "Genre", value: project.genre },
              { label: "Difficulty", value: project.difficulty },
              { label: "Players", value: project.players },
              { label: "Target audience", value: project.targetAudience },
              { label: "Created", value: formatDate(project.createdAt) },
              { label: "Updated", value: formatDate(project.updatedAt) },
              { label: "Project ID", value: project.id },
            ].map((item) => (
              <Card key={item.label} className="border-border/60 bg-card/50 p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 truncate font-medium">{item.value}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Files */}
        <TabsContent value="files">
          <Card className="border-border/60 bg-card/50 p-4">
            <div className="space-y-4">
              {FILE_TREE.map((folder) => (
                <div key={folder.name}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Folder className="h-4 w-4 text-primary" /> {folder.name}
                  </div>
                  <ul className="ml-6 mt-1 space-y-1 border-l border-border/60 pl-4">
                    {folder.items.map((f) => (
                      <li key={f} className="flex items-center gap-2 py-1 font-mono text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Sample structure — real generated files will appear here.
            </p>
          </Card>
        </TabsContent>

        {/* Chat */}
        <TabsContent value="chat">
          <ChatPanel />
        </TabsContent>

        {/* Agents */}
        <TabsContent value="agents">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AGENT_BLUEPRINT.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs">
          <Card className="border-border/60 bg-card/50 p-4">
            <div className="space-y-1 font-mono text-xs">
              {MOCK_LOGS.map((log) => (
                <div key={log.id} className="flex gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/50">
                  <span className="text-muted-foreground/60">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={cn("uppercase", LOG_COLORS[log.level])}>[{log.level}]</span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card className="max-w-lg space-y-5 border-border/60 bg-card/50 p-6">
            <div className="space-y-1.5">
              <Label>Project name</Label>
              <Input defaultValue={project.name} />
            </div>
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <Badge variant="outline" className="border-border/60">Private</Badge>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => toast.success("Settings saved (placeholder).")}>Save</Button>
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  deleteProject(project.id);
                  toast.success("Project deleted.");
                  navigate({ to: "/projects" });
                }}
              >
                Delete project
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Export */}
        <TabsContent value="export">
          <EmptyState
            icon={<Download className="h-6 w-6" />}
            title="Export to Roblox Studio"
            description="When generation completes, you'll be able to download a ready-to-open .rbxl project package here."
            action={
              <Button
                disabled
                className="bg-gradient-primary text-primary-foreground opacity-70"
              >
                <Lock className="mr-1.5 h-4 w-4" /> Export coming soon
              </Button>
            }
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
