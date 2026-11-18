import type { GameConceptConfig, MapEnvironmentConfig, Project } from "@/types";

/**
 * Form state, validation and patch building for the Game Concept and
 * Map & Environment windows. Limits mirror the backend contract
 * (server/src/types/projectDesignInputs.ts); the backend remains
 * the authority and its 400 errors are surfaced as-is.
 *
 * Genre, target audience and the core idea are NOT duplicated here: the Game
 * Concept window edits the existing project `genre`, `targetAudience` and
 * `description` fields.
 */

export const DESIGN_LIMITS = {
  description: 10000,
  vision: 2000,
  gameplayLoop: 1500,
  playerExperience: 1000,
  coreMechanics: { items: 20, length: 120 },
  designConstraints: { items: 20, length: 200 },
  worldTheme: 200,
  environmentType: 100,
  mapStructure: 1000,
  atmosphere: 1000,
  mainLocations: { items: 20, length: 120 },
  constraints: { items: 20, length: 200 },
} as const;

export type DesignSection = "gameConcept" | "mapEnvironment";

const TEXT_KEYS: Record<DesignSection, readonly string[]> = {
  gameConcept: ["vision", "gameplayLoop", "playerExperience"],
  mapEnvironment: [
    "worldTheme",
    "environmentType",
    "mapStructure",
    "atmosphere",
  ],
};
const LIST_KEYS: Record<DesignSection, readonly string[]> = {
  gameConcept: ["coreMechanics", "designConstraints"],
  mapEnvironment: ["mainLocations", "constraints"],
};

const hasOwn = (o: object, k: string) =>
  Object.prototype.hasOwnProperty.call(o, k);

