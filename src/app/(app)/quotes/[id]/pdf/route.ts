import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { QuotePDF, type PdfQuote } from "@/lib/quote-pdf";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
// PDF generation can take a moment for large quotes
export const maxDuration = 30;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
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

  if (!quote) notFound();

  const sections = [...(quote.quote_sections ?? [])]
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
    id: quote.id,
    client_name: quote.client_name,
    site_address: quote.site_address,
    scope_narrative: quote.scope_narrative,
    notes: quote.notes,
    terms_md: quote.terms_md,
    subtotal: quote.subtotal,
    tax_rate: quote.tax_rate,
    tax: quote.tax,
    total: quote.total,
    created_at: quote.created_at,
    sections,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(QuotePDF, { quote: pdfQuote }) as any);
  const clientSlug = (quote.client_name ?? "quote").replace(/\s+/g, "-").toLowerCase();
  const filename = `greenscape-${clientSlug}-${id.slice(0, 8)}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
