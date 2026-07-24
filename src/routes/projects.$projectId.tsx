import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bot,
  Download,
  Folder,
  History,
  Play,
  Radio,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { AppLayout } from "@/layouts/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { PageLoader } from "@/components/PageLoader";
import { AgentCard } from "@/components/agents/AgentCard";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CoverGeneratorDialog } from "@/components/projects/CoverGeneratorDialog";
import { WorkspaceModules } from "@/components/workspace/WorkspaceModules";
import { WorkspaceRunSummary } from "@/components/workspace/WorkspaceRunSummary";
import {
  WorkspaceWorkflowRail,
  isWorkspaceStage,
  type WorkspaceStage,
  type WorkspaceStageStatus,
} from "@/components/workspace/WorkspaceWorkflowRail";
import { useProjects } from "@/contexts/ProjectsContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useProjectRealtime } from "@/hooks/useProjectRealtime";
import { useProjectWorkspaceData } from "@/hooks/useProjectWorkspaceData";
import { backendApi } from "@/services/backendApi";
import { formatDate } from "@/utils/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type WorkspaceSearch = { stage?: WorkspaceStage };

export const Route = createFileRoute("/projects/$projectId")({
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => ({
    stage: isWorkspaceStage(search.stage) ? search.stage : undefined,
  }),
  head: () => ({ meta: [{ title: "Workspace — Roblox AI Studio" }] }),
  component: ProjectWorkspacePage,
});

const LOG_COLORS: Record<string, string> = {
  info: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive",
};

