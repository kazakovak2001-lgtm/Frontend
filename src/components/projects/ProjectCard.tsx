import { Link } from "@tanstack/react-router";
import { MoreVertical, Copy, Trash2, ArrowUpRight, Users } from "lucide-react";
import type { Project } from "@/types";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/utils/format";

interface ProjectCardProps {
  project: Project;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function ProjectCard({ project, onDuplicate, onDelete }: ProjectCardProps) {
  return (
    <Card className="group relative overflow-hidden border-border/60 bg-card/50 p-0 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow">
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
        className="block"
        aria-label={`Open ${project.name}`}
      >
        <div
          className="relative h-32 w-full"
          style={{
            background: `linear-gradient(135deg, oklch(0.4 0.18 ${project.thumbnailHue}), oklch(0.25 0.08 ${project.thumbnailHue + 40}))`,
          }}
        >
          <div className="absolute inset-0 grid-bg opacity-40" />
          <div className="absolute right-3 top-3">
            <StatusBadge status={project.status} />
          </div>
        </div>
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to="/projects/$projectId" params={{ projectId: project.id }} className="min-w-0">
            <h3 className="truncate font-semibold transition-colors group-hover:text-primary">
              {project.name}
            </h3>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Project actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/projects/$projectId" params={{ projectId: project.id }}>
                  <ArrowUpRight className="mr-2 h-4 w-4" /> Open
                </Link>
              </DropdownMenuItem>
              {onDuplicate && (
                <DropdownMenuItem onClick={() => onDuplicate(project.id)}>
                  <Copy className="mr-2 h-4 w-4" /> Duplicate
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem onClick={() => onDelete(project.id)} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>

        {project.status === "generating" && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Generating…</span>
              <span>{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-1.5" />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {project.players}
          </span>
          <span>{formatRelativeTime(project.updatedAt)}</span>
        </div>
      </div>
    </Card>
  );
}
