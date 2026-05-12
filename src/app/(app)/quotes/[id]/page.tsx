import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import QuoteEditor from "./quote-editor";

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(`
      id, status, client_name, site_address, scope_narrative,
      notes, terms_md, assumptions, subtotal, tax_rate, tax, total,
      ghl_opportunity_id,
      quote_sections (
        id, title, sort_order,
        quote_line_items (
          id, catalog_item_id, description, quantity, unit,
          unit_price, line_total, is_labor, is_ad_hoc, sort_order
        )
      )
    `)
    .eq("id", id)
    .single();

  if (!quote) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user!.id)
    .single();
  const isAdmin = profile?.role === "admin";

  // Sort sections and items by sort_order before passing to client
  const sections = [...(quote.quote_sections ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((s) => ({
      ...s,
      quote_line_items: [...(s.quote_line_items ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
    }));

  return <QuoteEditor initialQuote={{ ...quote, quote_sections: sections }} isAdmin={isAdmin} />;
}