function ProjectWorkspacePage() {
  const { projectId } = Route.useParams();
  const { stage } = Route.useSearch();
  const activeStage = stage ?? "define";
  const {
    getProject,
    isLoading,
    updateProject,
    deleteProject,
    refreshProjects,
  } = useProjects();
  const { runs, setRun } = useWorkspace();
  const realtime = useProjectRealtime(projectId);
  const {
    data: workspaceData,
    refreshing: workspaceRefreshing,
    error: workspaceError,
    refresh: refreshWorkspace,
  } = useProjectWorkspaceData(projectId);
  const navigate = useNavigate();
  const project = getProject(projectId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState<string>();
  const [realtimeWaitElapsed, setRealtimeWaitElapsed] = useState(false);
  const pendingStartRef = useRef<string | undefined>(undefined);
  const activeRun = runs[projectId];
  const history = workspaceData?.history ?? [];
  const manifest = workspaceData?.manifest;

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setDescription(project.description);
  }, [project]);

  useEffect(() => {
    const latest = history[0];
    if (latest && ["running", "queued"].includes(latest.status)) {
      setRun({
        projectId,
        executionId: latest.pipelineId,
        status: latest.status,
        startedAt: new Date(latest.startedAt).toISOString(),
      });
    }
  }, [history, projectId, setRun]);

  useEffect(() => {
    setRealtimeWaitElapsed(false);
    const timer = window.setTimeout(() => setRealtimeWaitElapsed(true), 1_500);
    return () => window.clearTimeout(timer);
  }, [projectId]);

  useEffect(() => {
    if (
      !project ||
      activeRun?.status !== "pending_start" ||
      (!realtime.snapshot.connected && !realtimeWaitElapsed) ||
      pendingStartRef.current === project.id
    ) {
      return;
    }

    pendingStartRef.current = project.id;
    void backendApi.ai
      .startGeneration(project.id)
      .then(async (result) => {
        setRun({
          projectId: project.id,
          executionId: result.executionId,
          status: result.status,
          startedAt: activeRun.startedAt,
        });
        await Promise.all([refreshProjects(), refreshWorkspace()]);
        toast.success("Generation started.");
      })
      .catch((error) => {
        setRun({
          projectId: project.id,
          executionId: "pending",
          status: "failed",
          startedAt: activeRun.startedAt,
        });
        toast.error(
          error instanceof Error ? error.message : "Generation failed",
        );
      });
  }, [
    activeRun?.startedAt,
    activeRun?.status,
    project,
    realtime.snapshot.connected,
    realtimeWaitElapsed,
    refreshProjects,
    refreshWorkspace,
    setRun,
  ]);

  const activeExecutionId = activeRun?.executionId;
  const activeRunStartedAt = activeRun?.startedAt;
  const activeRunStatus = activeRun?.status;
  useEffect(() => {
    if (
      !activeExecutionId ||
      activeExecutionId === "pending" ||
      !activeRunStartedAt ||
      !activeRunStatus ||
      [
        "pending_start",
        "starting",
        "completed",
        "failed",
        "cancelled",
      ].includes(activeRunStatus)
    ) {
      return;
    }

    let active = true;
    const poll = async () => {
      try {
        const execution = await backendApi.ai.generationStatus(
          projectId,
          activeExecutionId,
        );
        if (!active) return;
        const status = String(execution.status ?? "running");
        setRun({
          projectId,
          executionId: activeExecutionId,
          status,
          startedAt: activeRunStartedAt,
        });
        if (["completed", "failed", "cancelled"].includes(status)) {
          await Promise.all([refreshProjects(), refreshWorkspace()]);
        }
      } catch (error) {
        console.warn("[workspace] generation poll failed", error);
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 3_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [
    activeExecutionId,
    activeRunStartedAt,
    activeRunStatus,
    projectId,
    refreshProjects,
    refreshWorkspace,
    setRun,
  ]);

  const agents = useMemo(() => {
    const live = realtime.agents;
    if (live.length) return live;
    return (workspaceData?.agents ?? []).map((agent) => ({
      ...agent,
      icon: "Bot",
    }));
  }, [realtime.agents, workspaceData?.agents]);

  if (isLoading) {
    return (
      <AppLayout>
        <PageLoader />
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <EmptyState
          icon={<Folder className="h-6 w-6" />}
          title="Project not found"
          description="It may have been deleted or you may not have access."
          action={
            <Button asChild>
              <Link to="/projects">Back to projects</Link>
            </Button>
          }
        />
      </AppLayout>
    );
  }

  const startGeneration = async () => {
    setBusy("generate");
    try {
      const result = await backendApi.ai.startGeneration(project.id);
      setRun({
        projectId: project.id,
        executionId: result.executionId,
        status: result.status,
        startedAt: new Date().toISOString(),
      });
      await Promise.all([refreshProjects(), refreshWorkspace()]);
      await selectStage("generate");
      toast.success("Generation started.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setBusy(undefined);
    }
  };

  const loadManifest = async () => {
    setBusy("manifest");
    try {
      const data = await refreshWorkspace();
      if (!data?.manifest) {
        toast.error("Generate the project before loading its manifest.");
        return undefined;
      }
      return data.manifest;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
      return undefined;
    } finally {
      setBusy(undefined);
    }
  };

  const downloadManifest = async () => {
    const data = manifest ?? (await loadManifest());
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-roblox-manifest.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Project manifest downloaded.");
  };

  const syncStudio = async () => {
    setBusy("studio");
    try {
      await backendApi.workspace.studio.sync(project.id);
      await refreshWorkspace();
      toast.success("Studio synchronization completed.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Studio sync failed",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const saveSettings = async () => {
    setBusy("settings");
    try {
      await updateProject(project.id, { name, description });
      toast.success("Project settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(undefined);
    }
  };

  const removeProject = async () => {
    if (
      !window.confirm(
        `Delete “${project.name}”? This removes the project from the workspace.`,
      )
    ) {
      return;
    }
    setBusy("delete");
    try {
      await deleteProject(project.id);
      toast.success("Project deleted.");
      await navigate({ to: "/projects" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusy(undefined);
    }
  };

  const selectStage = (nextStage: WorkspaceStage) =>
    navigate({
      to: "/projects/$projectId",
      params: { projectId },
      search: { stage: nextStage },
      replace: true,
    });

  const progress =
    realtime.snapshot.status === "running"
      ? realtime.snapshot.progress
      : project.progress;
  const isGenerating =
    project.status === "generating" ||
    realtime.snapshot.status === "running" ||
    activeRun?.status === "running" ||
    activeRun?.status === "pending_start" ||
    activeRun?.status === "starting" ||
    activeRun?.status === "generation_started";
  const readiness = workspaceData?.readiness;
  const stageStatuses: Record<WorkspaceStage, WorkspaceStageStatus> = {
    define:
      activeStage === "define"
        ? "active"
        : readiness?.hasBlueprint
          ? "ready"
          : "idle",
    generate:
      activeStage === "generate"
        ? "active"
        : isGenerating
          ? "active"
          : readiness?.hasExecution
            ? "ready"
            : readiness?.hasBlueprint
              ? "idle"
              : "blocked",
    validate:
      activeStage === "validate"
        ? "active"
        : readiness?.canValidate
          ? "ready"
          : "blocked",
    integrate:
      activeStage === "integrate"
        ? "active"
        : readiness?.hasCompletedExecution
          ? readiness.studioConnected
            ? "ready"
            : "idle"
          : "blocked",
    operate:
      activeStage === "operate"
        ? "active"
        : history.length
          ? "ready"
          : "idle",
  };

  return (
    <AppLayout>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/projects">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{project.name} workspace</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {project.name}
            </h1>
            <StatusBadge status={project.status} />
            <Badge
              variant="outline"
              className={
                realtime.snapshot.connected
                  ? "border-success/40 text-success"
                  : "border-warning/40 text-warning"
              }
            >
              <Radio className="mr-1 h-3 w-3" />
              {realtime.snapshot.connected
                ? "Realtime connected"
                : "Realtime offline"}
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {project.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void startGeneration()}
            disabled={busy === "generate" || isGenerating}
          >
            <Play className="mr-1 h-4 w-4" />
            {isGenerating ? "Generating…" : "Generate"}
          </Button>
          <CoverGeneratorDialog project={project} />
          <Button variant="outline" asChild className="border-border/60">
            <Link to="/projects">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
      </div>

      {(workspaceError || workspaceData?.degradedSources.length) && (
        <Card className="mb-6 border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-medium text-warning">Workspace data is degraded</p>
          <p className="mt-1 text-muted-foreground">
            {workspaceError ?? workspaceData?.degradedSources.join(" · ")}
          </p>
        </Card>
      )}

      <WorkspaceWorkflowRail
        activeStage={activeStage}
        statuses={stageStatuses}
        onStageChange={(nextStage) => void selectStage(nextStage)}
      />

      {activeStage === "define" && (
        <section className="space-y-6" aria-labelledby="define-stage-title">
          <StageHeading
            id="define-stage-title"
            title="Define the project"
            description="Clarify the game brief, inspect the persisted blueprint and continue the AI conversation."
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <div className="space-y-6">
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
                      Generate and persist a cover for this project.
                    </p>
                  </div>
                  <CoverGeneratorDialog project={project} />
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
                  { label: "Conversations", value: workspaceData?.conversations.length },
                ].map((item) => (
                  <Card
                    key={item.label}
                    className="border-border/60 bg-card/50 p-4"
                  >
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="mt-1 truncate font-medium">
                      {item.value ?? "Not set"}
                    </p>
                  </Card>
                ))}
              </div>

              <Card className="border-border/60 bg-card/50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Persisted blueprint</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Canonical project definition loaded from the backend export boundary.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      readiness?.hasBlueprint
                        ? "border-success/40 text-success"
                        : "border-warning/40 text-warning"
                    }
                  >
                    {readiness?.hasBlueprint ? "Available" : "Not generated"}
                  </Badge>
                </div>
                {manifest?.blueprint ? (
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <BlueprintField label="Name" value={manifest.blueprint.name} />
                    <BlueprintField
                      label="Status"
                      value={manifest.blueprint.status}
                    />
                    <BlueprintField
                      label="Version"
                      value={String(manifest.blueprint.version)}
                    />
                  </dl>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed border-border/60 p-5 text-sm text-muted-foreground">
                    Start generation to create the durable project blueprint.
                  </p>
                )}
              </Card>
            </div>

            <ChatPanel project={project} />
          </div>
        </section>
      )}

      {activeStage === "generate" && (
        <section className="space-y-6" aria-labelledby="generate-stage-title">
          <StageHeading
            id="generate-stage-title"
            title="Generate the experience"
            description="Track the active execution, agent activity and live pipeline events."
          />

          <WorkspaceRunSummary
            projectStatus={project.status}
            runStatus={activeRun?.status}
            progress={progress}
            currentStep={realtime.snapshot.currentStep}
            latestExecution={workspaceData?.latestExecution}
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
            <Card className="border-border/60 bg-card/50 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Generation agents</h2>
                  <p className="text-sm text-muted-foreground">
                    Live agents take precedence over the persisted registry.
                  </p>
                </div>
                <Badge variant="outline" className="border-border/60">
                  {agents.length} agents
                </Badge>
              </div>
              {agents.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {agents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Bot className="h-6 w-6" />}
                  title="No agents reported"
                  description="Start generation to receive live agent activity."
                />
              )}
            </Card>

            <Card className="border-border/60 bg-card/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3 px-2">
                <div>
                  <h2 className="font-semibold">Live activity</h2>
                  <p className="text-xs text-muted-foreground">
                    Socket.IO project events for the current session.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    realtime.snapshot.connected
                      ? "border-success/40 text-success"
                      : "border-warning/40 text-warning"
                  }
                >
                  {realtime.snapshot.connected ? "Connected" : "Offline"}
                </Badge>
              </div>
              {realtime.logs.length ? (
                <div className="max-h-[48vh] space-y-1 overflow-auto font-mono text-xs">
                  {realtime.logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/50"
                    >
                      <span className="text-muted-foreground/60">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={cn("uppercase", LOG_COLORS[log.level])}>
                        [{log.level}]
                      </span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {realtime.snapshot.connected
                    ? "Connected. Pipeline events will appear here."
                    : "Realtime connection is unavailable."}
                </p>
              )}
            </Card>
          </div>
        </section>
      )}

      {activeStage === "validate" && (
        <section className="space-y-6" aria-labelledby="validate-stage-title">
          <StageHeading
            id="validate-stage-title"
            title="Validate and improve"
            description="Run the existing simulation, economy, quality, controller and production tools against the project."
          />
          {!readiness?.canValidate && (
            <Card className="border-warning/30 bg-warning/5 p-5 text-sm">
              A persisted blueprint is required before validation results can be treated as canonical.
            </Card>
          )}
          <WorkspaceModules project={project} />
        </section>
      )}

      {activeStage === "integrate" && (
        <section className="space-y-6" aria-labelledby="integrate-stage-title">
          <StageHeading
            id="integrate-stage-title"
            title="Integrate and export"
            description="Inspect the generated package, download the manifest and manage the Roblox Studio bridge."
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.65fr)]">
            <Card className="space-y-4 border-border/60 bg-card/50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Generated project manifest</h2>
                  <p className="text-xs text-muted-foreground">
                    Blueprint and execution metadata returned by the backend.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy === "manifest" || workspaceRefreshing}
                    onClick={() => void loadManifest()}
                  >
                    <RefreshCw className="mr-1 h-4 w-4" /> Refresh
                  </Button>
                  <Button
                    disabled={busy === "manifest" || workspaceRefreshing}
                    onClick={() => void downloadManifest()}
                  >
                    <Download className="mr-1 h-4 w-4" /> Download
                  </Button>
                </div>
              </div>
              {manifest ? (
                <pre className="max-h-[55vh] overflow-auto rounded-xl bg-background/70 p-4 font-mono text-xs text-muted-foreground">
                  {JSON.stringify(manifest, null, 2)}
                </pre>
              ) : (
                <p className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                  Generate the project, then refresh its backend manifest.
                </p>
              )}
            </Card>

            <Card className="space-y-5 border-border/60 bg-card/50 p-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Roblox Studio bridge</h2>
                  <Badge
                    variant="outline"
                    className={
                      workspaceData?.studio.status === "connected"
                        ? "border-success/40 text-success"
                        : "border-warning/40 text-warning"
                    }
                  >
                    {workspaceData?.studio.status ?? "unknown"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {workspaceData?.studio.message ??
                    "Studio connection status is unavailable."}
                </p>
              </div>

              <dl className="grid gap-3 text-sm">
                <BlueprintField
                  label="Bridge version"
                  value={workspaceData?.studio.bridgeVersion ?? "Unknown"}
                />
                <BlueprintField
                  label="Last sync"
                  value={workspaceData?.studio.lastSyncAt ?? "Never"}
                />
                <BlueprintField
                  label="Pending changes"
                  value={String(workspaceData?.studio.pendingChanges ?? 0)}
                />
              </dl>

              <Card className="border-warning/30 bg-warning/5 p-4 text-xs text-muted-foreground">
                Studio connectivity is available, but real generated-artifact delivery remains unverified until STUDIO-1.
              </Card>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={workspaceRefreshing}
                  onClick={() => void refreshWorkspace()}
                >
                  Refresh status
                </Button>
                <Button
                  disabled={
                    busy === "studio" ||
                    workspaceData?.studio.status !== "connected"
                  }
                  onClick={() => void syncStudio()}
                >
                  Sync to Studio
                </Button>
              </div>
            </Card>
          </div>
        </section>
      )}

      {activeStage === "operate" && (
        <section className="space-y-6" aria-labelledby="operate-stage-title">
          <StageHeading
            id="operate-stage-title"
            title="Operate the project"
            description="Review durable generation history and manage project settings."
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]">
            <Card className="border-border/60 bg-card/50 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Generation history</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Restart-durable project execution records.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={workspaceRefreshing}
                  onClick={() => void refreshWorkspace()}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
                </Button>
              </div>

              {history.length ? (
                <div className="space-y-3">
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{record.pipelineId}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(record.startedAt).toLocaleString()} · {record.stagesCompleted}/{record.stagesTotal} stages
                        </p>
                      </div>
                      <Badge variant="outline" className="w-fit capitalize">
                        {record.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                  No generation runs are recorded yet.
                </p>
              )}
            </Card>

            <Card className="space-y-5 border-border/60 bg-card/50 p-6">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Project settings</h2>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-description">Description</Label>
                <Input
                  id="project-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <Badge variant="outline" className="border-border/60">
                  Private
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy === "settings" || !name.trim()}
                  onClick={() => void saveSettings()}
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  disabled={busy === "delete"}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => void removeProject()}
                >
                  Delete project
                </Button>
              </div>
            </Card>
          </div>
        </section>
      )}
    </AppLayout>
  );
}

function StageHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 id={id} className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function BlueprintField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-medium">{value}</dd>
    </div>
  );
}
