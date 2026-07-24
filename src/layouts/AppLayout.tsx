import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  PlusCircle,
  Bot,
  Settings as SettingsIcon,
  Search,
  Bell,
  Menu,
  X,
  LogOut,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { initials } from "@/utils/format";
import { cn } from "@/lib/utils";
import { useProjects } from "@/contexts/ProjectsContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { PageLoader } from "@/components/PageLoader";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", to: "/projects", icon: FolderKanban },
  { label: "New Project", to: "/projects/new", icon: PlusCircle },
  { label: "AI Agents", to: "/agents", icon: Bot },
  { label: "Settings", to: "/settings", icon: SettingsIcon },
] as const;

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { activeProjectId, snapshots } = useWorkspace();
  const live = activeProjectId ? snapshots[activeProjectId] : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active =
            item.to === "/projects"
              ? pathname === "/projects" || pathname.startsWith("/projects/")
                ? pathname !== "/projects/new"
                : false
              : pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-primary/15 text-primary shadow-glow"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-2xl glass p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-cyan" />
          AI Pipeline
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {activeProjectId
            ? `${live?.status ?? "idle"} · ${live?.progress ?? 0}%`
            : "Open a project workspace to follow its live pipeline."}
        </p>
        <Badge
          variant="outline"
          className={`mt-3 ${
            live?.connected
              ? "border-success/30 bg-success/10 text-success"
              : "border-cyan/30 bg-cyan/10 text-cyan"
          }`}
        >
          {live?.connected ? "Realtime connected" : "Backend ready"}
        </Badge>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const { projects } = useProjects();
  const { runs, snapshots } = useWorkspace();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return projects
      .filter(
        (project) =>
          project.name.toLowerCase().includes(query) ||
          project.description.toLowerCase().includes(query) ||
          project.genre.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [projects, search]);

  const notifications = useMemo(
    () =>
      Object.values(runs)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
        .slice(0, 6),
    [runs],
  );
  const hasActiveRun = notifications.some((run) =>
    [
      "pending_start",
      "starting",
      "queued",
      "running",
      "generation_started",
    ].includes(run.status),
  );

  const handleLogout = async () => {
    await logout();
    await navigate({ to: "/" });
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({ to: "/login" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading || !isAuthenticated) {
    return <PageLoader label="Restoring your workspace…" />;
  }

  return (
    <div className="min-h-screen w-full bg-background grid-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border/60 bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border/60 bg-sidebar animate-scale-in">
            <button
              className="absolute right-3 top-4 text-muted-foreground"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects, agents…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchResults[0]) {
                  void navigate({
                    to: "/projects/$projectId",
                    params: { projectId: searchResults[0].id },
                  });
                  setSearch("");
                }
              }}
              className="h-10 rounded-xl border-border/60 bg-card/50 pl-9"
            />
            {search.trim() && (
              <CardSearchResults
                projects={searchResults}
                onSelect={() => setSearch("")}
              />
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {hasActiveRun && (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Pipeline activity</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.map((run) => (
                  <DropdownMenuItem
                    key={`${run.projectId}-${run.executionId}`}
                    asChild
                  >
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: run.projectId }}
                      className="flex items-center justify-between"
                    >
                      <span className="truncate">{run.executionId}</span>
                      <Badge variant="outline">
                        {snapshots[run.projectId]?.status ?? run.status}
                      </Badge>
                    </Link>
                  </DropdownMenuItem>
                ))}
                {notifications.length === 0 && (
                  <DropdownMenuItem disabled>
                    No pipeline activity yet.
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-accent">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-primary text-xs font-semibold text-primary-foreground">
                      {initials(user?.name ?? "User")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">
                    {user?.name ?? "Developer"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user?.name ?? "Developer"}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {user?.email ?? "demo@studio.ai"}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void handleLogout()}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function CardSearchResults({
  projects,
  onSelect,
}: {
  projects: Array<{ id: string; name: string; genre: string }>;
  onSelect: () => void;
}) {
  return (
    <div className="absolute left-0 right-0 top-12 z-50 rounded-xl border border-border/60 bg-popover p-2 shadow-xl">
      {projects.map((project) => (
        <Link
          key={project.id}
          to="/projects/$projectId"
          params={{ projectId: project.id }}
          onClick={onSelect}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent"
        >
          <span className="truncate">{project.name}</span>
          <span className="text-xs text-muted-foreground">{project.genre}</span>
        </Link>
      ))}
      {projects.length === 0 && (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
          No matching projects.
        </p>
      )}
    </div>
  );
}
