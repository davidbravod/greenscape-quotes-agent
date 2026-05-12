import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { draftQuote } from "@/lib/agent";

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { transcript?: string; model?: string };
  const transcript = body.transcript?.trim();
  if (!transcript) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  const { data: settings } = await supabase
    .from("settings")
    .select("agent_model")
    .eq("id", 1)
    .single();

  try {
    const draft = await draftQuote(transcript, supabase, body.model ?? settings?.agent_model);
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
