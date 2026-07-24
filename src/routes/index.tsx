import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  Wand2,
  Boxes,
  Code2,
  ShieldCheck,
  Rocket,
  Zap,
  Check,
  Github,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { StudioCapabilities } from "@/components/StudioCapabilities";
import { APP_NAME } from "@/constants";
import heroPreview from "@/assets/hero-preview.jpg";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Roblox AI Studio — Build Roblox games from a single prompt" },
      {
        name: "description",
        content:
          "Describe your game idea and let a pipeline of AI agents plan, design, build and ship a complete Roblox project. Join the future of game creation.",
      },
      { property: "og:title", content: "Roblox AI Studio" },
      {
        property: "og:description",
        content:
          "Build complete Roblox games from a single text prompt with AI.",
      },
    ],
  }),
  component: LandingPage,
});

const BENEFITS = [
  {
    icon: Wand2,
    title: "Prompt to game",
    desc: "Turn a one-line idea into a structured, production-ready game plan in seconds.",
  },
  {
    icon: Boxes,
    title: "Full world building",
    desc: "Maps, terrain, models and asset placement generated automatically.",
  },
  {
    icon: Code2,
    title: "Optimized Luau",
    desc: "Clean, performant scripts for mechanics, economy and data persistence.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    desc: "Anti-exploit hardening and server-authoritative logic built in.",
  },
  {
    icon: Zap,
    title: "10x faster",
    desc: "Skip weeks of boilerplate and focus on what makes your game unique.",
  },
  {
    icon: Rocket,
    title: "One-click export",
    desc: "Export a ready-to-open Roblox Studio project when generation completes.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Describe your game",
    desc: "Write a prompt like “Mining Simulator with pets and rebirths.”",
  },
  {
    n: "02",
    title: "Agents collaborate",
    desc: "Planner, Designer, Builder, Lua and more work the pipeline together.",
  },
  {
    n: "03",
    title: "Review & refine",
    desc: "Chat with the AI, tweak systems and watch your game take shape.",
  },
  {
    n: "04",
    title: "Export to Roblox",
    desc: "Download the finished project and publish it to the platform.",
  },
];

const FAQ = [
  {
    q: "Is the AI generation live yet?",
    a: "The full generation pipeline is in active development. This platform is the production-ready studio that will power it — you can set up projects and explore the workflow today.",
  },
  {
    q: "What kinds of games can it build?",
    a: "Simulators, tycoons, obbies, RPGs and more. You describe the concept and the agents adapt the systems to your genre.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. The agents write the Luau scripts. Advanced users can still inspect and customize everything.",
  },
  {
    q: "Will I own the generated game?",
    a: "Yes. Exported projects are yours to edit, publish and monetize on Roblox.",
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    tagline: "Explore the studio",
    features: [
      "1 active project",
      "Community support",
      "Standard agents",
      "Watermarked exports",
    ],
    cta: "Get started",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    tagline: "For serious creators",
    features: [
      "Unlimited projects",
      "Priority generation",
      "All AI agents",
      "Clean exports",
      "AI chat assistant",
    ],
    cta: "Start Pro trial",
    highlight: true,
  },
  {
    name: "Studio",
    price: "$99",
    tagline: "For teams",
    features: [
      "Everything in Pro",
      "Team collaboration",
      "Custom agents",
      "Priority support",
      "Marketplace access",
    ],
    cta: "Contact sales",
    highlight: false,
  },
];

function LandingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a
            href="#features"
            className="transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a
            href="#pricing"
            className="transition-colors hover:text-foreground"
          >
            Pricing
          </a>
          <a href="#faq" className="transition-colors hover:text-foreground">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link to="/login">Log in</Link>
          </Button>
          <Button
            asChild
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Link to="/register">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden grid-bg">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-20 text-center sm:px-6 lg:px-8 lg:pt-28">
          <Badge
            variant="outline"
            className="mb-6 gap-1.5 border-primary/30 bg-primary/10 text-primary animate-fade-in"
          >
            <Sparkles className="h-3.5 w-3.5" /> The future of Roblox
            development
          </Badge>
          <h1 className="mx-auto max-w-4xl font-display text-4xl font-bold leading-[1.1] tracking-tight animate-fade-in sm:text-6xl">
            Build complete Roblox games from a{" "}
            <span className="text-gradient">single prompt</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground animate-fade-in">
            Describe your idea and a pipeline of specialized AI agents plans,
            designs, builds and ships it. From “Mining Simulator with pets and
            rebirths” to a playable game.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 animate-fade-in sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <Link to="/register">
                Start building <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-border/60"
            >
              <Link to="/login">View dashboard demo</Link>
            </Button>
          </div>

          {/* App preview */}
          <div className="relative mx-auto mt-16 max-w-5xl animate-scale-in">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-primary opacity-20 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-border/60 glass shadow-elegant">
              <img
                src={heroPreview}
                alt="Roblox AI Studio interface preview"
                width={1280}
                height={896}
                className="w-full"
              />
            </div>
          </div>

          {/* Studio capabilities */}
          <div className="mx-auto mt-14 max-w-6xl text-left">
            <StudioCapabilities />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section
        id="features"
        className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to{" "}
            <span className="text-gradient">ship faster</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            A full studio designed around an AI-first game development workflow.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="group rounded-2xl border border-border/60 bg-card/50 p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <b.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-border/40 bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-muted-foreground">
              Four steps from idea to playable game.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="relative rounded-2xl border border-border/60 bg-card/50 p-6"
              >
                <span className="font-display text-4xl font-bold text-gradient">
                  {s.n}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-muted-foreground">
            Placeholder plans — billing connects in a future release.
          </p>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PRICING.map((p) => (
            <div
              key={p.name}
              className={cn(
                "relative rounded-2xl border bg-card/50 p-8",
                p.highlight
                  ? "border-primary/60 shadow-glow"
                  : "border-border/60",
              )}
            >
              {p.highlight && (
                <Badge className="absolute -top-3 left-8 bg-gradient-primary text-primary-foreground">
                  Most popular
                </Badge>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
              <div className="mt-4 flex items-end gap-1">
                <span className="font-display text-4xl font-bold">
                  {p.price}
                </span>
                <span className="mb-1 text-sm text-muted-foreground">/mo</span>
              </div>
              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className={cn(
                  "mt-8 w-full",
                  p.highlight
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "",
                )}
                variant={p.highlight ? "default" : "outline"}
              >
                <Link to="/register">{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/40 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Frequently asked questions
            </h2>
          </div>
          <Accordion type="single" collapsible className="mt-10">
            {FAQ.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border-border/60"
              >
                <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card/50 px-6 py-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-gradient-primary opacity-10" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to build your next Roblox hit?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Create a project, run the AI pipeline and follow every backend
              module in one workspace.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <Link to="/register">
                Create free account <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Logo />
            <div className="flex items-center gap-4 text-muted-foreground">
              <a
                href="https://github.com/kazakovak2001-lgtm/Frontend"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="hover:text-foreground"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-border/40 pt-8 text-xs text-muted-foreground sm:flex-row">
            <p>
              © {new Date().getFullYear()} {APP_NAME}. Not affiliated with
              Roblox Corporation.
            </p>
            <div className="flex gap-4">
              <span>Privacy policy pending publication</span>
              <span>Terms pending publication</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
