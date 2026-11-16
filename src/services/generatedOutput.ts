/**
 * generatedOutput.ts
 *
 * Purpose: read-model for the Output Explorer. Turns the project-scoped
 * artifacts the backend already serves (`/studio/sync/project` and
 * `/studio/sync/artifacts`) into the Game Design, generated Lua files and
 * validation report the workspace shows.
 *
 * Dependencies: workspaceStudioSync types only. No network, no React.
 *
 * Contract: nothing here invents content. A missing or malformed artifact
 * yields an explicit issue, and a project is never reported as `ready`
 * unless a VALIDATION artifact is present and says it passed. Unknown input
 * degrades to *less* output, never to a clean-looking result.
 */
import type {
  ArtifactTransferResult,
  ProjectSnapshot,
} from "@/services/workspaceStudioSync";

type JsonRecord = Record<string, unknown>;

export const OUTPUT_STAGES = [
  "GAME_DESIGN",
  "LUA_GENERATION",
  "VALIDATION",
] as const;

export type GeneratedFileKind = "server" | "client" | "module" | "other";

export interface GeneratedFile {
  path: string;
  content: string;
  kind: GeneratedFileKind;
  lineCount: number;
  /** Header comment block is present (purpose/dependency documentation). */
  hasHeader: boolean;
}

export interface DesignSection {
  key: string;
  title: string;
  /** Plain text paragraphs. */
  text: string[];
  /** Named items such as mechanics: `name` plus optional description. */
  items: Array<{ name: string; description?: string }>;
}

export interface ValidationCheckView {
  id: string;
  title: string;
  status: "passed" | "failed" | "not-applicable";
  enforcement: "blocking" | "advisory";
  details: string[];
}

export interface ValidationView {
  passed: boolean;
  blockingFailures: number;
  advisoryFailures: number;
  checks: ValidationCheckView[];
  limits: string[];
}

export type GeneratedOutputStatus =
  "empty" | "incomplete" | "unvalidated" | "validation_failed" | "ready";

export interface GeneratedOutput {
  status: GeneratedOutputStatus;
  design: DesignSection[] | null;
  files: GeneratedFile[];
  validation: ValidationView | null;
  /** Problems reading the artifacts themselves, never silently dropped. */
  issues: string[];
}

const DESIGN_SECTIONS: ReadonlyArray<{
  key: string;
  title: string;
  read: (design: JsonRecord) => unknown;
}> = [
  { key: "overview", title: "Game Overview", read: (d) => d.overview },
  { key: "loop", title: "Core Gameplay Loop", read: (d) => d.loop },
  {
    key: "mechanics",
    title: "Main Mechanics",
    read: (d) => asRecord(d.gameplay)?.mechanics,
  },
  {
    key: "progression",
    title: "Player Progression",
    read: (d) => d.progressionModel ?? asRecord(d.gameplay)?.progression,
  },
  {
    key: "systems",
    title: "Game Systems",
    read: (d) => d.interactionSystems,
  },
  { key: "npcs", title: "NPCs", read: (d) => d.npcs },
  { key: "economy", title: "Economy", read: (d) => d.economyOrScoring },
  { key: "quests", title: "Quest System", read: (d) => d.quests },
  { key: "win", title: "Win Condition", read: (d) => d.winCondition },
  { key: "lose", title: "Lose Condition", read: (d) => d.loseCondition },
];

/** Artifact ids the Output Explorer needs from a project snapshot. */
export function selectOutputArtifactIds(snapshot: ProjectSnapshot): string[] {
  const wanted = new Set<string>(OUTPUT_STAGES);
  return snapshot.artifacts
    .filter((artifact) => wanted.has(artifact.stage))
    .map((artifact) => artifact.id);
}

export function emptyGeneratedOutput(): GeneratedOutput {
  return {
    status: "empty",
    design: null,
    files: [],
    validation: null,
    issues: [],
  };
}

export function buildGeneratedOutput(
  transfer: ArtifactTransferResult,
): GeneratedOutput {
  const issues: string[] = [];
  if (transfer.payloadExceeded) {
    issues.push("Generated artifact payload exceeded the transfer limit.");
  }
  if (transfer.missing.length > 0) {
    issues.push(
      `Backend did not return ${transfer.missing.length} requested artifact(s).`,
    );
  }

  const byStage = (stage: string) =>
    transfer.artifacts.filter((artifact) => artifact.stage === stage);

  const design = readDesign(byStage("GAME_DESIGN"), issues);
  const files = readFiles(byStage("LUA_GENERATION"), issues);
  const validation = readValidation(byStage("VALIDATION"), issues);

  if (!design && files.length === 0 && !validation) {
    return { ...emptyGeneratedOutput(), issues };
  }

  let status: GeneratedOutputStatus;
  if (validation && !validation.passed) {
    status = "validation_failed";
  } else if (!design || files.length === 0 || issues.length > 0) {
    status = "incomplete";
  } else if (!validation) {
    status = "unvalidated";
  } else {
    status = "ready";
  }
  return { status, design, files, validation, issues };
}

