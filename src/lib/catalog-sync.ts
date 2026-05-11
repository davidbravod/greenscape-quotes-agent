import { createServiceClient } from "@/lib/supabase/server";
import { readCatalogSheet } from "@/lib/sheets";

export type SyncResult = {
  rows_upserted: number;
  rows_deactivated: number;
  error?: string;
};

export async function runCatalogSync(): Promise<SyncResult> {
  const supabase = createServiceClient();

  // Open a sync run record
  const { data: run, error: runErr } = await supabase
    .from("catalog_sync_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(`Failed to create sync run: ${runErr?.message}`);

  try {
    const rows = await readCatalogSheet();
    if (rows.length === 0) throw new Error("Sheet returned zero data rows — check range and permissions");

    const incomingSkus = new Set(rows.map((r) => r.sku));

    // Upsert all rows from the sheet
    const { error: upsertErr } = await supabase.from("catalog_items").upsert(
      rows.map((r) => ({
        sku: r.sku,
        name: r.name,
        aliases: r.aliases,
        category: r.category,
        subcategory: r.subcategory,
        kind: r.kind,
        unit: r.unit,
        unit_price: r.unit_price,
        labor_rate: r.labor_rate,
        labor_unit: r.labor_unit,
        min_qty: r.min_qty,
        description: r.description,
        active: r.active,
        updated_at: new Date().toISOString(),
        // sheet_row_id is the sku — unique key the sync owns
        sheet_row_id: r.sku,
      })),
      { onConflict: "sku" },
    );
    if (upsertErr) throw new Error(`Upsert failed: ${upsertErr.message}`);

    // Soft-deactivate any SKUs in DB (from prior syncs) that are no longer in the sheet
    const { data: existing } = await supabase
      .from("catalog_items")
      .select("sku")
      .not("sheet_row_id", "is", null)
      .eq("active", true);

    const toDeactivate = (existing ?? [])
      .map((r) => r.sku)
      .filter((sku) => !incomingSkus.has(sku));

    let rows_deactivated = 0;
    if (toDeactivate.length > 0) {
      const { error: deactErr } = await supabase
        .from("catalog_items")
        .update({ active: false, updated_at: new Date().toISOString() })
        .in("sku", toDeactivate);
      if (deactErr) throw new Error(`Deactivate failed: ${deactErr.message}`);
      rows_deactivated = toDeactivate.length;
    }

    // Mark run as done
    await supabase
      .from("catalog_sync_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        rows_upserted: rows.length,
        rows_deactivated,
      })
      .eq("id", run.id);

    return { rows_upserted: rows.length, rows_deactivated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("catalog_sync_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: msg })
      .eq("id", run.id);
    return { rows_upserted: 0, rows_deactivated: 0, error: msg };
  }
}
