import { NextResponse } from "next/server";
import { runCatalogSync } from "@/lib/catalog-sync";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// POST /api/sync-catalog
//   • Called by the "Resync now" button (requires signed-in admin session)
//   • Called by Vercel Cron (requires x-sync-secret header)
export async function POST(req: Request) {
  const isCron =
    req.headers.get("x-sync-secret") === process.env.CATALOG_SYNC_SECRET &&
    !!process.env.CATALOG_SYNC_SECRET;

  if (!isCron) {
    // Verify the caller is a signed-in admin
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const result = await runCatalogSync();
  if (result.error) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}

// GET /api/sync-catalog — Vercel Cron uses GET by convention
export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CATALOG_SYNC_SECRET || !process.env.CATALOG_SYNC_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runCatalogSync();
  if (result.error) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
