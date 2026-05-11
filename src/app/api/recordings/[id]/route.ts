import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/recordings/:id — returns status + quote_id if drafted
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: rec, error } = await supabase
    .from("recordings")
    .select("id, status, error")
    .eq("id", id)
    .single();

  if (error || !rec) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let quoteId: string | null = null;
  if (rec.status === "drafted") {
    const { data: quote } = await supabase
      .from("quotes")
      .select("id")
      .eq("recording_id", id)
      .maybeSingle();
    quoteId = quote?.id ?? null;
  }

  return NextResponse.json({ ...rec, quote_id: quoteId });
}
