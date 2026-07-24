export const WORKSPACE_MODULE_STAGES = [
  "define",
  "generate",
  "validate",
  "integrate",
  "operate",
] as const;

export type WorkspaceModuleStage = (typeof WORKSPACE_MODULE_STAGES)[number];

export const WORKSPACE_MODULE_KEYS = [
  "system",
  "analytics",
  "knowledge",
  "simulation",
  "economy",
  "controller",
  "design",
  "planning",
  "build",
  "world",
  "quality",
  "memory",
  "operations",
  "versions",
] as const;

export type WorkspaceModuleKey = (typeof WORKSPACE_MODULE_KEYS)[number];

const STAGE_MODULES: Record<
  WorkspaceModuleStage,
  readonly WorkspaceModuleKey[]
> = {
  define: ["knowledge", "design", "memory"],
  generate: ["planning", "build"],
  validate: ["controller", "simulation", "economy", "world", "quality"],
  integrate: ["versions"],
  operate: ["system", "analytics", "operations"],
};

export interface WorkspaceDecisionContext {
  readiness: {
    hasBlueprint: boolean;
    hasExecution: boolean;
    hasCompletedExecution: boolean;
    canValidate: boolean;
    studioConnected: boolean;
    studioArtifactVerified: boolean;
  };
  degradedSources: string[];
  latestExecution?: {
    status: string;
    error_message?: string;
  };
}

export interface WorkspaceNextAction {
  stage: WorkspaceModuleStage;
  title: string;
  description: string;
}

export interface WorkspaceResultHighlight {
  label: string;
  value: string;
}

const PRIORITY_RESULT_KEYS = [
  "status",
  "success",
  "connected",
  "healthy",
  "qualityScore",
  "score",
  "progress",
  "count",
  "total",
  "durationMs",
  "version",
  "message",
  "warnings",
  "errors",
  "recommendations",
] as const;

export function getWorkspaceModuleKeys(
  stage?: WorkspaceModuleStage,
): readonly WorkspaceModuleKey[] {
  return stage ? STAGE_MODULES[stage] : WORKSPACE_MODULE_KEYS;
}

export function buildWorkspaceBlockers(
  workspace?: WorkspaceDecisionContext,
): string[] {
  if (!workspace) return ["Workspace data has not loaded yet."];

  const blockers: string[] = [];
  if (!workspace.readiness.hasBlueprint) {
    blockers.push("A durable blueprint has not been generated.");
  }
  if (
    workspace.readiness.hasExecution &&
    !workspace.readiness.hasCompletedExecution
  ) {
    blockers.push("The latest generation execution is not complete.");
  }
  if (!workspace.readiness.studioConnected) {
    blockers.push("Roblox Studio is not connected to this project.");
  }
  if (!workspace.readiness.studioArtifactVerified) {
    blockers.push(
      "Real generated-artifact delivery is pending STUDIO-1 verification.",
    );
  }
  if (workspace.latestExecution?.error_message) {
    blockers.push(workspace.latestExecution.error_message);
  }
  blockers.push(...workspace.degradedSources);
  return blockers.slice(0, 4);
}

export function getWorkspaceNextAction(
  workspace: WorkspaceDecisionContext | undefined,
  activeStage: WorkspaceModuleStage,
): WorkspaceNextAction {
  if (!workspace?.readiness.hasBlueprint) {
    return {
      stage: "define",
      title: "Complete the project definition",
      description: "Confirm the brief and generate the first durable blueprint.",
    };
  }
  if (!workspace.readiness.hasCompletedExecution) {
    return {
      stage: "generate",
      title: "Complete a generation run",
      description:
        "Start or inspect the execution until a completed package exists.",
    };
  }
  if (activeStage !== "validate" && workspace.readiness.canValidate) {
    return {
      stage: "validate",
      title: "Validate the generated experience",
      description:
        "Run governance, simulation, economy and quality checks.",
    };
  }
  if (!workspace.readiness.studioConnected) {
    return {
      stage: "integrate",
      title: "Connect Roblox Studio",
      description: "Review the package and establish the Studio bridge.",
    };
  }
  return {
    stage: "operate",
    title: "Review project operations",
    description:
      "Inspect durable history, system health and project settings.",
  };
}

export function describeWorkspaceRun(status: string): string {
  if (
    ["running", "starting", "generation_started", "pending_start"].includes(
      status,
    )
  ) {
    return "The generation pipeline is active.";
  }
  if (["completed", "ready", "exported"].includes(status)) {
    return "The latest known run completed successfully.";
  }
  if (["failed", "error"].includes(status)) {
    return "The latest known run needs attention.";
  }
  return "No active generation run is reported.";
}

export function summarizeWorkspaceResult(
  data: unknown,
): WorkspaceResultHighlight[] {
  if (Array.isArray(data)) {
    return [
      { label: "Items", value: String(data.length) },
      ...summarizeArraySample(data),
    ];
  }

  if (!isRecord(data)) {
    return [{ label: "Result", value: formatWorkspaceResultValue(data) }];
  }

  const selected: WorkspaceResultHighlight[] = [];
  const used = new Set<string>();

  for (const key of PRIORITY_RESULT_KEYS) {
    if (!(key in data)) continue;
    selected.push({
      label: humanizeWorkspaceKey(key),
      value: formatWorkspaceResultValue(data[key]),
    });
    used.add(key);
    if (selected.length >= 6) return selected;
  }

  for (const [key, value] of Object.entries(data)) {
    if (used.has(key)) continue;
    selected.push({
      label: humanizeWorkspaceKey(key),
      value: formatWorkspaceResultValue(value),
    });
    if (selected.length >= 6) break;
  }

  return selected.length
    ? selected
    : [{ label: "Result", value: "Operation completed" }];
}

function summarizeArraySample(data: unknown[]): WorkspaceResultHighlight[] {
  const first = data[0];
  if (!isRecord(first)) return [];

  const identifier = first.name ?? first.title ?? first.id ?? first.status;
  return identifier === undefined
    ? []
    : [
        {
          label: "First item",
          value: formatWorkspaceResultValue(identifier),
        },
      ];
}

function formatWorkspaceResultValue(value: unknown): string {
  if (value === null || value === undefined) return "Not reported";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "—";
  }
  if (typeof value === "string") return value || "Empty";
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (isRecord(value)) {
    const status = value.status ?? value.message ?? value.name ?? value.id;
    if (status !== undefined) return formatWorkspaceResultValue(status);
    return `${Object.keys(value).length} fields`;
  }
  return String(value);
}

function humanizeWorkspaceKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
