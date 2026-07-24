import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PlusCircle, Search, FolderPlus } from "lucide-react";
import { AppLayout } from "@/layouts/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProjects } from "@/contexts/ProjectsContext";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import type { ProjectStatus } from "@/types";
import { PageLoader } from "@/components/PageLoader";

export const Route = createFileRoute("/projects/")({
  head: () => ({ meta: [{ title: "Projects — Roblox AI Studio" }] }),
  component: ProjectsPage,
});

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "generating", label: "Generating" },
  { value: "ready", label: "Ready" },
  { value: "exported", label: "Exported" },
];

function ProjectsPage() {
  const { projects, isLoading, duplicateProject, deleteProject } =
    useProjects();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const debounced = useDebounce(query);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchesQuery =
        p.name.toLowerCase().includes(debounced.toLowerCase()) ||
        p.description.toLowerCase().includes(debounced.toLowerCase());
      const matchesStatus =
        status === "all" || p.status === (status as ProjectStatus);
      return matchesQuery && matchesStatus;
    });
  }, [projects, debounced, status]);

  return (
    <AppLayout>
      <PageHeader
        title="Projects"
        description={`${projects.length} project${projects.length === 1 ? "" : "s"} in your studio`}
        actions={
          <Button
            asChild
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Link to="/projects/new">
              <PlusCircle className="mr-1 h-4 w-4" /> New Project
            </Link>
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 rounded-xl border-border/60 bg-card/50 pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-full rounded-xl border-border/60 bg-card/50 sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <PageLoader label="Loading projects…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FolderPlus className="h-6 w-6" />}
          title={
            projects.length === 0 ? "No projects yet" : "No matching projects"
          }
          description={
            projects.length === 0
              ? "Create your first project to start building with AI."
              : "Try adjusting your search or filters."
          }
          action={
            projects.length === 0 ? (
              <Button
                asChild
                className="bg-gradient-primary text-primary-foreground shadow-glow"
              >
                <Link to="/projects/new">
                  <PlusCircle className="mr-1 h-4 w-4" /> New Project
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onDuplicate={(id) => {
                void duplicateProject(id)
                  .then(() => toast.success("Project duplicated."))
                  .catch((error) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Duplicate failed",
                    ),
                  );
              }}
              onDelete={(id) => setPendingDelete(id)}
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The project and its generated files
              will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) {
                  void deleteProject(pendingDelete)
                    .then(() => toast.success("Project deleted."))
                    .catch((error) =>
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Delete failed",
                      ),
                    )
                    .finally(() => setPendingDelete(null));
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
