import { Bot, Download, History, RefreshCw, Settings2 } from "lucide-react";
import { AgentCard } from "@/components/agents/AgentCard";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CoverGeneratorDialog } from "@/components/projects/CoverGeneratorDialog";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkspaceModules } from "@/components/workspace/WorkspaceModules";
import { WorkspaceRunSummary } from "@/components/workspace/WorkspaceRunSummary";
import type { WorkspaceStage } from "@/components/workspace/WorkspaceWorkflowRail";
import type { WorkspaceReadModel } from "@/services/workspaceReadModel";
import {
  canSyncWorkspaceStudio,
  describeWorkspaceStudioVerification,
  type WorkspaceStudioConnectionStatus,
  type WorkspaceStudioVerificationStatus,
} from "@/services/workspaceStudioStatus";
import type { Agent, LogEntry, Project } from "@/types";
import { formatDate } from "@/utils/format";
import { cn } from "@/lib/utils";

export function WorkspaceStageCanvas({
  activeStage,
  project,
  workspace,
  workspaceRefreshing,
  realtimeConnected,
  currentStep,
  agents,
  logs,
  activeRunStatus,
  progress,
  busy,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onLoadManifest,
  onDownloadManifest,
  onSyncStudio,
  onRefresh,
  onSaveSettings,
  onRemoveProject,
}: {
  activeStage: WorkspaceStage;
  project: Project;
  workspace?: WorkspaceReadModel;
  workspaceRefreshing: boolean;
  realtimeConnected: boolean;
  currentStep?: string;
  agents: Agent[];
  logs: LogEntry[];
  activeRunStatus?: string;
  progress: number;
  busy?: string;
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onLoadManifest: () => void;
  onDownloadManifest: () => void;
  onSyncStudio: () => void;
  onRefresh: () => void;
  onSaveSettings: () => void;
  onRemoveProject: () => void;
}) {
  const manifest = workspace?.manifest;
  const readiness = workspace?.readiness;
  const history = workspace?.history ?? [];
  const studio = workspace?.studio;
  const studioVerificationIsStale =
    studio?.verificationStatus === "verified" &&
    readiness?.studioArtifactVerified === false;

  if (activeStage === "define") {
    return (
      <StageSection
        id="define-stage-title"
        title="Define the project"
        description="Clarify the game brief, inspect the persisted blueprint and continue the AI conversation."
      >
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
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

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Game type", value: project.gameType },
                { label: "Genre", value: project.genre },
                { label: "Difficulty", value: project.difficulty },
                { label: "Players", value: project.players },
                { label: "Target audience", value: project.targetAudience },
                { label: "Created", value: formatDate(project.createdAt) },
                { label: "Updated", value: formatDate(project.updatedAt) },
                {
                  label: "Conversations",
                  value: String(workspace?.conversations.length ?? 0),
                },
              ].map((item) => (
                <Card
                  key={item.label}
                  className="border-border/60 bg-card/50 p-4"
                >
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 truncate font-medium">
                    {item.value || "Not set"}
                  </p>
                </Card>
              ))}
            </div>

            <Card className="border-border/60 bg-card/50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Persisted blueprint</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Canonical project definition loaded from the backend export
                    boundary.
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
                  <DataField label="Name" value={manifest.blueprint.name} />
                  <DataField label="Status" value={manifest.blueprint.status} />
                  <DataField
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

        <ToolSection
          title="Definition intelligence"
          description="Use existing knowledge, design and agent-memory services to strengthen the brief before generation."
        >
          <WorkspaceModules project={project} stage="define" />
        </ToolSection>
      </StageSection>
    );
  }

  if (activeStage === "generate") {
    return (
      <StageSection
        id="generate-stage-title"
        title="Generate the experience"
        description="Track the active execution, agent activity and live pipeline events."
      >
        <WorkspaceRunSummary
          projectStatus={project.status}
          runStatus={activeRunStatus}
          progress={progress}
          currentStep={currentStep}
          latestExecution={workspace?.latestExecution}
        />

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
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
                  realtimeConnected
                    ? "border-success/40 text-success"
                    : "border-warning/40 text-warning"
                }
              >
                {realtimeConnected ? "Connected" : "Offline"}
              </Badge>
            </div>
            {logs.length ? (
              <div className="max-h-[48vh] space-y-1 overflow-auto font-mono text-xs">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/50"
                  >
                    <span className="text-muted-foreground/60">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={cn(
                        "uppercase",
                        log.level === "error"
                          ? "text-destructive"
                          : log.level === "warning"
                            ? "text-warning"
                            : log.level === "success"
                              ? "text-success"
                              : "text-muted-foreground",
                      )}
                    >
                      [{log.level}]
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {realtimeConnected
                  ? "Connected. Pipeline events will appear here."
                  : "Realtime connection is unavailable."}
              </p>
            )}
          </Card>
        </div>

        <ToolSection
          title="Generation controls"
          description="Plan agent execution, inspect the DAG, compile the project and assemble Lua through the existing backend services."
        >
          <WorkspaceModules project={project} stage="generate" />
        </ToolSection>
      </StageSection>
    );
  }

  if (activeStage === "validate") {
    return (
      <StageSection
        id="validate-stage-title"
        title="Validate and improve"
        description="Run governance, simulation, economy and quality tools against the generated project."
      >
        {!readiness?.canValidate && (
          <Card className="border-warning/30 bg-warning/5 p-5 text-sm">
            A persisted blueprint is required before validation results can be
            treated as canonical.
          </Card>
        )}
        <WorkspaceModules project={project} stage="validate" />
      </StageSection>
    );
  }

  if (activeStage === "integrate") {
    return (
      <StageSection
        id="integrate-stage-title"
        title="Integrate and export"
        description="Inspect the generated package, download the manifest and manage the Roblox Studio bridge."
      >
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.65fr)]">
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
                  onClick={onLoadManifest}
                >
                  <RefreshCw className="mr-1 h-4 w-4" /> Refresh
                </Button>
                <Button
                  disabled={busy === "manifest" || workspaceRefreshing}
                  onClick={onDownloadManifest}
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
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge
                    variant="outline"
                    className={studioConnectionBadgeClass(studio?.status)}
                  >
                    {studio?.status ?? "unknown"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={studioVerificationBadgeClass(
                      studio?.verificationStatus,
                      studioVerificationIsStale,
                    )}
                  >
                    {studioVerificationIsStale
                      ? "stale"
                      : (studio?.verificationStatus ?? "unknown")}
                  </Badge>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {studio?.message ?? "Studio connection status is unavailable."}
              </p>
            </div>

            <dl className="grid gap-3 text-sm">
              <DataField
                label="Bridge version"
                value={studio?.bridgeVersion ?? "unknown"}
              />
              <DataField
                label="Last sync"
                value={
                  studio?.lastSyncAt
                    ? new Date(studio.lastSyncAt).toLocaleString()
                    : "Never"
                }
              />
              <DataField
                label="Pending changes"
                value={String(studio?.pendingChanges ?? 0)}
              />
              <DataField
                label="Verified execution"
                value={studio?.verifiedExecutionId ?? "Not verified"}
              />
              <DataField
                label="Verified artifacts"
                value={
                  studio?.verifiedArtifactCount === undefined
                    ? "Not verified"
                    : String(studio.verifiedArtifactCount)
                }
              />
            </dl>

            <Card
              className={cn(
                "space-y-1 p-4 text-xs",
                studioVerificationCardClass(
                  studio?.verificationStatus,
                  studioVerificationIsStale,
                ),
              )}
            >
              <p className="font-medium text-foreground">
                {studioVerificationTitle(
                  studio?.verificationStatus,
                  studioVerificationIsStale,
                )}
              </p>
              <p className="text-muted-foreground">
                {studioVerificationIsStale
                  ? (readiness?.studioVerificationError ??
                    "Studio verification belongs to an earlier generation execution.")
                  : studio
                    ? describeWorkspaceStudioVerification(studio)
                    : "Studio verification status is unavailable."}
              </p>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={workspaceRefreshing}
                onClick={onRefresh}
              >
                Refresh status
              </Button>
              <Button
                disabled={busy === "studio" || !canSyncWorkspaceStudio(studio)}
                onClick={onSyncStudio}
              >
                Sync to Studio
              </Button>
            </div>
          </Card>
        </div>

        <ToolSection
          title="Version checkpoints"
          description="Persist and inspect named backend snapshots before Studio delivery or release promotion."
        >
          <WorkspaceModules project={project} stage="integrate" />
        </ToolSection>
      </StageSection>
    );
  }

  return (
    <StageSection
      id="operate-stage-title"
      title="Operate the project"
      description="Review durable generation history, runtime health and project settings."
    >
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]">
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
              onClick={onRefresh}
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
                      {new Date(record.startedAt).toLocaleString()} ·{" "}
                      {record.stagesCompleted}/{record.stagesTotal} stages
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
              onChange={(event) => onNameChange(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Input
              id="project-description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
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
              onClick={onSaveSettings}
            >
              Save
            </Button>
            <Button
              variant="outline"
              disabled={busy === "delete"}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={onRemoveProject}
            >
              Delete project
            </Button>
          </div>
        </Card>
      </div>

      <ToolSection
        title="Operations and diagnostics"
        description="Inspect system health, analytics, workers, queues, registry versions and execution traces."
      >
        <WorkspaceModules project={project} stage="operate" />
      </ToolSection>
    </StageSection>
  );
}

