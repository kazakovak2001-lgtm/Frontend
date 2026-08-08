import type {
  ArtifactTransferResult,
  ProjectSnapshot,
} from "@/services/workspaceStudioSync";

export interface ProjectQualityInput {
  projectId: string;
  scripts: Array<{
    name: string;
    type: "ServerScript" | "LocalScript" | "ModuleScript";
    path: string;
    content: string;
    dependencies: string[];
  }>;
  assets: Array<{
    name: string;
    type: string;
    targetService: string;
    placeholder: boolean;
  }>;
  dependencyGraph: {
    nodes: string[];
    edges: Array<{ from: string; to: string }>;
    circular: string[][];
  };
}

const QUALITY_STAGES = new Set(["LUA_GENERATION", "ASSET_PLANNING"]);

export function selectQualityArtifactIds(snapshot: ProjectSnapshot): string[] {
  const selected = snapshot.artifacts.filter((artifact) =>
    QUALITY_STAGES.has(artifact.stage),
  );
  if (!selected.some((artifact) => artifact.stage === "LUA_GENERATION")) {
    throw new Error(
      "Generated Lua artifacts are unavailable. Complete generation before running playtest or repair.",
    );
  }
  return selected.map((artifact) => artifact.id);
}

export function buildProjectQualityInput(
  projectId: string,
  transfer: ArtifactTransferResult,
): ProjectQualityInput {
  if (transfer.payloadExceeded) {
    throw new Error(
      "Generated artifact payload exceeds the quality tool limit.",
    );
  }
  if (transfer.missing.length > 0) {
    throw new Error(
      `Generated artifacts are incomplete: ${transfer.missing.join(", ")}`,
    );
  }

  const luaArtifacts = transfer.artifacts.filter(
    (artifact) => artifact.stage === "LUA_GENERATION",
  );
  if (luaArtifacts.length !== 1) {
    throw new Error(
      "Expected exactly one Lua artifact for the latest generation execution.",
    );
  }

  const scripts = parseLuaScripts(luaArtifacts[0].content);
  const assetArtifact = transfer.artifacts.find(
    (artifact) => artifact.stage === "ASSET_PLANNING",
  );
  const assets = assetArtifact ? parseAssetPlan(assetArtifact.content) : [];

  return {
    projectId,
    scripts,
    assets,
    dependencyGraph: {
      nodes: scripts.map((script) => script.path),
      edges: [],
      circular: [],
    },
  };
}

function parseLuaScripts(value: unknown): ProjectQualityInput["scripts"] {
  const record = asRecord(value, "Lua artifact content");
  if (!Array.isArray(record.scripts) || record.scripts.length === 0) {
    throw new Error("Generated Lua artifact does not contain scripts.");
  }

  const paths = new Set<string>();
  return record.scripts.map((value, index) => {
    const script = asRecord(value, `Lua script ${index + 1}`);
    const path = asString(script.path, `Lua script ${index + 1} path`);
    const content = asString(script.content, `Lua script ${index + 1} content`);
    if (paths.has(path)) {
      throw new Error(`Duplicate generated Lua script path: ${path}`);
    }
    paths.add(path);
    return {
      name: scriptName(path),
      type: scriptType(path),
      path,
      content,
      dependencies: [],
    };
  });
}

function parseAssetPlan(value: unknown): ProjectQualityInput["assets"] {
  const content = asRecord(value, "asset planning artifact");
  const planValue = content.assetPlan;
  if (planValue === undefined) return [];
  const plan = asRecord(planValue, "asset plan");
  const groups = [
    ["models", "model", "Workspace"],
    ["textures", "texture", "ReplicatedStorage"],
    ["sounds", "sound", "SoundService"],
    ["animations", "animation", "ReplicatedStorage"],
  ] as const;

  return groups.flatMap(([key, type, targetService]) => {
    const entries = plan[key];
    if (entries === undefined) return [];
    if (!Array.isArray(entries)) {
      throw new Error(`Invalid asset plan ${key}`);
    }
    return entries.map((value, index) => {
      const asset = asRecord(value, `${key} asset ${index + 1}`);
      return {
        name: asString(
          asset.name ?? asset.id,
          `${key} asset ${index + 1} name`,
        ),
        type,
        targetService,
        // The artifact is a plan, not evidence that a binary asset was generated.
        placeholder: true,
      };
    });
  });
}

function scriptType(
  path: string,
): "ServerScript" | "LocalScript" | "ModuleScript" {
  if (path.startsWith("ServerScriptService/")) return "ServerScript";
  if (
    path.startsWith("StarterPlayerScripts/") ||
    path.startsWith("StarterGui/")
  ) {
    return "LocalScript";
  }
  return "ModuleScript";
}

function scriptName(path: string): string {
  const filename = path.split("/").at(-1) ?? path;
  return filename
    .replace(/\.(?:server|client)\.lua$/i, "")
    .replace(/\.lua$/i, "");
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}
