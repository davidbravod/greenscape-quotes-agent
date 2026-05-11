import { createClient } from "@/lib/supabase/server";
import ResyncButton from "./resync-button";

export default async function CatalogAdmin() {
  const supabase = await createClient();
  const [{ data: items }, { data: lastRun }] = await Promise.all([
    supabase
      .from("catalog_items")
      .select("sku, name, category, kind, unit, unit_price, labor_rate, active")
      .order("category")
      .order("name")
      .limit(500),
    supabase
      .from("catalog_sync_runs")
      .select("started_at, finished_at, status, rows_upserted, rows_deactivated, error")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Catalog</h1>
          <p className="text-xs text-black/50 mt-0.5">
            {items?.length ?? 0} items ·{" "}
            {lastRun
              ? `Last sync ${new Date(lastRun.started_at).toLocaleString()} — ${lastRun.status}${lastRun.rows_upserted != null ? ` (${lastRun.rows_upserted} upserted, ${lastRun.rows_deactivated} deactivated)` : ""}`
              : "Never synced"}
            {lastRun?.error && (
              <span className="ml-2 text-red-600">{lastRun.error}</span>
            )}
          </p>
        </div>
        <ResyncButton />
      </div>

      {(!items || items.length === 0) ? (
        <p className="text-sm text-black/60">
          No catalog items yet. Click <strong>Resync now</strong> after adding your Google Sheets env vars.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-black/10">
              <tr>
                <th className="py-2 pr-4">SKU</th>
                <th className="pr-4">Name</th>
                <th className="pr-4">Category</th>
                <th className="pr-4">Kind</th>
                <th className="pr-4">Unit</th>
                <th className="pr-4">Unit $</th>
                <th className="pr-4">Labor $</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr
                  key={i.sku}
                  className={`border-b border-black/5 ${!i.active ? "opacity-40" : ""}`}
                >
                  <td className="py-1.5 pr-4 font-mono text-xs">{i.sku}</td>
                  <td className="pr-4">{i.name}</td>
                  <td className="pr-4">{i.category ?? "—"}</td>
                  <td className="pr-4">{i.kind}</td>
                  <td className="pr-4">{i.unit}</td>
                  <td className="pr-4">{i.unit_price != null ? `$${Number(i.unit_price).toFixed(2)}` : "—"}</td>
                  <td className="pr-4">{i.labor_rate != null ? `$${Number(i.labor_rate).toFixed(2)}` : "—"}</td>
                  <td>{i.active ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
