import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateOpportunityValue, uploadQuotePDFToOpportunity } from "@/lib/ghl";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePDF, type PdfQuote } from "@/lib/quote-pdf";
import { createElement } from "react";

// GET /api/quotes/:id — full quote with sections + line items
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote, error } = await supabase
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

  if (error || !quote) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Sort sections and items by sort_order
  const sections = ((quote.quote_sections ?? []) as SectionRow[])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({
      ...s,
      quote_line_items: [...s.quote_line_items].sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    }));

  return NextResponse.json({ ...quote, quote_sections: sections });
}

type LineItemRow = {
  id: string;
  catalog_item_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  is_labor: boolean;
  is_ad_hoc: boolean;
  sort_order: number;
};

type SectionRow = {
  id: string;
  title: string;
  sort_order: number;
  quote_line_items: LineItemRow[];
};

type PatchBody = {
  client_name?: string;
  site_address?: string;
  scope_narrative?: string;
  notes?: string;
  terms_md?: string;
  status?: "draft" | "final";
  ghl_opportunity_id?: string | null;
  sections?: Array<{
    title: string;
    items: Array<{
      catalog_item_id?: string | null;
      description: string;
      quantity: number;
      unit: string;
      unit_price: number;
      is_labor: boolean;
      is_ad_hoc: boolean;
    }>;
  }>;
};

// PATCH /api/quotes/:id — save edits (meta + full section/item replacement)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as PatchBody;

  // Fetch current quote status so we can detect transition to "final"
  const { data: currentQuote } = await supabase
    .from("quotes")
    .select("status, ghl_opportunity_id, client_name, site_address, scope_narrative, notes, terms_md, subtotal, tax_rate, tax, total, created_at")
    .eq("id", id)
    .single();

  // Compute totals if sections provided
  let totalsUpdate: Record<string, unknown> = {};
  if (body.sections) {
    const allItems = body.sections.flatMap((s) => s.items);
    const subtotal = allItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

    const { data: settings } = await supabase
      .from("settings")
      .select("default_tax_rate")
      .eq("id", 1)
      .single();
    const taxRate = Number(settings?.default_tax_rate ?? 0);
    const tax = subtotal * taxRate;

    totalsUpdate = {
      subtotal: subtotal.toFixed(2),
      tax_rate: taxRate,
      tax: tax.toFixed(2),
      total: (subtotal + tax).toFixed(2),
    };
  }

  // Update quote meta + totals
  const { error: qErr } = await supabase
    .from("quotes")
    .update({
      ...(body.client_name !== undefined && { client_name: body.client_name }),
      ...(body.site_address !== undefined && { site_address: body.site_address }),
      ...(body.scope_narrative !== undefined && { scope_narrative: body.scope_narrative }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.terms_md !== undefined && { terms_md: body.terms_md }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.ghl_opportunity_id !== undefined && { ghl_opportunity_id: body.ghl_opportunity_id }),
      ...totalsUpdate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  // Replace sections + items if provided
  if (body.sections) {
    // Delete existing sections (cascades to line items)
    await supabase.from("quote_sections").delete().eq("quote_id", id);

    for (let sIdx = 0; sIdx < body.sections.length; sIdx++) {
      const sec = body.sections[sIdx];
      const { data: sRow, error: sErr } = await supabase
        .from("quote_sections")
        .insert({ quote_id: id, title: sec.title, sort_order: sIdx })
        .select("id")
        .single();
      if (sErr || !sRow) return NextResponse.json({ error: sErr?.message }, { status: 500 });

      if (sec.items.length > 0) {
        const { error: liErr } = await supabase.from("quote_line_items").insert(
          sec.items.map((item, iIdx) => ({
            section_id: sRow.id,
            catalog_item_id: item.catalog_item_id ?? null,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            line_total: (item.quantity * item.unit_price).toFixed(2),
            is_labor: item.is_labor,
            is_ad_hoc: item.is_ad_hoc,
            sort_order: iIdx,
          })),
        );
        if (liErr) return NextResponse.json({ error: liErr.message }, { status: 500 });
      }
    }
  }

  // GHL sync: when transitioning to "final" and an opportunity is linked
  const goingFinal = body.status === "final" && currentQuote?.status !== "final";
  const opportunityId = body.ghl_opportunity_id ?? currentQuote?.ghl_opportunity_id;

  if (goingFinal && opportunityId) {
    // Resolve final totals (either freshly computed or from DB)
    const total = totalsUpdate.total
      ? Number(totalsUpdate.total)
      : Number(currentQuote?.total ?? 0);

    try {
      await updateOpportunityValue(opportunityId, total);
    } catch (err) {
      console.error("[GHL] opportunity value update failed:", err);
      // Non-fatal — quote is already saved as final
    }

    // Generate PDF and upload to GHL
    try {
      const { data: fullQuote } = await supabase
        .from("quotes")
        .select(`
          id, client_name, site_address, scope_narrative,
          notes, terms_md, subtotal, tax_rate, tax, total, created_at,
          quote_sections (
            title, sort_order,
            quote_line_items (
              description, quantity, unit, unit_price, sort_order
            )
          )
        `)
        .eq("id", id)
        .single();

      if (fullQuote) {
        const sections = [...(fullQuote.quote_sections ?? [])]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((s) => ({
            title: s.title,
            items: [...(s.quote_line_items ?? [])]
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((i) => ({
                description: i.description,
                quantity: Number(i.quantity),
                unit: i.unit,
                unit_price: Number(i.unit_price),
              })),
          }));

        const pdfQuote: PdfQuote = {
          id: fullQuote.id,
          client_name: fullQuote.client_name,
          site_address: fullQuote.site_address,
          scope_narrative: fullQuote.scope_narrative,
          notes: fullQuote.notes,
          terms_md: fullQuote.terms_md,
          subtotal: fullQuote.subtotal,
          tax_rate: fullQuote.tax_rate,
          tax: fullQuote.tax,
          total: fullQuote.total,
          created_at: fullQuote.created_at,
          sections,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const buffer = await renderToBuffer(createElement(QuotePDF, { quote: pdfQuote }) as any);
        const clientSlug = (fullQuote.client_name ?? "quote").replace(/\s+/g, "-").toLowerCase();
        const filename = `greenscape-${clientSlug}-${id.slice(0, 8)}.pdf`;

        await uploadQuotePDFToOpportunity(opportunityId, Buffer.from(buffer), filename);
      }
    } catch (err) {
      console.error("[GHL] PDF upload failed:", err);
      // Non-fatal
    }
  }

  return NextResponse.json({ ok: true });
}
