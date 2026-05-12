import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/catalog/search?q=flagstone&limit=8
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? 8), 20);

  const supabase = await createClient();

  let query = supabase
    .from("catalog_items")
    .select("id, sku, name, category, kind, unit, unit_price, labor_rate, labor_unit, description")
    .eq("active", true)
    .limit(limit);

  if (q) {
    query = query.or(`name.ilike.%${q}%,aliases.ilike.%${q}%,sku.ilike.%${q}%`);
  } else {
    query = query.order("category").order("name");
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
