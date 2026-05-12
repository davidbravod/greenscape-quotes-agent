import { chat, type ChatMessage } from "@/lib/openrouter";
import { QuoteDraft, type QuoteDraft as QuoteDraftType } from "@/lib/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_AGENT_MODEL = "anthropic/claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 10;

// ── Catalog types ──────────────────────────────────────────────────────────

interface CatalogRow {
  id: string;
  sku: string;
  name: string;
  aliases: string | null;
  category: string | null;
  kind: string;
  unit: string;
  unit_price: number | null;
  labor_rate: number | null;
  labor_unit: string | null;
}

// ── Fetch full catalog ─────────────────────────────────────────────────────

export async function fetchFullCatalog(supabase: SupabaseClient): Promise<CatalogRow[]> {
  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, sku, name, aliases, category, kind, unit, unit_price, labor_rate, labor_unit")
    .eq("active", true)
    .order("category")
    .order("name");
  if (error) throw new Error(`Failed to load catalog: ${error.message}`);
  return (data ?? []) as CatalogRow[];
}

export function formatCatalogBlock(rows: CatalogRow[]): string {
  const lines = rows.map((r) => {
    const price = r.unit_price != null ? `$${r.unit_price}` : "-";
    const labor = r.labor_rate != null ? `$${r.labor_rate}/${r.labor_unit ?? "unit"}` : "-";
    const aliases = r.aliases ?? "";
    return `${r.id}\t${r.sku}\t${r.name}\t${aliases}\t${r.category ?? ""}\t${r.kind}\t${r.unit}\t${price}\t${labor}`;
  });
  return [
    "id\tsku\tname\taliases\tcategory\tkind\tunit\tunit_price\tlabor_rate",
    ...lines,
  ].join("\n");
}

// ── Tool definitions ───────────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_item",
      description:
        "Fetches full details of a single catalog item by its UUID. Use only when the catalog table above is ambiguous and you need to confirm something (e.g. min_qty, description).",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The catalog item UUID from the catalog table" },
        },
        required: ["id"],
      },
    },
  },
] as const;

// ── Tool execution ─────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, string | undefined>,
  supabase: SupabaseClient,
): Promise<string> {
  if (name === "get_item") {
    const { data, error } = await supabase
      .from("catalog_items")
      .select("id, sku, name, aliases, category, kind, unit, unit_price, labor_rate, labor_unit, min_qty, description")
      .eq("id", args.id ?? "")
      .single();
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify(data);
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

// ── System prompt ──────────────────────────────────────────────────────────

export function buildSystemPrompt(catalogBlock: string): string {
  return `You are a senior landscape and hardscape estimator for Greenscape Pro (Phoenix, AZ).
Your job is to listen to a site-walk recording transcript and produce a professional, itemized quote draft.

## FULL CATALOG
Every active catalog item is in the TSV table below (columns: id, sku, name, aliases, category, kind, unit, unit_price, labor_rate).
You MUST scan this table — every row — before deciding any item is not in the catalog.

\`\`\`
${catalogBlock}
\`\`\`

## How to match transcript items to catalog rows

For each material, plant, service, or task the estimator mentions:

1. **Alias check first (mandatory).** Lowercase the customer phrase. For each row, lowercase the aliases column and split by "|". Check whether any alias token is a substring of the customer phrase, or the customer phrase is a substring of any alias token. If exactly one row matches → use it (confidence = high). If multiple rows match → add all candidates to assumptions_for_estimator_to_confirm and let Marcus choose; do not pick.

2. **Name/description fallback.** If zero alias matches, check the name and description columns for semantic similarity. If one row is clearly the right item → use it (confidence = high). If uncertain → flag as needs-review.

3. **Ad-hoc only as last resort.** If zero rows match with any reasonable confidence after scanning every row: set is_ad_hoc: true, catalog_item_id: null, unit_price: 0. Describe the item clearly and add it to assumptions_for_estimator_to_confirm. NEVER call something ad-hoc without first having checked every alias in the table.

4. **Verification pass (required before output).** After building every section, revisit each item you flagged as ad-hoc or needs-review. Re-scan the alias column one more time for each. If you find a match you missed, promote it to a catalog item.

## Quantities and units

- **Allowed units:** ea, sq_ft, lin_ft, cu_yd, ton, hr — use only these. Never invent new units.
- **Ambiguous quantities:** If the estimator gave a range (e.g. "two to two and a half tons"), do NOT pick a number. Output both endpoints and add the item to assumptions_for_estimator_to_confirm for Marcus to decide.
- Estimate quantities from context when a single clear number is stated. If truly unknown, use 0 and flag it.

## Pricing rules

- NEVER invent a price. Always use unit_price and/or labor_rate from the catalog row.
- **material** kind: line_price = unit_price × quantity.
- **labor** kind: set is_labor: true; unit_price = labor_rate × quantity (hours/units).
- **composite** kind: unit_price is all-in (already includes labor); use it directly.

## Notes discipline

- Only add a note for genuine uncertainty or a flagged item.
- Do NOT write notes that second-guess a line item you already priced correctly from the catalog.
- Do NOT narrate your matching process in notes.

## Output

Extract client_name and site_address from the transcript if mentioned.
Write scope_narrative as a professional 2–4 sentence summary.
Group line items into logical sections (e.g. Demolition, Hardscape, Softscape, Irrigation, Lighting).

When done, output ONLY a valid JSON object — no markdown, no explanation:

{
  "client_name": string | null,
  "site_address": string | null,
  "scope_narrative": string,
  "sections": [
    {
      "title": string,
      "items": [
        {
          "catalog_item_id": string (UUID) | null,
          "description": string,
          "quantity": number,
          "unit": string,
          "unit_price": number,
          "is_labor": boolean,
          "is_ad_hoc": boolean
        }
      ]
    }
  ],
  "notes": string,
  "terms_md": string,
  "assumptions_for_estimator_to_confirm": string[]
}`;
}

// ── Main agent function ────────────────────────────────────────────────────

function extractJson(content: string): string {
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : content.trim();
}

export async function draftQuote(
  transcript: string,
  supabase: SupabaseClient,
  agentModel?: string | null,
): Promise<QuoteDraftType> {
  const model = agentModel ?? DEFAULT_AGENT_MODEL;

  const catalogRows = await fetchFullCatalog(supabase);
  const catalogBlock = formatCatalogBlock(catalogRows);
  const systemPrompt = buildSystemPrompt(catalogBlock);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Here is the site-walk transcript. Produce the quote draft.\n\n---\n${transcript}\n---`,
    },
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await chat({
      model,
      messages,
      tools: TOOLS as unknown as unknown[],
      tool_choice: "auto",
      temperature: 0.2,
    });

    const choice = response.choices?.[0];
    if (!choice) throw new Error("OpenRouter returned no choices");

    const msg = choice.message;
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const raw = extractJson(msg.content ?? "");
      const parsed = JSON.parse(raw);
      return QuoteDraft.parse(parsed);
    }

    for (const tc of msg.tool_calls) {
      const args = JSON.parse(tc.function.arguments ?? "{}") as Record<string, string | undefined>;
      const result = await executeTool(tc.function.name, args, supabase);
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  throw new Error("Agent exceeded maximum tool iterations without producing a quote");
}
