import { z } from "zod";

export const CatalogKind = z.enum(["material", "labor", "composite"]);
export type CatalogKind = z.infer<typeof CatalogKind>;

export const QuoteLineItem = z.object({
  catalog_item_id: z.string().uuid().nullable(),
  description: z.string(),
  quantity: z.number().nonnegative(),
  unit: z.string(),
  unit_price: z.number().nonnegative(),
  is_labor: z.boolean().default(false),
  is_ad_hoc: z.boolean().default(false),
});

export const QuoteSection = z.object({
  title: z.string(),
  items: z.array(QuoteLineItem),
});

export const QuoteDraft = z.object({
  client_name: z.string().nullable(),
  site_address: z.string().nullable(),
  scope_narrative: z.string(),
  sections: z.array(QuoteSection),
  notes: z.string().default(""),
  terms_md: z.string().default(""),
  assumptions_for_estimator_to_confirm: z.array(z.string()).default([]),
});
export type QuoteDraft = z.infer<typeof QuoteDraft>;
