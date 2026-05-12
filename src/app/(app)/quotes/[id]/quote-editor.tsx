"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import Link from "next/link";
import CatalogPicker, { type PickedItem } from "./catalog-picker";

// ── Types ──────────────────────────────────────────────────────────────────

type LineItem = {
  id?: string;
  catalog_item_id?: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total?: number;
  is_labor: boolean;
  is_ad_hoc: boolean;
  sort_order?: number;
};

type Section = {
  id?: string;
  title: string;
  sort_order?: number;
  quote_line_items: LineItem[];
};

type Quote = {
  id: string;
  status: string;
  client_name: string | null;
  site_address: string | null;
  scope_narrative: string | null;
  notes: string | null;
  terms_md: string | null;
  assumptions: string[] | null;
  subtotal: number | null;
  tax_rate: number | null;
  tax: number | null;
  total: number | null;
  quote_sections: Section[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function computeTotals(sections: Section[], taxRate: number) {
  const subtotal = sections
    .flatMap((s) => s.quote_line_items)
    .reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const tax = subtotal * taxRate;
  return { subtotal, tax, total: subtotal + tax };
}

function emptyItem(): LineItem {
  return { description: "", quantity: 1, unit: "ea", unit_price: 0, is_labor: false, is_ad_hoc: true };
}

// ── Component ──────────────────────────────────────────────────────────────

export default function QuoteEditor({
  initialQuote,
  isAdmin = false,
}: {
  initialQuote: Quote;
  isAdmin?: boolean;
}) {
  const [quote, setQuote] = useState<Quote>(initialQuote);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // null = closed, number = section index that has the picker open
  const [pickerSectionIdx, setPickerSectionIdx] = useState<number | null>(null);

  const taxRate = Number(quote.tax_rate ?? 0);
  const { subtotal, tax, total } = computeTotals(quote.quote_sections, taxRate);

  // ── Field updaters ───────────────────────────────────────────────────────

  function updateMeta<K extends keyof Quote>(key: K, value: Quote[K]) {
    setQuote((q) => ({ ...q, [key]: value }));
    setDirty(true);
  }

  const updateSection = useCallback((sIdx: number, title: string) => {
    setQuote((q) => {
      const sections = q.quote_sections.map((s, i) =>
        i === sIdx ? { ...s, title } : s,
      );
      return { ...q, quote_sections: sections };
    });
    setDirty(true);
  }, []);

  const updateItem = useCallback(
    (sIdx: number, iIdx: number, patch: Partial<LineItem>) => {
      setQuote((q) => {
        const sections = q.quote_sections.map((s, si) => {
          if (si !== sIdx) return s;
          return {
            ...s,
            quote_line_items: s.quote_line_items.map((item, ii) =>
              ii === iIdx ? { ...item, ...patch } : item,
            ),
          };
        });
        return { ...q, quote_sections: sections };
      });
      setDirty(true);
    },
    [],
  );

  const addItem = useCallback((sIdx: number) => {
    setQuote((q) => {
      const sections = q.quote_sections.map((s, si) =>
        si === sIdx
          ? { ...s, quote_line_items: [...s.quote_line_items, emptyItem()] }
          : s,
      );
      return { ...q, quote_sections: sections };
    });
    setDirty(true);
  }, []);

  const addFromCatalog = useCallback((sIdx: number, picked: PickedItem) => {
    setQuote((q) => {
      const sections = q.quote_sections.map((s, si) =>
        si === sIdx
          ? { ...s, quote_line_items: [...s.quote_line_items, picked] }
          : s,
      );
      return { ...q, quote_sections: sections };
    });
    setDirty(true);
    setPickerSectionIdx(null);
  }, []);

  const removeItem = useCallback((sIdx: number, iIdx: number) => {
    setQuote((q) => {
      const sections = q.quote_sections.map((s, si) =>
        si === sIdx
          ? { ...s, quote_line_items: s.quote_line_items.filter((_, ii) => ii !== iIdx) }
          : s,
      );
      return { ...q, quote_sections: sections };
    });
    setDirty(true);
  }, []);

  const addSection = useCallback(() => {
    setQuote((q) => ({
      ...q,
      quote_sections: [...q.quote_sections, { title: "New section", quote_line_items: [] }],
    }));
    setDirty(true);
  }, []);

  const removeSection = useCallback((sIdx: number) => {
    setQuote((q) => ({
      ...q,
      quote_sections: q.quote_sections.filter((_, i) => i !== sIdx),
    }));
    setDirty(true);
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────

  async function save(overrideStatus?: "draft" | "final") {
    setSaving(true);
    const res = await fetch(`/api/quotes/${quote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: quote.client_name,
        site_address: quote.site_address,
        scope_narrative: quote.scope_narrative,
        notes: quote.notes,
        terms_md: quote.terms_md,
        status: overrideStatus ?? quote.status,
        sections: quote.quote_sections.map((s) => ({
          title: s.title,
          items: s.quote_line_items.map((i) => ({
            catalog_item_id: i.catalog_item_id ?? null,
            description: i.description,
            quantity: Number(i.quantity),
            unit: i.unit,
            unit_price: Number(i.unit_price),
            is_labor: i.is_labor,
            is_ad_hoc: i.is_ad_hoc,
          })),
        })),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      if (overrideStatus) {
        setQuote((q) => ({ ...q, status: overrideStatus }));
        toast.success(overrideStatus === "final" ? "Quote marked as final" : "Reverted to draft");
      } else {
        toast.success("Saved");
      }
    } else {
      toast.error("Save failed — try again");
    }
  }

  const isFinal = quote.status === "final";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <input
            disabled={isFinal}
            value={quote.client_name ?? ""}
            onChange={(e) => updateMeta("client_name", e.target.value)}
            placeholder="Client name"
            className="text-xl font-semibold bg-transparent border-b border-transparent hover:border-black/20 focus:border-black focus:outline-none w-full disabled:opacity-60"
          />
          <input
            disabled={isFinal}
            value={quote.site_address ?? ""}
            onChange={(e) => updateMeta("site_address", e.target.value)}
            placeholder="Site address"
            className="text-sm text-black/60 bg-transparent border-b border-transparent hover:border-black/20 focus:border-black focus:outline-none w-full disabled:opacity-60"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={isFinal ? "default" : "outline"}>
            {isFinal ? "Final" : "Draft"}
          </Badge>
          {isFinal && isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => save("draft")}
              disabled={saving}
            >
              Back to draft
            </Button>
          )}
          {!isFinal && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => save()}
                disabled={saving || !dirty}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                onClick={() => save("final")}
                disabled={saving}
              >
                Mark as final
              </Button>
            </>
          )}
          <Link
            href={`/quotes/${quote.id}/pdf`}
            target="_blank"
            className="border border-black px-3 py-1.5 text-sm hover:bg-black hover:text-white"
          >
            Export PDF
          </Link>
        </div>
      </div>

      {/* Assumptions panel */}
      {(quote.assumptions ?? []).length > 0 && (
        <div className="border border-black/20 p-4 space-y-2">
          <p className="text-sm font-medium">
            Review these assumptions before finalising
          </p>
          <ul className="space-y-1">
            {(quote.assumptions ?? []).map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-black/70">
                <span className="mt-0.5 shrink-0">·</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scope narrative */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-black/40">
          Scope of work
        </label>
        <Textarea
          disabled={isFinal}
          rows={4}
          value={quote.scope_narrative ?? ""}
          onChange={(e) => updateMeta("scope_narrative", e.target.value)}
          placeholder="Describe the scope of work for the client…"
          className="resize-none"
        />
      </div>

      <Separator />

      {/* Sections */}
      <div className="space-y-8">
        {quote.quote_sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-3">
            {/* Section title */}
            <div className="flex items-center justify-between gap-2">
              <input
                disabled={isFinal}
                value={section.title}
                onChange={(e) => updateSection(sIdx, e.target.value)}
                className="font-semibold bg-transparent border-b border-transparent hover:border-black/20 focus:border-black focus:outline-none flex-1 disabled:opacity-60"
              />
              {!isFinal && (
                <button
                  onClick={() => removeSection(sIdx)}
                  className="text-xs text-black/30 hover:text-black"
                >
                  Remove section
                </button>
              )}
            </div>

            {/* Line items table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-black/40 border-b border-black/10">
                  <tr>
                    <th className="pb-1.5 font-normal pr-4 w-full">Description</th>
                    <th className="pb-1.5 font-normal pr-4 whitespace-nowrap">Qty</th>
                    <th className="pb-1.5 font-normal pr-4">Unit</th>
                    <th className="pb-1.5 font-normal pr-4 whitespace-nowrap">Unit price</th>
                    <th className="pb-1.5 font-normal text-right whitespace-nowrap">Total</th>
                    {!isFinal && <th />}
                  </tr>
                </thead>
                <tbody>
                  {section.quote_line_items.map((item, iIdx) => (
                    <tr key={iIdx} className="border-b border-black/5 group">
                      <td className="py-1.5 pr-4">
                        <input
                          disabled={isFinal}
                          value={item.description}
                          onChange={(e) => updateItem(sIdx, iIdx, { description: e.target.value })}
                          className="w-full bg-transparent border-b border-transparent focus:border-black focus:outline-none disabled:opacity-60"
                        />
                        {item.is_ad_hoc && (
                          <span className="text-xs text-black/30 ml-1">ad hoc</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-4">
                        <input
                          disabled={isFinal}
                          type="number"
                          min={0}
                          step="any"
                          value={item.quantity}
                          onChange={(e) => updateItem(sIdx, iIdx, { quantity: parseFloat(e.target.value) || 0 })}
                          className="w-20 bg-transparent border-b border-transparent focus:border-black focus:outline-none text-right disabled:opacity-60"
                        />
                      </td>
                      <td className="py-1.5 pr-4">
                        <input
                          disabled={isFinal}
                          value={item.unit}
                          onChange={(e) => updateItem(sIdx, iIdx, { unit: e.target.value })}
                          className="w-16 bg-transparent border-b border-transparent focus:border-black focus:outline-none disabled:opacity-60"
                        />
                      </td>
                      <td className="py-1.5 pr-4">
                        <input
                          disabled={isFinal}
                          type="number"
                          min={0}
                          step="any"
                          value={item.unit_price}
                          onChange={(e) => updateItem(sIdx, iIdx, { unit_price: parseFloat(e.target.value) || 0 })}
                          className="w-24 bg-transparent border-b border-transparent focus:border-black focus:outline-none text-right disabled:opacity-60"
                        />
                      </td>
                      <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                        {fmt(item.quantity * item.unit_price)}
                      </td>
                      {!isFinal && (
                        <td className="py-1.5 pl-3">
                          <button
                            onClick={() => removeItem(sIdx, iIdx)}
                            className="text-black/20 hover:text-black opacity-0 group-hover:opacity-100 text-lg leading-none"
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isFinal && (
              <div className="space-y-2">
                {pickerSectionIdx === sIdx ? (
                  <CatalogPicker
                    onSelect={(picked) => addFromCatalog(sIdx, picked)}
                    onCancel={() => setPickerSectionIdx(null)}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPickerSectionIdx(sIdx)}
                      className="text-sm text-black/40 hover:text-black"
                    >
                      + From catalog
                    </button>
                    <span className="text-black/20">|</span>
                    <button
                      onClick={() => addItem(sIdx)}
                      className="text-sm text-black/40 hover:text-black"
                    >
                      + Ad hoc
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {!isFinal && (
          <button
            onClick={addSection}
            className="text-sm text-black/40 hover:text-black border border-dashed border-black/20 px-4 py-2 w-full hover:border-black/40"
          >
            + Add section
          </button>
        )}
      </div>

      <Separator />

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-black/60">Subtotal</span>
            <span className="tabular-nums">{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-black/60">
              Tax ({(taxRate * 100).toFixed(2)}%)
            </span>
            <span className="tabular-nums">{fmt(tax)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{fmt(total)}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Notes + Terms */}
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-black/40">
            Notes
          </label>
          <Textarea
            disabled={isFinal}
            rows={4}
            value={quote.notes ?? ""}
            onChange={(e) => updateMeta("notes", e.target.value)}
            placeholder="Internal notes or site observations…"
            className="resize-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-black/40">
            Payment terms
          </label>
          <Textarea
            disabled={isFinal}
            rows={4}
            value={quote.terms_md ?? ""}
            onChange={(e) => updateMeta("terms_md", e.target.value)}
            placeholder="e.g. 50% deposit required. Balance due on completion."
            className="resize-none"
          />
        </div>
      </div>

      {/* Sticky save reminder */}
      {dirty && !isFinal && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-white border border-black shadow-sm px-4 py-2">
          <span className="text-sm text-black/60">Unsaved changes</span>
          <Button size="sm" onClick={() => save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
