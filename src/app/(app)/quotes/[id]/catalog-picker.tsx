"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

type CatalogItem = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  kind: "material" | "labor" | "composite";
  unit: string;
  unit_price: number | null;
  labor_rate: number | null;
  labor_unit: string | null;
  description: string | null;
};

export type PickedItem = {
  catalog_item_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  is_labor: boolean;
  is_ad_hoc: false;
};

export default function CatalogPicker({
  onSelect,
  onCancel,
}: {
  onSelect: (item: PickedItem) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Load top items on mount
    search("");
  }, []);

  function search(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(query)}&limit=8`);
      const data = (await res.json()) as CatalogItem[];
      setResults(data);
      setLoading(false);
    }, 200);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQ(e.target.value);
    search(e.target.value);
  }

  function pick(item: CatalogItem) {
    // Determine unit price: labor items use labor_rate, others use unit_price
    const isLabor = item.kind === "labor";
    const unitPrice = isLabor
      ? Number(item.labor_rate ?? 0)
      : Number(item.unit_price ?? 0);
    const unit = isLabor && item.labor_unit ? item.labor_unit : item.unit;

    onSelect({
      catalog_item_id: item.id,
      description: item.name,
      quantity: 1,
      unit,
      unit_price: unitPrice,
      is_labor: isLabor,
      is_ad_hoc: false,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="border border-black/20 bg-white shadow-sm">
      <div className="p-2 border-b border-black/10">
        <Input
          ref={inputRef}
          value={q}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search catalog (name, alias, SKU)…"
          className="h-8 text-sm"
        />
      </div>

      <ul className="max-h-56 overflow-y-auto divide-y divide-black/5">
        {loading && (
          <li className="px-3 py-2 text-sm text-black/40">Searching…</li>
        )}
        {!loading && results.length === 0 && (
          <li className="px-3 py-2 text-sm text-black/40">No matches</li>
        )}
        {!loading && results.map((item) => {
          const price = item.kind === "labor"
            ? item.labor_rate
            : item.unit_price;
          const unit = item.kind === "labor" && item.labor_unit
            ? item.labor_unit
            : item.unit;

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => pick(item)}
                className="w-full text-left px-3 py-2 hover:bg-black/5 flex items-center justify-between gap-4"
              >
                <div>
                  <span className="text-sm">{item.name}</span>
                  {item.category && (
                    <span className="ml-2 text-xs text-black/40">{item.category}</span>
                  )}
                </div>
                <div className="text-xs text-black/50 whitespace-nowrap shrink-0">
                  {price != null ? `$${Number(price).toFixed(2)}` : "—"} / {unit}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="px-3 py-1.5 border-t border-black/10">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-black/40 hover:text-black"
        >
          Cancel (Esc)
        </button>
      </div>
    </div>
  );
}
