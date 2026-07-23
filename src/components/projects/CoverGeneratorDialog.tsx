import { useMemo, useState } from "react";
import { Sparkles, RefreshCw, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project } from "@/types";
import { useProjects } from "@/contexts/ProjectsContext";
import { toast } from "sonner";

interface Props {
  project: Project;
  trigger?: React.ReactNode;
}

interface Variant {
  hue: number;
  hue2: number;
  shape: "hex" | "orbit" | "shard" | "spark";
  tagline: string;
}

const TAGLINES = [
  "An AI-crafted Roblox experience",
  "Play. Build. Rebirth.",
  "Enter a new world",
  "Powered by Roblox AI Studio",
  "The adventure begins",
];

function randomVariant(seed: number): Variant {
  const shapes: Variant["shape"][] = ["hex", "orbit", "shard", "spark"];
  return {
    hue: (seed * 47) % 360,
    hue2: (seed * 47 + 60 + (seed % 80)) % 360,
    shape: shapes[seed % shapes.length],
    tagline: TAGLINES[seed % TAGLINES.length],
  };
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
  );
}

function buildCoverSvg(name: string, v: Variant): string {
  const words = name.trim().split(/\s+/);
  const line1 = escapeXml(words.slice(0, Math.ceil(words.length / 2)).join(" "));
  const line2 = escapeXml(words.slice(Math.ceil(words.length / 2)).join(" "));
  const tagline = escapeXml(v.tagline.toUpperCase());
  const { hue, hue2, shape } = v;

  let mark = "";
  if (shape === "hex") {
    mark = `
      <polygon points="0,-90 78,-45 78,45 0,90 -78,45 -78,-45" fill="none" stroke="oklch(0.9 0.2 ${hue})" stroke-width="4"/>
      <polygon points="0,-55 48,-27 48,27 0,55 -48,27 -48,-27" fill="oklch(0.7 0.22 ${hue} / 0.4)"/>
      <circle cx="0" cy="0" r="16" fill="oklch(0.95 0.15 ${hue})"/>`;
  } else if (shape === "orbit") {
    mark = `
      <ellipse cx="0" cy="0" rx="95" ry="35" fill="none" stroke="oklch(0.9 0.2 ${hue})" stroke-width="3"/>
      <ellipse cx="0" cy="0" rx="95" ry="35" fill="none" stroke="oklch(0.9 0.2 ${hue2})" stroke-width="3" transform="rotate(60)"/>
      <circle cx="0" cy="0" r="30" fill="oklch(0.95 0.18 ${hue})"/>`;
  } else if (shape === "shard") {
    mark = `
      <polygon points="0,-90 60,0 0,90 -60,0" fill="oklch(0.75 0.22 ${hue})"/>
      <polygon points="0,-55 30,0 0,55 -30,0" fill="oklch(0.95 0.1 ${hue2})"/>`;
  } else {
    mark = `
      <g stroke="oklch(0.95 0.2 ${hue})" stroke-width="6" stroke-linecap="round">
        <line x1="0" y1="-90" x2="0" y2="90"/>
        <line x1="-90" y1="0" x2="90" y2="0"/>
        <line x1="-60" y1="-60" x2="60" y2="60"/>
        <line x1="-60" y1="60" x2="60" y2="-60"/>
        <circle cx="0" cy="0" r="22" fill="oklch(0.95 0.18 ${hue2})" stroke="none"/>
      </g>`;
  }

  const titleY = line2 ? 430 : 460;
  const line2El = line2
    ? `<text x="600" y="530" text-anchor="middle" font-family="'Space Grotesk', system-ui, sans-serif" font-weight="800" font-size="96" fill="oklch(0.98 0.02 0)" letter-spacing="-2">${line2}</text>`
    : "";
  const taglineY = line2 ? 590 : 520;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="oklch(0.35 0.22 ${hue})"/>
      <stop offset="100%" stop-color="oklch(0.18 0.12 ${hue2})"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="oklch(0.75 0.25 ${hue} / 0.55)"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="oklch(0.85 0.15 ${hue} / 0.08)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect width="1200" height="675" fill="url(#grid)"/>
  <rect width="1200" height="675" fill="url(#glow)"/>
  <g transform="translate(600 230)">${mark}</g>
  <text x="600" y="${titleY}" text-anchor="middle" font-family="'Space Grotesk', system-ui, sans-serif" font-weight="800" font-size="96" fill="oklch(0.98 0.02 0)" letter-spacing="-2">${line1}</text>
  ${line2El}
  <text x="600" y="${taglineY}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" fill="oklch(0.85 0.05 ${hue})" letter-spacing="4">${tagline}</text>
</svg>`;
}

export function CoverGeneratorDialog({ project, trigger }: Props) {
  const { updateProject } = useProjects();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1000));

  const svg = useMemo(() => buildCoverSvg(name || project.name, randomVariant(seed)), [name, seed, project.name]);

  const handleSave = () => {
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    updateProject(project.id, { coverUrl: dataUrl, name });
    toast.success("Cover saved to project.");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="bg-gradient-primary text-primary-foreground shadow-glow">
            <Sparkles className="mr-1.5 h-4 w-4" /> Generate cover
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Generate intro cover</DialogTitle>
          <DialogDescription>
            AI-styled logo &amp; title for your game. Regenerate until it feels right, then save.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div
            className="aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-black/40 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="space-y-1.5">
            <Label htmlFor="cover-title">Game title</Label>
            <Input
              id="cover-title"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => setSeed(Math.floor(Math.random() * 10000))}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Regenerate
          </Button>
          <Button onClick={handleSave} className="bg-gradient-primary text-primary-foreground">
            <Download className="mr-1.5 h-4 w-4" /> Save cover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
