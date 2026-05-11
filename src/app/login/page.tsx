"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      toast.success("Account created — signing you in…");
    }

    // Sign in (also runs after signup to establish session)
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.refresh();
    router.push("/dashboard");
  }

  return (
    <main className="flex-1 grid place-items-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 border border-black/10 p-8"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GREENSCAPE PRO</h1>
          <p className="text-sm text-black/60">Phoenix, AZ — Quotes</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@greenscapepro.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? mode === "signup" ? "Creating account…" : "Signing in…"
            : mode === "signup" ? "Create account" : "Sign in"}
        </Button>

        <p className="text-center text-sm text-black/50">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setMode("signup")}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </form>
    </main>
  );
}
