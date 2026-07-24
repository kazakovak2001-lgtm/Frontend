import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { summarizeWorkspaceResult } from "@/components/workspace/workspaceLogic";

/**
 * Converts heterogeneous backend module payloads into a stable operational
 * summary. The complete response remains available in a collapsed diagnostic
 * inspector instead of being the primary user interface.
 */
export function WorkspaceModuleResult({ data }: { data: unknown }) {
  const highlights = summarizeWorkspaceResult(data);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {highlights.map((highlight) => (
          <div
            key={`${highlight.label}-${highlight.value}`}
            className="rounded-lg border border-border/60 bg-background/40 p-3"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {highlight.label}
            </p>
            <p className="mt-1 break-words text-sm font-medium">
              {highlight.value}
            </p>
          </div>
        ))}
      </div>

      <details className="group rounded-lg border border-border/60 bg-background/30">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
          Diagnostic response
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <pre className="max-h-64 overflow-auto border-t border-border/60 p-3 font-mono text-[11px] text-muted-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function ModuleResultStatus({
  loading,
  error,
  hasData,
}: {
  loading: boolean;
  error?: string;
  hasData: boolean;
}) {
  const label = loading
    ? "Running"
    : error
      ? "Error"
      : hasData
        ? "Complete"
        : "Ready";

  return (
    <Badge
      variant="outline"
      className={
        error
          ? "border-destructive/40 text-destructive"
          : hasData
            ? "border-success/40 text-success"
            : loading
              ? "border-primary/40 text-primary"
              : "border-border/60"
      }
    >
      {label}
    </Badge>
  );
}