function studioConnectionBadgeClass(
  status?: WorkspaceStudioConnectionStatus,
): string {
  switch (status) {
    case "connected":
      return "border-success/40 text-success";
    case "syncing":
      return "border-warning/40 text-warning";
    case "error":
      return "border-destructive/40 text-destructive";
    default:
      return "border-border/60 text-muted-foreground";
  }
}

function studioVerificationBadgeClass(
  status?: WorkspaceStudioVerificationStatus,
  isStale = false,
): string {
  if (isStale) return "border-warning/40 text-warning";
  switch (status) {
    case "verified":
      return "border-success/40 text-success";
    case "failed":
      return "border-destructive/40 text-destructive";
    case "queued":
    case "delivered":
    case "acknowledged":
      return "border-warning/40 text-warning";
    default:
      return "border-border/60 text-muted-foreground";
  }
}

function studioVerificationCardClass(
  status?: WorkspaceStudioVerificationStatus,
  isStale = false,
): string {
  if (isStale) return "border-warning/30 bg-warning/5";
  switch (status) {
    case "verified":
      return "border-success/30 bg-success/5";
    case "failed":
      return "border-destructive/30 bg-destructive/5";
    case "queued":
    case "delivered":
    case "acknowledged":
      return "border-warning/30 bg-warning/5";
    default:
      return "border-border/60 bg-background/40";
  }
}

function studioVerificationTitle(
  status?: WorkspaceStudioVerificationStatus,
  isStale = false,
): string {
  if (isStale) return "Latest artifacts not verified";
  switch (status) {
    case "verified":
      return "Generated artifacts verified";
    case "failed":
      return "Artifact verification failed";
    case "queued":
    case "delivered":
    case "acknowledged":
      return "Artifact verification in progress";
    case "idle":
      return "Artifact verification not started";
    default:
      return "Artifact verification unavailable";
  }
}

function StageSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6" aria-labelledby={id}>
      <div>
        <h2
          id={id}
          className="font-display text-xl font-semibold tracking-tight"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ToolSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-medium">{value}</dd>
    </div>
  );
}
