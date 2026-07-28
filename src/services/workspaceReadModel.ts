import {
  backendApi,
  BackendApiError,
  type ConversationSummary,
  type GenerationRecord,
  type RealtimeAgent,
} from "@/services/backendApi";
import {
  disconnectedWorkspaceStudioStatus,
  isWorkspaceStudioArtifactVerified,
  parseWorkspaceStudioStatus,
  type WorkspaceStudioStatus,
  type WorkspaceStudioVerificationStatus,
} from "@/services/workspaceStudioStatus";

type JsonRecord = Record<string, unknown>;

export interface WorkspacePipelineStep extends JsonRecord {
  agent: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
}

export interface WorkspaceExecution extends JsonRecord {
  id: string;
  blueprint_id: string;
  project_id: string;
  status: string;
  started_at: string;
  completed_at?: string;
  total_duration_ms?: number;
  error_message?: string;
  pipeline_steps: WorkspacePipelineStep[];
}

export interface WorkspaceBlueprint extends JsonRecord {
  id: string;
  project_id: string;
  name: string;
  description: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceManifest extends JsonRecord {
  format: string;
  version: string;
  exportedAt: string;
  project: JsonRecord;
  blueprint: WorkspaceBlueprint;
  executions: WorkspaceExecution[];
}

export interface WorkspaceReadiness {
  hasBlueprint: boolean;
  hasExecution: boolean;
  hasCompletedExecution: boolean;
  canValidate: boolean;
  studioConnected: boolean;
  studioArtifactVerified: boolean;
  studioVerificationStatus: WorkspaceStudioVerificationStatus;
  studioVerificationError?: string;
}

export interface WorkspaceReadModel {
  projectId: string;
  loadedAt: string;
  manifest?: WorkspaceManifest;
  history: GenerationRecord[];
  conversations: ConversationSummary[];
  studio: WorkspaceStudioStatus;
  agents: RealtimeAgent[];
  latestExecution?: WorkspaceExecution;
  readiness: WorkspaceReadiness;
  degradedSources: string[];
}

export async function loadWorkspaceReadModel(
  projectId: string,
): Promise<WorkspaceReadModel> {
  const degradedSources: string[] = [];

  const [manifest, history, conversations, studio, agents] = await Promise.all([
    loadManifest(projectId),
    loadOptional(
      "generation history",
      backendApi.projects.history(projectId),
      [],
      degradedSources,
    ),
    loadOptional(
      "conversation history",
      backendApi.workspace.chat.history(projectId),
      [],
      degradedSources,
    ),
    loadOptional(
      "Studio status",
      backendApi.workspace.studio
        .status(projectId)
        .then(parseWorkspaceStudioStatus),
      disconnectedWorkspaceStudioStatus(),
      degradedSources,
    ),
    loadOptional(
      "agent registry",
      backendApi.workspace.agents(),
      [],
      degradedSources,
    ),
  ]);

  const latestExecution = manifest
    ? [...manifest.executions].sort(
        (left, right) =>
          new Date(right.started_at).getTime() -
          new Date(left.started_at).getTime(),
      )[0]
    : undefined;
  const hasBlueprint = Boolean(manifest?.blueprint);
  const hasExecution = Boolean(latestExecution);
  const hasCompletedExecution = latestExecution?.status === "completed";

  return {
    projectId,
    loadedAt: new Date().toISOString(),
    manifest,
    history,
    conversations,
    studio,
    agents,
    latestExecution,
    readiness: {
      hasBlueprint,
      hasExecution,
      hasCompletedExecution,
      canValidate: hasBlueprint,
      studioConnected: studio.status !== "disconnected",
      studioArtifactVerified: isWorkspaceStudioArtifactVerified(studio),
      studioVerificationStatus: studio.verificationStatus,
      studioVerificationError: studio.verificationError,
    },
    degradedSources,
  };
}

async function loadManifest(
  projectId: string,
): Promise<WorkspaceManifest | undefined> {
  try {
    return parseManifest(await backendApi.projects.export(projectId));
  } catch (error) {
    if (
      error instanceof BackendApiError &&
      (error.status === 404 || error.status === 409)
    ) {
      return undefined;
    }
    throw error;
  }
}

async function loadOptional<T>(
  label: string,
  operation: Promise<T>,
  fallback: T,
  degradedSources: string[],
): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    degradedSources.push(
      `${label}: ${error instanceof Error ? error.message : "unavailable"}`,
    );
    return fallback;
  }
}

function parseManifest(value: unknown): WorkspaceManifest {
  const record = asRecord(value, "workspace manifest");
  const rawExecutions = Array.isArray(record.executions)
    ? record.executions
    : [];

  return {
    ...record,
    format: asString(record.format, "workspace manifest format"),
    version: asString(record.version, "workspace manifest version"),
    exportedAt: asDateString(record.exportedAt),
    project: asRecord(record.project, "workspace manifest project"),
    blueprint: parseBlueprint(record.blueprint),
    executions: rawExecutions.map(parseExecution),
  };
}

function parseBlueprint(value: unknown): WorkspaceBlueprint {
  const record = asRecord(value, "workspace blueprint");
  return {
    ...record,
    id: asString(record.id, "blueprint id"),
    project_id: asString(record.project_id, "blueprint project id"),
    name: asString(record.name, "blueprint name"),
    description:
      typeof record.description === "string" ? record.description : "",
    status: typeof record.status === "string" ? record.status : "draft",
    version: typeof record.version === "number" ? record.version : 1,
    created_at: asDateString(record.created_at),
    updated_at: asDateString(record.updated_at),
  };
}

function parseExecution(value: unknown): WorkspaceExecution {
  const record = asRecord(value, "workspace execution");
  const rawSteps = Array.isArray(record.pipeline_steps)
    ? record.pipeline_steps
    : [];
  return {
    ...record,
    id: asString(record.id, "execution id"),
    blueprint_id: asString(record.blueprint_id, "execution blueprint id"),
    project_id: asString(record.project_id, "execution project id"),
    status: typeof record.status === "string" ? record.status : "unknown",
    started_at: asDateString(record.started_at),
    completed_at: record.completed_at
      ? asDateString(record.completed_at)
      : undefined,
    total_duration_ms:
      typeof record.total_duration_ms === "number"
        ? record.total_duration_ms
        : undefined,
    error_message:
      typeof record.error_message === "string"
        ? record.error_message
        : undefined,
    pipeline_steps: rawSteps.map(parsePipelineStep),
  };
}

function parsePipelineStep(value: unknown): WorkspacePipelineStep {
  const record = asRecord(value, "pipeline step");
  return {
    ...record,
    agent: typeof record.agent === "string" ? record.agent : "unknown-agent",
    status: typeof record.status === "string" ? record.status : "unknown",
    started_at: record.started_at ? asDateString(record.started_at) : undefined,
    completed_at: record.completed_at
      ? asDateString(record.completed_at)
      : undefined,
    duration_ms:
      typeof record.duration_ms === "number" ? record.duration_ms : undefined,
  };
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value as JsonRecord;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function asDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") return value;
  return new Date(0).toISOString();
}
