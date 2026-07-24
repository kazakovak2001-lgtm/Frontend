import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User2, Bell, KeyRound, CreditCard, Palette, Lock } from "lucide-react";
import { AppLayout } from "@/layouts/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { initials } from "@/utils/format";
import { toast } from "sonner";
import { backendApi } from "@/services/backendApi";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Roblox AI Studio" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [notif, setNotif] = useState({
    product: true,
    generation: true,
    marketing: false,
  });
  const [darkMode, setDarkMode] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    backendApi.users
      .preferences(user.id)
      .then((preferences) => {
        setNotif(preferences.notifications);
        setDarkMode(preferences.appearance === "dark");
      })
      .catch((error) =>
        console.warn("[settings] preference load failed", error),
      );
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const next = await backendApi.users.update(user.id, { name, email });
      updateUser(next);
      toast.success("Profile saved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Profile save failed",
      );
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await backendApi.users.savePreferences(user.id, {
        appearance: darkMode ? "dark" : "system",
        notifications: notif,
      });
      toast.success("Preferences saved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Preference save failed",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        description="Manage your account, preferences and integrations."
      />

      <Tabs defaultValue="profile">
        <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 bg-card/50 p-1">
          <TabsTrigger value="profile">
            <User2 className="mr-1.5 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="mr-1.5 h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-1.5 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="api">
            <KeyRound className="mr-1.5 h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="billing">
            <CreditCard className="mr-1.5 h-4 w-4" />
            Billing
          </TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile">
          <Card className="max-w-2xl space-y-6 border-border/60 bg-card/50 p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-gradient-primary text-lg text-primary-foreground">
                  {initials(name || "User")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{name || "Your name"}</p>
                <Badge
                  variant="outline"
                  className="mt-1 border-primary/40 text-primary"
                >
                  {user?.plan ?? "Free"} plan
                </Badge>
              </div>
            </div>
            <Separator className="bg-border/60" />
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <Button
              disabled={saving || !name.trim() || !email.trim()}
              className="bg-gradient-primary text-primary-foreground shadow-glow"
              onClick={() => void saveProfile()}
            >
              Save changes
            </Button>
          </Card>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance">
          <Card className="max-w-2xl space-y-5 border-border/60 bg-card/50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dark mode</p>
                <p className="text-sm text-muted-foreground">
                  Roblox AI Studio is optimized for dark mode.
                </p>
              </div>
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
            </div>
            <Button disabled={saving} onClick={() => void savePreferences()}>
              Save appearance
            </Button>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card className="max-w-2xl space-y-5 border-border/60 bg-card/50 p-6">
            {[
              {
                key: "product",
                label: "Product updates",
                desc: "News about new features and releases.",
              },
              {
                key: "generation",
                label: "Generation alerts",
                desc: "Get notified when a project finishes generating.",
              },
              {
                key: "marketing",
                label: "Marketing emails",
                desc: "Tips, offers and community highlights.",
              },
            ].map((row, i, arr) => (
              <div key={row.key}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{row.label}</p>
                    <p className="text-sm text-muted-foreground">{row.desc}</p>
                  </div>
                  <Switch
                    checked={notif[row.key as keyof typeof notif]}
                    onCheckedChange={(v) =>
                      setNotif((p) => ({ ...p, [row.key]: v }))
                    }
                  />
                </div>
                {i < arr.length - 1 && (
                  <Separator className="mt-5 bg-border/60" />
                )}
              </div>
            ))}
            <Button disabled={saving} onClick={() => void savePreferences()}>
              Save notifications
            </Button>
          </Card>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api">
          <Card className="max-w-2xl space-y-4 border-border/60 bg-card/50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">API keys</p>
                <p className="text-sm text-muted-foreground">
                  Programmatic access for the upcoming public API.
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-warning/40 text-warning"
              >
                Not configured
              </Badge>
            </div>
            <div className="rounded-xl border border-dashed border-border/60 p-4 font-mono text-sm text-muted-foreground">
              ras_live_••••••••••••••••••••••••
            </div>
            <div className="rounded-xl border border-cyan/30 bg-cyan/10 p-3 text-xs text-cyan">
              The public API is in development. Key generation will be enabled
              at launch.
            </div>
          </Card>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing">
          <Card className="max-w-2xl space-y-5 border-border/60 bg-card/50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Current plan</p>
                <p className="text-sm text-muted-foreground">
                  You are on the {user?.plan ?? "Free"} plan.
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-primary/40 text-primary"
              >
                {user?.plan ?? "Free"}
              </Badge>
            </div>
            <Separator className="bg-border/60" />
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" /> Billing provider is not configured in
              the backend.
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
