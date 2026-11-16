/**
 * GeneratedOutputPanel.tsx
 *
 * Purpose: Output Explorer for the Generate stage. Shows the Game Design, the
 * generated Lua files with their content, and the deterministic validation
 * report for the latest generation of one project.
 *
 * Dependencies: backendApi.workspace.studio (existing project-scoped artifact
 * endpoints) and the pure read-model in services/generatedOutput. It adds no
 * backend contract and holds no secrets.
 *
 * Honesty: this shows what the server generated. It is not Studio import or
 * runtime evidence, and a failed or missing validation is shown as such.
 */
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { backendApi } from "@/services/backendApi";
import {
  buildGeneratedOutput,
  emptyGeneratedOutput,
  selectOutputArtifactIds,
  type GeneratedOutput,
  type GeneratedOutputStatus,
} from "@/services/generatedOutput";

const STATUS_LABEL: Record<GeneratedOutputStatus, string> = {
  empty: "No generated output yet",
  incomplete: "Output incomplete",
  unvalidated: "Not validated",
  validation_failed: "Validation failed",
  ready: "Generated and validated",
};

export function GeneratedOutputPanel({
  projectId,
  refreshKey,
  aiMode,
}: {
  projectId: string;
  /** Changes when the latest execution changes, to reload the output. */
  refreshKey: string;
  /** How the backend says the content was produced, when it says. */
  aiMode?: string;
}) {
  const [output, setOutput] = useState<GeneratedOutput>(emptyGeneratedOutput);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot =
        await backendApi.workspace.studio.projectSnapshot(projectId);
      const ids = selectOutputArtifactIds(snapshot);
      if (ids.length === 0) {
        setOutput(emptyGeneratedOutput());
        return;
      }
      const transfer = await backendApi.workspace.studio.artifacts(
        projectId,
        ids,
      );
      setOutput(buildGeneratedOutput(transfer));
    } catch (loadError) {
      setOutput(emptyGeneratedOutput());
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Generated output could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const file =
    output.files.find((candidate) => candidate.path === selected) ??
    output.files[0];
  const ok = output.status === "ready";

  return (
    <Card
      className="border-border/60 bg-card/50 p-5"
      data-testid="output-explorer"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <FileCode2 className="h-5 w-5 text-primary" />
            Generated output
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Game design, Lua files and validation of the latest generation.
            Server-side output only; not evidence of Studio import or runtime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={ok ? "border-success/50" : "border-warning/50"}
          >
            {ok ? (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            ) : (
              <AlertTriangle className="mr-1 h-3 w-3" />
            )}
            {STATUS_LABEL[output.status]}
          </Badge>
          {aiMode ? (
            <Badge variant="outline" className="border-border/60">
              AI mode: {aiMode}
            </Badge>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Reload generated output"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {output.issues.length > 0 ? (
        <ul role="alert" className="mt-4 list-disc pl-5 text-sm text-warning">
          {output.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      {output.design ? (
        <section className="mt-5" aria-label="Game design">
          <h3 className="text-sm font-semibold">Game design</h3>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {output.design.map((section) => (
              <div
                key={section.key}
                className="rounded-xl border border-border/60 bg-background/40 p-3"
              >
                <h4 className="text-xs font-medium uppercase text-muted-foreground">
                  {section.title}
                </h4>
                {section.text.map((line) => (
                  <p key={line} className="mt-1 text-sm">
                    {line}
                  </p>
                ))}
                {section.items.length > 0 ? (
                  <ul className="mt-1 space-y-1 text-sm">
                    {section.items.map((item) => (
                      <li key={item.name}>
                        <span className="font-medium">{item.name}</span>
                        {item.description ? ` — ${item.description}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {output.files.length > 0 && file ? (
        <section className="mt-5" aria-label="Generated files">
          <h3 className="text-sm font-semibold">
            Files ({output.files.length})
          </h3>
          <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(220px,0.4fr)_minmax(0,1fr)]">
            <ul className="space-y-1" role="listbox" aria-label="File list">
              {output.files.map((candidate) => (
                <li key={candidate.path}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={candidate.path === file.path}
                    onClick={() => setSelected(candidate.path)}
                    className={`w-full rounded-lg border px-2 py-1 text-left text-xs ${
                      candidate.path === file.path
                        ? "border-primary/60 bg-primary/10"
                        : "border-border/60"
                    }`}
                  >
                    <span className="block break-all">{candidate.path}</span>
                    <span className="text-muted-foreground">
                      {candidate.kind} · {candidate.lineCount} lines
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <pre
              className="max-h-96 overflow-auto rounded-xl border border-border/60 bg-background/60 p-3 text-xs"
              aria-label={`Content of ${file.path}`}
              tabIndex={0}
            >
              <code>{file.content}</code>
            </pre>
          </div>
        </section>
      ) : null}

      {output.validation ? (
        <section className="mt-5" aria-label="Validation">
          <h3 className="text-sm font-semibold">
            Validation: {output.validation.passed ? "passed" : "failed"} (
            {output.validation.blockingFailures} blocking,{" "}
            {output.validation.advisoryFailures} advisory)
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {output.validation.checks.map((check) => (
              <li key={check.id}>
                <span className="font-medium">{check.title}</span> —{" "}
                {check.status} ({check.enforcement})
                {check.details.length > 0 ? (
                  <ul className="list-disc pl-5 text-xs text-muted-foreground">
                    {check.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          {output.validation.limits.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Limits: {output.validation.limits.join(" ")}
            </p>
          ) : null}
        </section>
      ) : null}
    </Card>
  );
}
