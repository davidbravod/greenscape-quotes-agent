import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchOpportunities } from "@/lib/ghl";

// GET /api/ghl/opportunities?q=...
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  try {
    const opportunities = await searchOpportunities(q);
    return NextResponse.json({ opportunities });
  } catch (err) {
    const message = err instanceof Error ? err.message : "GHL error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
