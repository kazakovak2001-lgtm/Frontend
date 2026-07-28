import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Folder, Play, Radio } from "lucide-react";
import { AppLayout } from "@/layouts/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { CoverGeneratorDialog } from "@/components/projects/CoverGeneratorDialog";
import { WorkspaceContextRail } from "@/components/workspace/WorkspaceContextRail";
import { WorkspaceStageCanvas } from "@/components/workspace/WorkspaceStageCanvas";
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
import { toast } from "sonner";

type WorkspaceSearch = { stage?: WorkspaceStage };

export const Route = createFileRoute("/projects/$projectId")({
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => ({
    stage: isWorkspaceStage(search.stage) ? search.stage : undefined,
  }),
  head: () => ({ meta: [{ title: "Workspace — Roblox AI Studio" }] }),
  component: ProjectWorkspacePage,
});

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
      activeStage === "operate" ? "active" : history.length ? "ready" : "idle",
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0">
          <WorkspaceStageCanvas
            activeStage={activeStage}
            project={project}
            workspace={workspaceData}
            workspaceRefreshing={workspaceRefreshing}
            realtimeConnected={realtime.snapshot.connected}
            currentStep={realtime.snapshot.currentStep}
            agents={agents}
            logs={realtime.logs}
            activeRunStatus={activeRun?.status}
            progress={progress}
            busy={busy}
            name={name}
            description={description}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onLoadManifest={() => void loadManifest()}
            onDownloadManifest={() => void downloadManifest()}
            onSyncStudio={() => void syncStudio()}
            onRefresh={() => void refreshWorkspace()}
            onSaveSettings={() => void saveSettings()}
            onRemoveProject={() => void removeProject()}
          />
        </main>

        <WorkspaceContextRail
          activeStage={activeStage}
          projectStatus={project.status}
          runStatus={activeRun?.status}
          progress={progress}
          currentStep={realtime.snapshot.currentStep}
          realtimeConnected={realtime.snapshot.connected}
          workspace={workspaceData}
          recentActivity={realtime.logs}
          refreshing={workspaceRefreshing}
          onRefresh={() => void refreshWorkspace()}
          onStageChange={(nextStage) => void selectStage(nextStage)}
        />
      </div>
    </AppLayout>
  );
}
