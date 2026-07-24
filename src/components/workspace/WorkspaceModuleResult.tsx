import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ResultHighlight {
  label: string;
  value: string;
}

const PRIORITY_KEYS = [
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

/**
 * Converts heterogeneous backend module payloads into a stable operational
 * summary. The complete response remains available in a collapsed diagnostic
 * inspector instead of being the primary user interface.
 */
export function WorkspaceModuleResult({ data }: { data: unknown }) {
  const highlights = summarizeResult(data);

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

function summarizeResult(data: unknown): ResultHighlight[] {
  if (Array.isArray(data)) {
    return [
      { label: "Items", value: String(data.length) },
      ...summarizeArraySample(data),
    ];
  }

  if (!isRecord(data)) {
    return [{ label: "Result", value: formatValue(data) }];
  }

  const selected: ResultHighlight[] = [];
  const used = new Set<string>();

  for (const key of PRIORITY_KEYS) {
    if (!(key in data)) continue;
    selected.push({ label: humanize(key), value: formatValue(data[key]) });
    used.add(key);
    if (selected.length >= 6) return selected;
  }

  for (const [key, value] of Object.entries(data)) {
    if (used.has(key)) continue;
    selected.push({ label: humanize(key), value: formatValue(value) });
    if (selected.length >= 6) break;
  }

  return selected.length
    ? selected
    : [{ label: "Result", value: "Operation completed" }];
}

function summarizeArraySample(data: unknown[]): ResultHighlight[] {
  const first = data[0];
  if (!isRecord(first)) return [];

  const identifier = first.name ?? first.title ?? first.id ?? first.status;
  return identifier === undefined
    ? []
    : [{ label: "First item", value: formatValue(identifier) }];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "Not reported";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—";
  if (typeof value === "string") return value || "Empty";
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (isRecord(value)) {
    const status = value.status ?? value.message ?? value.name ?? value.id;
    if (status !== undefined) return formatValue(status);
    return `${Object.keys(value).length} fields`;
  }
  return String(value);
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  const label = loading ? "Running" : error ? "Error" : hasData ? "Complete" : "Ready";

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
