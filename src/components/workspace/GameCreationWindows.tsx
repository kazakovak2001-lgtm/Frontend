import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GENRES, TARGET_AUDIENCES } from "@/constants";
import {
  buildConceptPatch,
  buildMapPatch,
  conceptFormFromProject,
  mapFormFromProject,
  reconcileForm,
  validateConceptForm,
  validateMapForm,
  type FormErrors,
  type GameConceptForm,
  type MapEnvironmentForm,
} from "@/services/projectDesignForm";
import type { GameGenre, Project } from "@/types";
import {
  GAME_CREATION_WINDOWS,
  type GameCreationWindow,
} from "@/components/workspace/gameCreationWindow";

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string };

/**
 * Two separate input windows over the existing project record. Both stay
 * mounted so unsaved input survives switching windows; saving only persists
 * the configuration (PUT /projects/:id) and never starts generation.
 */
export function GameCreationWindows({
  project,
  activeWindow,
  onWindowChange,
  onSave,
}: {
  project: Project;
  activeWindow: GameCreationWindow;
  onWindowChange: (next: GameCreationWindow) => void;
  onSave: (patch: Partial<Project>) => Promise<void>;
}) {
  return (
    <Card className="border-border/60 bg-card/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Game creation inputs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved with the project and passed to generation. Saving does not
            start a new generation.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Game creation windows"
          className="flex gap-2"
        >
          {GAME_CREATION_WINDOWS.map((item) => (
            <Button
              key={item.id}
              type="button"
              role="tab"
              id={`game-creation-tab-${item.id}`}
              aria-selected={activeWindow === item.id}
              aria-controls={`game-creation-panel-${item.id}`}
              variant={activeWindow === item.id ? "default" : "outline"}
              size="sm"
              onClick={() => onWindowChange(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id="game-creation-panel-concept"
        aria-labelledby="game-creation-tab-concept"
        hidden={activeWindow !== "concept"}
        className="mt-5"
      >
        <GameConceptWindow project={project} onSave={onSave} />
      </div>
      <div
        role="tabpanel"
        id="game-creation-panel-map"
        aria-labelledby="game-creation-tab-map"
        hidden={activeWindow !== "map"}
        className="mt-5"
      >
        <MapEnvironmentWindow project={project} onSave={onSave} />
      </div>
    </Card>
  );
}

/**
 * Form state that follows the project without losing input. The baseline is
 * the form derived from the project at the last sync, kept apart from the
 * latest project: when the project refreshes (e.g. generation finished) only
 * fields the user has not touched adopt the new values, and user-edited
 * fields are kept. Opening a different project replaces the form entirely.
 */
function useProjectForm<T extends { [K in keyof T]: string }>(
  project: Project,
  fromProject: (project: Project) => T,
): [T, (update: (current: T) => T) => void] {
  const [form, setForm] = useState<T>(() => fromProject(project));
  const baseline = useRef<T>(form);
  const projectId = useRef(project.id);

  useEffect(() => {
    const refreshed = fromProject(project);
    const previous = baseline.current;
    baseline.current = refreshed;
    if (projectId.current !== project.id) {
      projectId.current = project.id;
      setForm(refreshed);
      return;
    }
    setForm((current) => reconcileForm(previous, current, refreshed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  return [form, setForm];
}

function useSaveFlow(
  onSave: (patch: Partial<Project>) => Promise<void>,
): [SaveState, (patch: Partial<Project>) => Promise<void>, () => void] {
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const save = async (patch: Partial<Project>) => {
    setState({ status: "saving" });
    try {
      await onSave(patch);
      setState({ status: "saved" });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Save failed",
      });
    }
  };
  return [state, save, () => setState({ status: "idle" })];
}

export function GameConceptWindow({
  project,
  onSave,
}: {
  project: Project;
  onSave: (patch: Partial<Project>) => Promise<void>;
}) {
  const [form, setForm] = useProjectForm(project, conceptFormFromProject);
  const [errors, setErrors] = useState<FormErrors<GameConceptForm>>({});
  const [state, save, resetState] = useSaveFlow(onSave);

  // Errors and save state reset only when a different project is opened; form
  // values follow refreshes through useProjectForm without discarding input.
  useEffect(() => {
    setErrors({});
    resetState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const set = <K extends keyof GameConceptForm>(
    key: K,
    value: GameConceptForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (state.status !== "saving") resetState();
  };

  const submit = async () => {
    const found = validateConceptForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    const patch = buildConceptPatch(project, form);
    if (!patch) return;
    await save(patch);
  };

  const dirty = buildConceptPatch(project, form) !== null;

  return (
    <WindowForm
      title="Game Concept"
      state={state}
      dirty={dirty}
      onSubmit={() => void submit()}
    >
      <Field
        id="gc-description"
        label="Core game idea"
        error={errors.description}
      >
        <Textarea
          id="gc-description"
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <Field id="gc-vision" label="Vision" error={errors.vision}>
        <Textarea
          id="gc-vision"
          rows={3}
          value={form.vision}
          onChange={(e) => set("vision", e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="gc-genre" label="Genre">
          <Select
            value={form.genre}
            onValueChange={(value) => set("genre", value as GameGenre)}
          >
            <SelectTrigger id="gc-genre">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GENRES.map((genre) => (
                <SelectItem key={genre} value={genre}>
                  {genre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          id="gc-audience"
          label="Target audience"
          error={errors.targetAudience}
        >
          <Input
            id="gc-audience"
            list="gc-audience-options"
            value={form.targetAudience}
            onChange={(e) => set("targetAudience", e.target.value)}
          />
          <datalist id="gc-audience-options">
            {TARGET_AUDIENCES.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field
        id="gc-loop"
        label="Main gameplay loop"
        error={errors.gameplayLoop}
      >
        <Textarea
          id="gc-loop"
          rows={3}
          value={form.gameplayLoop}
          onChange={(e) => set("gameplayLoop", e.target.value)}
        />
      </Field>
      <Field
        id="gc-mechanics"
        label="Core mechanics (one per line)"
        error={errors.coreMechanics}
      >
        <Textarea
          id="gc-mechanics"
          rows={4}
          value={form.coreMechanics}
          onChange={(e) => set("coreMechanics", e.target.value)}
        />
      </Field>
      <Field
        id="gc-experience"
        label="Intended player experience"
        error={errors.playerExperience}
      >
        <Textarea
          id="gc-experience"
          rows={3}
          value={form.playerExperience}
          onChange={(e) => set("playerExperience", e.target.value)}
        />
      </Field>
      <Field
        id="gc-constraints"
        label="Important design constraints (one per line)"
        error={errors.designConstraints}
      >
        <Textarea
          id="gc-constraints"
          rows={3}
          value={form.designConstraints}
          onChange={(e) => set("designConstraints", e.target.value)}
        />
      </Field>
    </WindowForm>
  );
}

export function MapEnvironmentWindow({
  project,
  onSave,
}: {
  project: Project;
  onSave: (patch: Partial<Project>) => Promise<void>;
}) {
  const [form, setForm] = useProjectForm(project, mapFormFromProject);
  const [errors, setErrors] = useState<FormErrors<MapEnvironmentForm>>({});
  const [state, save, resetState] = useSaveFlow(onSave);

  useEffect(() => {
    setErrors({});
    resetState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const set = <K extends keyof MapEnvironmentForm>(
    key: K,
    value: MapEnvironmentForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (state.status !== "saving") resetState();
  };

  const submit = async () => {
    const found = validateMapForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    const patch = buildMapPatch(project, form);
    if (!patch) return;
    await save(patch);
  };

  const dirty = buildMapPatch(project, form) !== null;

  return (
    <WindowForm
      title="Map & Environment"
      state={state}
      dirty={dirty}
      onSubmit={() => void submit()}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="me-theme" label="World theme" error={errors.worldTheme}>
          <Input
            id="me-theme"
            value={form.worldTheme}
            onChange={(e) => set("worldTheme", e.target.value)}
          />
        </Field>
        <Field
          id="me-type"
          label="Environment type"
          error={errors.environmentType}
        >
          <Input
            id="me-type"
            value={form.environmentType}
            onChange={(e) => set("environmentType", e.target.value)}
          />
        </Field>
      </div>
      <Field
        id="me-structure"
        label="Map structure"
        error={errors.mapStructure}
      >
        <Textarea
          id="me-structure"
          rows={3}
          value={form.mapStructure}
          onChange={(e) => set("mapStructure", e.target.value)}
        />
      </Field>
      <Field
        id="me-locations"
        label="Main locations (one per line)"
        error={errors.mainLocations}
      >
        <Textarea
          id="me-locations"
          rows={4}
          value={form.mainLocations}
          onChange={(e) => set("mainLocations", e.target.value)}
        />
      </Field>
      <Field
        id="me-atmosphere"
        label="Atmosphere and visual direction"
        error={errors.atmosphere}
      >
        <Textarea
          id="me-atmosphere"
          rows={3}
          value={form.atmosphere}
          onChange={(e) => set("atmosphere", e.target.value)}
        />
      </Field>
      <Field
        id="me-constraints"
        label="Gameplay and environmental constraints (one per line)"
        error={errors.constraints}
      >
        <Textarea
          id="me-constraints"
          rows={3}
          value={form.constraints}
          onChange={(e) => set("constraints", e.target.value)}
        />
      </Field>
    </WindowForm>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function WindowForm({
  title,
  state,
  dirty,
  onSubmit,
  children,
}: {
  title: string;
  state: SaveState;
  dirty: boolean;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <form
      aria-label={title}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={state.status === "saving" || !dirty}>
          {state.status === "saving" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save {title}
        </Button>
        <span role="status" aria-live="polite" className="text-sm">
          {state.status === "saved" && !dirty && "Saved."}
          {state.status === "error" && (
            <span className="text-destructive">
              Save failed: {state.message}. Your input is kept.
            </span>
          )}
        </span>
      </div>
    </form>
  );
}
