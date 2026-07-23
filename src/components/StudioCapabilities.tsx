import { Globe2, UserSquare2, Code2, Package, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Capability {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string; // tailwind text color class for the icon
  glow: string; // tailwind bg color class (with /10) for the icon bg
  border: string; // hover border color class
}

export const STUDIO_CAPABILITIES: Capability[] = [
  {
    id: "world-builder",
    title: "AI World Builder",
    description: "Generate vast, unique worlds in seconds.",
    icon: Globe2,
    accent: "text-cyan",
    glow: "bg-cyan/10",
    border: "hover:border-cyan/50",
  },
  {
    id: "character-creator",
    title: "AI Character Creator",
    description: "Create intelligent NPCs with unique behaviors.",
    icon: UserSquare2,
    accent: "text-fuchsia-400",
    glow: "bg-fuchsia-500/10",
    border: "hover:border-fuchsia-500/50",
  },
  {
    id: "code-assistant",
    title: "AI Code Assistant",
    description: "Generate, optimize and debug code with AI.",
    icon: Code2,
    accent: "text-primary",
    glow: "bg-primary/10",
    border: "hover:border-primary/50",
  },
  {
    id: "smart-assets",
    title: "Smart Assets",
    description: "Thousands of AI-generated assets at your fingertips.",
    icon: Package,
    accent: "text-violet-400",
    glow: "bg-violet-500/10",
    border: "hover:border-violet-500/50",
  },
];

export function StudioCapabilities({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {STUDIO_CAPABILITIES.map((c) => (
        <div
          key={c.id}
          className={cn(
            "group rounded-2xl border border-border/60 bg-card/50 p-5 transition-all hover:-translate-y-1 hover:shadow-glow",
            c.border,
          )}
        >
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
              c.glow,
              c.accent,
            )}
          >
            <c.icon className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-base font-semibold">{c.title}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{c.description}</p>
        </div>
      ))}
    </div>
  );
}
