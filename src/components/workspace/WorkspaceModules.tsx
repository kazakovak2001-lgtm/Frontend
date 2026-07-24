import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Blocks,
  BrainCircuit,
  Coins,
  Database,
  FlaskConical,
  Gamepad2,
  GitBranch,
  Globe2,
  Hammer,
  History,
  Network,
  RefreshCw,
  ScanSearch,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { backendApi } from "@/services/backendApi";
import type { Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ModuleResultStatus,
  WorkspaceModuleResult,
} from "@/components/workspace/WorkspaceModuleResult";
import { toast } from "sonner";

export type WorkspaceModuleStage =
  | "define"
  | "generate"
  | "validate"
  | "integrate"
  | "operate";

type ModuleKey =
  | "system"
  | "analytics"
  | "knowledge"
  | "simulation"
  | "economy"
  | "controller"
  | "design"
  | "planning"
  | "build"
  | "world"
  | "quality"
  | "memory"
  | "operations"
  | "versions";

type ModuleState = {
  loading: boolean;
  data?: unknown;
  error?: string;
};

const STAGE_MODULES: Record<WorkspaceModuleStage, readonly ModuleKey[]> = {
  define: ["knowledge", "design", "memory"],
  generate: ["planning", "build"],
  validate: ["controller", "simulation", "economy", "world", "quality"],
  integrate: ["versions"],
  operate: ["system", "analytics", "operations"],
};

const EMPTY_STATE: Record<ModuleKey, ModuleState> = {
  system: { loading: false },
  analytics: { loading: false },
  knowledge: { loading: false },
  simulation: { loading: false },
  economy: { loading: false },
  controller: { loading: false },
  design: { loading: false },
  planning: { loading: false },
  build: { loading: false },
  world: { loading: false },
  quality: { loading: false },
  memory: { loading: false },
  operations: { loading: false },
  versions: { loading: false },
};

