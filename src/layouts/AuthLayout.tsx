import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import heroPreview from "@/assets/hero-preview.jpg";

export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      <div className="relative flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm animate-fade-in">
          <Logo className="mb-10" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
        <div className="absolute bottom-6 left-0 w-full text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </div>

      <div className="relative hidden overflow-hidden border-l border-border/60 lg:block">
        <img
          src={heroPreview}
          alt="Roblox AI Studio dashboard preview"
          className="h-full w-full object-cover opacity-60"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 animate-fade-in">
          <h2 className="font-display text-2xl font-semibold">
            From prompt to playable <span className="text-gradient">Roblox game</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A pipeline of specialized AI agents that plan, design, build and ship your game.
          </p>
        </div>
      </div>
    </div>
  );
}
