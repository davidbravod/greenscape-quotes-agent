"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Check your email for the sign-in link.");
  }

  return (
    <main className="flex-1 grid place-items-center p-6">
      <form
        onSubmit={sendLink}
        className="w-full max-w-sm space-y-6 border border-black/10 p-8"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GREENSCAPE PRO</h1>
          <p className="text-sm text-black/60">Phoenix, AZ — Quotes</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@greenscapepro.com"
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sending…" : "Send magic link"}
        </Button>
      </form>
    </main>
  );
}