/** Defensive read of a backend section; null/absent/non-object => undefined. */
export function readDesignSection(
  raw: unknown,
  section: "gameConcept",
): GameConceptConfig | undefined;
export function readDesignSection(
  raw: unknown,
  section: "mapEnvironment",
): MapEnvironmentConfig | undefined;
export function readDesignSection(
  raw: unknown,
  section: DesignSection,
): GameConceptConfig | MapEnvironmentConfig | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const input = raw as Record<string, unknown>;
  const out: Record<string, string | string[]> = {};
  for (const key of TEXT_KEYS[section]) {
    if (hasOwn(input, key) && typeof input[key] === "string") {
      out[key] = input[key] as string;
    }
  }
  for (const key of LIST_KEYS[section]) {
    const value = hasOwn(input, key) ? input[key] : undefined;
    if (Array.isArray(value)) {
      out[key] = value.filter(
        (item): item is string => typeof item === "string",
      );
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export const joinLines = (items: readonly string[] | undefined): string =>
  (items ?? []).join("\n");

// ── Game Concept ─────────────────────────────────────────────────────────

export interface GameConceptForm {
  description: string;
  genre: Project["genre"];
  targetAudience: string;
  vision: string;
  gameplayLoop: string;
  coreMechanics: string;
  playerExperience: string;
  designConstraints: string;
}

export function conceptFormFromProject(project: Project): GameConceptForm {
  const c = project.gameConcept ?? {};
  return {
    description: project.description,
    genre: project.genre,
    targetAudience: project.targetAudience,
    vision: c.vision ?? "",
    gameplayLoop: c.gameplayLoop ?? "",
    coreMechanics: joinLines(c.coreMechanics),
    playerExperience: c.playerExperience ?? "",
    designConstraints: joinLines(c.designConstraints),
  };
}

/**
 * Merge a refreshed project into an open form. `baseline` is the form derived
 * from the project at the previous sync. A field still equal to its baseline
 * is untouched by the user and adopts the refreshed value; a field the user
 * changed keeps the user's value, so neither a refresh nor a later save can
 * silently revert the other. Returns `current` itself when nothing changes.
 */
export function reconcileForm<T extends { [K in keyof T]: string }>(
  baseline: T,
  current: T,
  refreshed: T,
): T {
  let out: T | null = null;
  for (const key of Object.keys(current) as (keyof T)[]) {
    if (current[key] === baseline[key] && refreshed[key] !== current[key]) {
      out ??= { ...current };
      out[key] = refreshed[key];
    }
  }
  return out ?? current;
}

export type FormErrors<T> = Partial<Record<keyof T, string>>;

function checkText(
  errors: Record<string, string>,
  key: string,
  label: string,
  value: string,
  max: number,
) {
  if (value.trim().length > max) {
    errors[key] = `${label} must not exceed ${max} characters.`;
  }
}

function checkList(
  errors: Record<string, string>,
  key: string,
  label: string,
  value: string,
  limit: { items: number; length: number },
) {
  const lines = parseLines(value);
  if (lines.length > limit.items) {
    errors[key] = `${label}: at most ${limit.items} items.`;
  } else if (lines.some((line) => line.length > limit.length)) {
    errors[key] =
      `${label}: each item must be at most ${limit.length} characters.`;
  }
}

export function validateConceptForm(
  form: GameConceptForm,
): FormErrors<GameConceptForm> {
  const e: Record<string, string> = {};
  checkText(
    e,
    "description",
    "Core idea",
    form.description,
    DESIGN_LIMITS.description,
  );
  if (!form.targetAudience.trim())
    e.targetAudience = "Target audience is required.";
  else if (form.targetAudience.trim().length > 80) {
    e.targetAudience = "Target audience must not exceed 80 characters.";
  }
  checkText(e, "vision", "Vision", form.vision, DESIGN_LIMITS.vision);
  checkText(
    e,
    "gameplayLoop",
    "Gameplay loop",
    form.gameplayLoop,
    DESIGN_LIMITS.gameplayLoop,
  );
  checkText(
    e,
    "playerExperience",
    "Player experience",
    form.playerExperience,
    DESIGN_LIMITS.playerExperience,
  );
  checkList(
    e,
    "coreMechanics",
    "Core mechanics",
    form.coreMechanics,
    DESIGN_LIMITS.coreMechanics,
  );
  checkList(
    e,
    "designConstraints",
    "Design constraints",
    form.designConstraints,
    DESIGN_LIMITS.designConstraints,
  );
  return e as FormErrors<GameConceptForm>;
}

const sameList = (a: readonly string[] | undefined, b: readonly string[]) =>
  (a ?? []).length === b.length && (a ?? []).every((v, i) => v === b[i]);

/**
 * Build the PUT body. Only fields the user changed are sent, so saving never
 * rewrites untouched values (e.g. backend defaults shown as placeholders) and
 * never starts generation. Returns null when nothing changed.
 */
export function buildConceptPatch(
  project: Project,
  form: GameConceptForm,
): Partial<Project> | null {
  const patch: Partial<Project> = {};
  if (form.description.trim() !== project.description) {
    patch.description = form.description.trim();
  }
  if (form.genre !== project.genre) patch.genre = form.genre;
  if (form.targetAudience.trim() !== project.targetAudience) {
    patch.targetAudience = form.targetAudience.trim();
  }
  const current = project.gameConcept ?? {};
  const section: GameConceptConfig = {};
  const text = (k: "vision" | "gameplayLoop" | "playerExperience") => {
    if (form[k].trim() !== (current[k] ?? "")) section[k] = form[k].trim();
  };
  text("vision");
  text("gameplayLoop");
  text("playerExperience");
  const list = (k: "coreMechanics" | "designConstraints") => {
    const next = parseLines(form[k]);
    if (!sameList(current[k], next)) section[k] = next;
  };
  list("coreMechanics");
  list("designConstraints");
  if (Object.keys(section).length) patch.gameConcept = section;
  return Object.keys(patch).length ? patch : null;
}

// ── Map & Environment ────────────────────────────────────────────────────

export interface MapEnvironmentForm {
  worldTheme: string;
  environmentType: string;
  mapStructure: string;
  mainLocations: string;
  atmosphere: string;
  constraints: string;
}

export function mapFormFromProject(project: Project): MapEnvironmentForm {
  const m = project.mapEnvironment ?? {};
  return {
    worldTheme: m.worldTheme ?? "",
    environmentType: m.environmentType ?? "",
    mapStructure: m.mapStructure ?? "",
    mainLocations: joinLines(m.mainLocations),
    atmosphere: m.atmosphere ?? "",
    constraints: joinLines(m.constraints),
  };
}

export function validateMapForm(
  form: MapEnvironmentForm,
): FormErrors<MapEnvironmentForm> {
  const e: Record<string, string> = {};
  checkText(
    e,
    "worldTheme",
    "World theme",
    form.worldTheme,
    DESIGN_LIMITS.worldTheme,
  );
  checkText(
    e,
    "environmentType",
    "Environment type",
    form.environmentType,
    DESIGN_LIMITS.environmentType,
  );
  checkText(
    e,
    "mapStructure",
    "Map structure",
    form.mapStructure,
    DESIGN_LIMITS.mapStructure,
  );
  checkText(
    e,
    "atmosphere",
    "Atmosphere",
    form.atmosphere,
    DESIGN_LIMITS.atmosphere,
  );
  checkList(
    e,
    "mainLocations",
    "Main locations",
    form.mainLocations,
    DESIGN_LIMITS.mainLocations,
  );
  checkList(
    e,
    "constraints",
    "Constraints",
    form.constraints,
    DESIGN_LIMITS.constraints,
  );
  return e as FormErrors<MapEnvironmentForm>;
}

export function buildMapPatch(
  project: Project,
  form: MapEnvironmentForm,
): Partial<Project> | null {
  const current = project.mapEnvironment ?? {};
  const section: MapEnvironmentConfig = {};
  for (const k of [
    "worldTheme",
    "environmentType",
    "mapStructure",
    "atmosphere",
  ] as const) {
    if (form[k].trim() !== (current[k] ?? "")) section[k] = form[k].trim();
  }
  for (const k of ["mainLocations", "constraints"] as const) {
    const next = parseLines(form[k]);
    if (!sameList(current[k], next)) section[k] = next;
  }
  return Object.keys(section).length ? { mapEnvironment: section } : null;
}