function readDesign(
  artifacts: ArtifactTransferResult["artifacts"],
  issues: string[],
): DesignSection[] | null {
  if (artifacts.length === 0) return null;
  if (artifacts.length > 1) {
    issues.push("More than one Game Design artifact was returned.");
    return null;
  }
  const design = asRecord(artifacts[0].content);
  if (!design) {
    issues.push("Game Design artifact is not an object.");
    return null;
  }
  const sections: DesignSection[] = [];
  for (const spec of DESIGN_SECTIONS) {
    const section = toSection(spec.key, spec.title, spec.read(design));
    if (section) sections.push(section);
  }
  if (sections.length === 0) {
    issues.push("Game Design artifact has no recognised sections.");
    return null;
  }
  return sections;
}

function toSection(
  key: string,
  title: string,
  value: unknown,
): DesignSection | null {
  const section: DesignSection = { key, title, text: [], items: [] };
  collect(value, section);
  return section.text.length || section.items.length ? section : null;
}

function collect(value: unknown, section: DesignSection): void {
  if (typeof value === "string") {
    if (value.trim()) section.text.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collect(entry, section);
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  const name = firstString(record.name, record.title, record.id);
  const description = firstString(record.description, record.role);
  if (name) {
    section.items.push({ name, ...(description ? { description } : {}) });
    return;
  }
  for (const [label, entry] of Object.entries(record)) {
    if (typeof entry === "string" && entry.trim()) {
      section.text.push(`${label}: ${entry.trim()}`);
    }
  }
}

function readFiles(
  artifacts: ArtifactTransferResult["artifacts"],
  issues: string[],
): GeneratedFile[] {
  if (artifacts.length === 0) return [];
  if (artifacts.length > 1) {
    issues.push("More than one Lua artifact was returned.");
    return [];
  }
  const content = asRecord(artifacts[0].content);
  if (!content || !Array.isArray(content.scripts)) {
    issues.push("Lua artifact does not contain a scripts list.");
    return [];
  }
  const seen = new Set<string>();
  const files: GeneratedFile[] = [];
  content.scripts.forEach((entry, index) => {
    const script = asRecord(entry);
    if (
      !script ||
      typeof script.path !== "string" ||
      script.path.length === 0 ||
      typeof script.content !== "string"
    ) {
      issues.push(`Lua script ${index + 1} is malformed and was skipped.`);
      return;
    }
    if (seen.has(script.path)) {
      issues.push(`Duplicate Lua script path ${script.path} was skipped.`);
      return;
    }
    seen.add(script.path);
    files.push({
      path: script.path,
      content: script.content,
      kind: classifyScriptPath(script.path),
      lineCount: script.content.split("\n").length,
      hasHeader: /^\s*--\[\[|^\s*--/.test(script.content),
    });
  });
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function classifyScriptPath(path: string): GeneratedFileKind {
  if (path.startsWith("ServerScriptService/")) return "server";
  if (path.startsWith("StarterPlayer") || path.startsWith("StarterGui/")) {
    return "client";
  }
  if (path.startsWith("ReplicatedStorage/")) return "module";
  return "other";
}

function readValidation(
  artifacts: ArtifactTransferResult["artifacts"],
  issues: string[],
): ValidationView | null {
  if (artifacts.length === 0) return null;
  if (artifacts.length > 1) {
    issues.push("More than one validation report was returned.");
    return null;
  }
  const report = asRecord(artifacts[0].content);
  // `passed` must be literally boolean: any other value is an unreadable
  // report, which must not be shown as a pass.
  if (!report || typeof report.passed !== "boolean") {
    issues.push("Validation report is unreadable.");
    return null;
  }
  const checks: ValidationCheckView[] = [];
  if (Array.isArray(report.checks)) {
    for (const entry of report.checks) {
      const check = asRecord(entry);
      if (
        !check ||
        typeof check.id !== "string" ||
        typeof check.title !== "string" ||
        !isOneOf(check.status, ["passed", "failed", "not-applicable"]) ||
        !isOneOf(check.enforcement, ["blocking", "advisory"])
      ) {
        issues.push("A validation check was malformed and was skipped.");
        continue;
      }
      checks.push({
        id: check.id,
        title: check.title,
        status: check.status,
        enforcement: check.enforcement,
        details: stringArray(check.details),
      });
    }
  }
  // A report that claims success while one of its own blocking checks failed
  // is contradictory; trust the failing check.
  const blockingFailed = checks.filter(
    (check) => check.status === "failed" && check.enforcement === "blocking",
  ).length;
  return {
    passed: report.passed && blockingFailed === 0,
    blockingFailures: Math.max(
      blockingFailed,
      typeof report.blockingFailures === "number" ? report.blockingFailures : 0,
    ),
    advisoryFailures:
      typeof report.advisoryFailures === "number" ? report.advisoryFailures : 0,
    checks,
    limits: stringArray(report.limits),
  };
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return (
    typeof value === "string" && (allowed as readonly string[]).includes(value)
  );
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}