export function WorkspaceModules({
  project,
  stage,
}: {
  project: Project;
  stage: WorkspaceModuleStage;
}) {
  const [states, setStates] = useState(EMPTY_STATE);
  const visibleModules = useMemo(() => new Set(STAGE_MODULES[stage]), [stage]);
  const visible = (key: ModuleKey) => visibleModules.has(key);

  const run = async (
    key: ModuleKey,
    operation: () => Promise<unknown>,
    success?: string,
  ) => {
    setStates((current) => ({
      ...current,
      [key]: { ...current[key], loading: true, error: undefined },
    }));
    try {
      const data = await operation();
      setStates((current) => ({
        ...current,
        [key]: { loading: false, data },
      }));
      if (success) toast.success(success);
      return data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Backend operation failed";
      setStates((current) => ({
        ...current,
        [key]: { loading: false, error: message },
      }));
      toast.error(message);
      return undefined;
    }
  };

  useEffect(() => {
    if (!visibleModules.has("system")) return;
    void run("system", async () => {
      const [status, agents] = await Promise.all([
        backendApi.workspace.systemStatus(),
        backendApi.workspace.agents(),
      ]);
      return { status, agents };
    });
  }, [visibleModules]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {visible("system") && (
        <ModuleCard
          icon={<Activity className="h-5 w-5" />}
          title="System & Agents"
          description="Live backend health and registered orchestration agents."
          state={states.system}
          actions={
            <Button
              size="sm"
              variant="outline"
              disabled={states.system.loading}
              onClick={() =>
                void run("system", async () => {
                  const [status, agents] = await Promise.all([
                    backendApi.workspace.systemStatus(),
                    backendApi.workspace.agents(),
                  ]);
                  return { status, agents };
                })
              }
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
            </Button>
          }
        />
      )}

      {visible("analytics") && (
        <ModuleCard
          icon={<BarChart3 className="h-5 w-5" />}
          title="Analytics"
          description="System health, agent metrics and optimization suggestions."
          state={states.analytics}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={states.analytics.loading}
                onClick={() =>
                  void run("analytics", async () => {
                    const [system, agents, suggestions] = await Promise.all([
                      backendApi.workspace.analytics.system(),
                      backendApi.workspace.analytics.agents(),
                      backendApi.workspace.analytics.suggestions(),
                    ]);
                    return { system, agents, suggestions };
                  })
                }
              >
                Load
              </Button>
              <Button
                size="sm"
                disabled={states.analytics.loading}
                onClick={() =>
                  void run(
                    "analytics",
                    backendApi.workspace.analytics.cycle,
                    "Analytics cycle completed.",
                  )
                }
              >
                Run cycle
              </Button>
            </>
          }
        />
      )}

      {visible("knowledge") && (
        <ModuleCard
          icon={<BrainCircuit className="h-5 w-5" />}
          title="Knowledge"
          description="Reusable patterns and recommendations for this game genre."
          state={states.knowledge}
          actions={
            <Button
              size="sm"
              disabled={states.knowledge.loading}
              onClick={() =>
                void run("knowledge", async () => {
                  const [search, recommendations] = await Promise.all([
                    backendApi.workspace.knowledge.search(project.genre, [
                      project.gameType,
                    ]),
                    backendApi.workspace.knowledge.recommendations(
                      project.genre,
                      [project.gameType],
                    ),
                  ]);
                  return { search, recommendations };
                })
              }
            >
              <ScanSearch className="mr-1 h-3.5 w-3.5" /> Search knowledge
            </Button>
          }
        />
      )}

      {visible("simulation") && (
        <ModuleCard
          icon={<Gamepad2 className="h-5 w-5" />}
          title="Simulation"
          description="Runs the real playtest and feedback pipeline."
          state={states.simulation}
          actions={
            <Button
              size="sm"
              disabled={states.simulation.loading}
              onClick={() =>
                void run(
                  "simulation",
                  () => backendApi.workspace.simulation(project),
                  "Simulation completed.",
                )
              }
            >
              Run simulation
            </Button>
          }
        />
      )}

      {visible("economy") && (
        <ModuleCard
          icon={<Coins className="h-5 w-5" />}
          title="Economy"
          description="Models currency flow, detects imbalance and suggests patches."
          state={states.economy}
          actions={
            <Button
              size="sm"
              disabled={states.economy.loading}
              onClick={() =>
                void run(
                  "economy",
                  () => backendApi.workspace.economy(project),
                  "Economy analysis completed.",
                )
              }
            >
              Analyze economy
            </Button>
          }
        />
      )}

      {visible("controller") && (
        <ModuleCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="AI Project Controller"
          description="Architecture, duplication and pre-implementation governance."
          state={states.controller}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={states.controller.loading}
                onClick={() =>
                  void run("controller", async () => {
                    const [health, preCheck] = await Promise.all([
                      backendApi.workspace.controller.health(),
                      backendApi.workspace.controller.preCheck(project),
                    ]);
                    return { health, preCheck };
                  })
                }
              >
                Pre-check
              </Button>
              <Button
                size="sm"
                disabled={states.controller.loading}
                onClick={() =>
                  void run("controller", async () => {
                    const [architecture, duplicates] = await Promise.all([
                      backendApi.workspace.controller.architectureScan(),
                      backendApi.workspace.controller.duplicateCheck(project),
                    ]);
                    return { architecture, duplicates };
                  })
                }
              >
                Validate
              </Button>
            </>
          }
          wide
        />
      )}

      {visible("design") && (
        <ModuleCard
          icon={<Blocks className="h-5 w-5" />}
          title="Concept, Architect & Domain"
          description="Turns project inputs into a concept, production design and genre benchmark."
          state={states.design}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={states.design.loading}
                onClick={() =>
                  void run("design", () => backendApi.workspace.concept(project))
                }
              >
                Generate concept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={states.design.loading}
                onClick={() =>
                  void run("design", () =>
                    backendApi.workspace.architect(project),
                  )
                }
              >
                Create design
              </Button>
              <Button
                size="sm"
                disabled={states.design.loading}
                onClick={() =>
                  void run("design", () => backendApi.workspace.domain(project))
                }
              >
                Benchmark domain
              </Button>
            </>
          }
        />
      )}

      {visible("planning") && (
        <ModuleCard
          icon={<GitBranch className="h-5 w-5" />}
          title="Planning & Autonomous Generation"
          description="Creates and executes the agent DAG or starts an autonomous project session."
          state={states.planning}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={states.planning.loading}
                onClick={() =>
                  void run("planning", () =>
                    backendApi.workspace.planning.createAndExecute(project),
                  )
                }
              >
                Plan & execute
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={states.planning.loading}
                onClick={() =>
                  void run("planning", () =>
                    backendApi.workspace.planning.dag(project),
                  )
                }
              >
                Inspect DAG
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={states.planning.loading}
                onClick={() =>
                  void run("planning", () =>
                    backendApi.workspace.generationCore(project),
                  )
                }
              >
                Generation core
              </Button>
              <Button
                size="sm"
                disabled={states.planning.loading}
                onClick={() =>
                  void run(
                    "planning",
                    () => backendApi.workspace.autonomous(project),
                    "Autonomous session started.",
                  )
                }
              >
                Start autonomous
              </Button>
            </>
          }
          wide
        />
      )}

      {visible("build") && (
        <ModuleCard
          icon={<Hammer className="h-5 w-5" />}
          title="Compile, Lua & Assets"
          description="Runs the stable compile contract or assembles the project Lua and asset package."
          state={states.build}
          actions={
            <>
              <Button
                size="sm"
                disabled={states.build.loading}
                onClick={() =>
                  void run(
                    "build",
                    () => backendApi.workspace.compile(project),
                    "Stable compile completed.",
                  )
                }
              >
                Compile project
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={states.build.loading}
                onClick={() =>
                  void run(
                    "build",
                    () => backendApi.workspace.lua(project),
                    "Lua package assembled.",
                  )
                }
              >
                Assemble Lua
              </Button>
            </>
          }
        />
      )}

      {visible("world") && (
        <ModuleCard
          icon={<Globe2 className="h-5 w-5" />}
          title="World & Lifecycle"
          description="Simulates NPC/world behavior and applies a lifecycle health cycle."
          state={states.world}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={states.world.loading}
                onClick={() =>
                  void run(
                    "world",
                    () => backendApi.workspace.world(project),
                    "World simulation completed.",
                  )
                }
              >
                Simulate world
              </Button>
              <Button
                size="sm"
                disabled={states.world.loading}
                onClick={() =>
                  void run(
                    "world",
                    () => backendApi.workspace.lifecycle(project),
                    "Lifecycle cycle completed.",
                  )
                }
              >
                Run lifecycle
              </Button>
            </>
          }
        />
      )}

      {visible("quality") && (
        <ModuleCard
          icon={<FlaskConical className="h-5 w-5" />}
          title="Playtest, Repair & Evaluation"
          description="Validates generated structures, proposes repairs and runs agent regression evaluation."
          state={states.quality}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={states.quality.loading}
                onClick={() =>
                  void run("quality", () =>
                    backendApi.workspace.playtest(project),
                  )
                }
              >
                Run playtest
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={states.quality.loading}
                onClick={() =>
                  void run("quality", () => backendApi.workspace.repair(project))
                }
              >
                Run repair
              </Button>
              <Button
                size="sm"
                disabled={states.quality.loading}
                onClick={() =>
                  void run("quality", backendApi.workspace.evaluation)
                }
              >
                Evaluate agents
              </Button>
            </>
          }
        />
      )}

      {visible("memory") && (
        <ModuleCard
          icon={<Database className="h-5 w-5" />}
          title="Memory & Agent Collaboration"
          description="Stores project context in agent memory and runs a multi-agent review session."
          state={states.memory}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={states.memory.loading}
                onClick={() =>
                  void run("memory", () => backendApi.workspace.memory(project))
                }
              >
                Store & search memory
              </Button>
              <Button
                size="sm"
                disabled={states.memory.loading}
                onClick={() =>
                  void run("memory", () =>
                    backendApi.workspace.collaboration(project),
                  )
                }
              >
                Run collaboration
              </Button>
            </>
          }
        />
      )}

      {visible("operations") && (
        <ModuleCard
          icon={<ServerCog className="h-5 w-5" />}
          title="Distributed Runtime & Diagnostics"
          description="Inspects workers, queues, API versions and execution traces."
          state={states.operations}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={states.operations.loading}
                onClick={() =>
                  void run("operations", backendApi.workspace.distributed.status)
                }
              >
                <Network className="mr-1 h-3.5 w-3.5" /> Runtime status
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={states.operations.loading}
                onClick={() =>
                  void run("operations", () =>
                    backendApi.workspace.distributed.submit(project),
                  )
                }
              >
                Submit job
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={states.operations.loading}
                onClick={() =>
                  void run("operations", backendApi.workspace.diagnostics)
                }
              >
                Execution traces
              </Button>
              <Button
                size="sm"
                disabled={states.operations.loading}
                onClick={() =>
                  void run("operations", backendApi.workspace.registry)
                }
              >
                Registry & API
              </Button>
            </>
          }
          wide
        />
      )}

      {visible("versions") && (
        <ModuleCard
          icon={<History className="h-5 w-5" />}
          title="Project Versioning"
          description="Persists and reloads named backend snapshots of this project."
          state={states.versions}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={states.versions.loading}
                onClick={() =>
                  void run("versions", () =>
                    backendApi.workspace.versions.list(project.id),
                  )
                }
              >
                Load versions
              </Button>
              <Button
                size="sm"
                disabled={states.versions.loading}
                onClick={() =>
                  void run(
                    "versions",
                    () => backendApi.workspace.versions.save(project),
                    "Project snapshot saved.",
                  )
                }
              >
                Save snapshot
              </Button>
            </>
          }
          wide
        />
      )}
    </div>
  );
}

function ModuleCard({
  icon,
  title,
  description,
  state,
  actions,
  wide = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  state: ModuleState;
  actions: ReactNode;
  wide?: boolean;
}) {
  return (
    <Card
      className={`space-y-4 border-border/60 bg-card/50 p-5 ${wide ? "lg:col-span-2" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <ModuleResultStatus
          loading={state.loading}
          error={state.error}
          hasData={state.data !== undefined}
        />
      </div>
      {state.error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state.data !== undefined && <WorkspaceModuleResult data={state.data} />}
      <div className="flex flex-wrap gap-2">{actions}</div>
    </Card>
  );
}
