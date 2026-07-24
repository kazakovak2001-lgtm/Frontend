import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { AppLayout } from "@/layouts/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useProjects } from "@/contexts/ProjectsContext";
import {
  GAME_TYPES,
  GENRES,
  DIFFICULTIES,
  PLAYER_COUNTS,
  TARGET_AUDIENCES,
} from "@/constants";
import { toast } from "sonner";
import type { Difficulty, GameGenre } from "@/types";
import { backendApi } from "@/services/backendApi";

export const Route = createFileRoute("/projects/new")({
  head: () => ({ meta: [{ title: "New Project — Roblox AI Studio" }] }),
  component: NewProjectPage,
});

function NewProjectPage() {
  const { createProject } = useProjects();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [gameType, setGameType] = useState<string>(GAME_TYPES[0]);
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState<GameGenre>("Simulator");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [players, setPlayers] = useState<string>(PLAYER_COUNTS[2]);
  const [audience, setAudience] = useState<string>(TARGET_AUDIENCES[3]);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      toast.error("Please add a project name and description.");
      return;
    }
    setLoading(true);
    try {
      const project = await createProject({
        name: name.trim(),
        gameType,
        description: description.trim(),
        genre,
        difficulty,
        players,
        targetAudience: audience,
      });
      await backendApi.ai.startGeneration(project.id);
      toast.success("Project created — generation started.");
      navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Project creation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="New Project"
        description="Describe your game and the AI pipeline will take it from here."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={onSubmit} className="lg:col-span-2">
          <Card className="space-y-5 border-border/60 bg-card/50 p-6">
            <div className="space-y-1.5">
              <Label htmlFor="name">Project name</Label>
              <Input
                id="name"
                placeholder="e.g. Mining Simulator"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Game type</Label>
                <Select value={gameType} onValueChange={setGameType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GAME_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Genre</Label>
                <Select value={genre} onValueChange={(v) => setGenre(v as GameGenre)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GENRES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={5}
                placeholder="Create a Roblox Mining Simulator with pets and rebirths…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                The more detail you give, the better the agents can build your game.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Players</Label>
                <Select value={players} onValueChange={setPlayers}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAYER_COUNTS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Target audience</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_AUDIENCES.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              {loading ? "Creating project…" : "Generate game"}
            </Button>
          </Card>
        </form>

        <aside>
          <Card className="border-primary/30 bg-card/50 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-cyan" /> What happens next
            </div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>1. Your prompt is sent to the Planner agent.</li>
              <li>2. Designer, Builder and Lua agents collaborate.</li>
              <li>3. QA &amp; Security validate the result.</li>
              <li>4. Export your finished Roblox project.</li>
            </ul>
            <div className="mt-5 rounded-xl border border-cyan/30 bg-cyan/10 p-3 text-xs text-cyan">
              The generation pipeline is in development. Projects are saved and ready for it.
            </div>
          </Card>
        </aside>
      </div>
    </AppLayout>
  );
}
