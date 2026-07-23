import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — Roblox AI Studio" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    setSent(true);
    toast.success("Reset link sent (placeholder).");
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We'll send you a link to get back in.">
      {sent ? (
        <div className="rounded-2xl border border-border/60 bg-card/50 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
            <MailCheck className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-semibold">Check your inbox</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            If an account exists for {email}, a reset link is on its way.
          </p>
          <Button asChild variant="outline" className="mt-6 w-full border-border/60">
            <Link to="/login"><ArrowLeft className="mr-2 h-4 w-4" /> Back to login</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@studio.ai" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send reset link
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/login"><ArrowLeft className="mr-2 h-4 w-4" /> Back to login</Link>
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
