import { chat, type ChatMessage } from "@/lib/openrouter";
import { QuoteDraft, type QuoteDraft as QuoteDraftType } from "@/lib/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_AGENT_MODEL = "anthropic/claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 20;

// ── Tool definitions (OpenAI function-calling format) ──────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_categories",
      description:
        "Returns every distinct category in the catalog. Call this first to understand what is available before searching.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_catalog",
      description:
        "Fuzzy-searches the catalog by name or alias. Returns up to 10 matches with pricing. Use this to find the right catalog item for each material or task mentioned in the transcript.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The material, plant, or service to search for (e.g. 'flagstone', 'drip emitter', 'fan palm')",
          },
          category: {
            type: "string",
            description: "Optional category filter to narrow results (e.g. 'Hardscape', 'Softscape', 'Irrigation')",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_item",
      description: "Fetches the full details of a single catalog item by its UUID. Use this when you need to confirm pricing or labor details before placing a line item.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The catalog item UUID" },
        },
        required: ["id"],
      },
    },
  },
] as const;

// ── Tool execution ─────────────────────────────────────────────────────────

type ToolArgs = Record<string, string | undefined>;

async function executeTool(
  name: string,
  args: ToolArgs,
  supabase: SupabaseClient,
): Promise<string> {
  if (name === "list_categories") {
    const { data } = await supabase
      .from("catalog_items")
      .select("category")
      .eq("active", true)
      .not("category", "is", null)
      .order("category");
    const cats = [...new Set((data ?? []).map((r) => r.category as string))];
    return JSON.stringify(cats);
  }

  if (name === "search_catalog") {
    const q = args.query ?? "";
    let query = supabase
      .from("catalog_items")
      .select("id, sku, name, aliases, category, kind, unit, unit_price, labor_rate, labor_unit, description")
      .eq("active", true)
      .or(`name.ilike.%${q}%,aliases.ilike.%${q}%`)
      .limit(10);
    if (args.category) query = query.eq("category", args.category);
    const { data, error } = await query;
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify(data ?? []);
  }

  if (name === "get_item") {
    const { data, error } = await supabase
      .from("catalog_items")
      .select("id, sku, name, category, kind, unit, unit_price, labor_rate, labor_unit, min_qty, description")
      .eq("id", args.id ?? "")
      .single();
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify(data);
  }

  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

// ── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior landscape and hardscape estimator for Greenscape Pro (Phoenix, AZ).
Your job is to listen to a site-walk recording transcript and produce a professional, itemized quote draft.

## Process
1. Call list_categories to see what the catalog contains.
2. For every material, plant, service, or task mentioned in the transcript, call search_catalog to find the matching catalog item. Use the aliases to help match slang or shorthand.
3. If a search returns multiple plausible matches, call get_item on the most relevant one to confirm pricing.
4. Estimate quantities from the transcript. If the estimator said "about 200 square feet of flagstone", use 200. If unclear, make a reasonable estimate and add it to assumptions_for_estimator_to_confirm.
5. If no catalog item matches, set is_ad_hoc: true and leave catalog_item_id: null. Describe the item clearly and price it at 0 — the estimator will fill it in.
6. Group line items into logical sections (e.g. Demolition, Hardscape, Softscape, Irrigation, Lighting).

## Rules
- NEVER invent a price. Always use unit_price and/or labor_rate from the catalog item.
- For "material" kind items: unit_price is the all-in per-unit cost.
- For "labor" kind items: unit_price should be labor_rate × estimated hours/units; set is_labor: true.
- For "composite" kind items: unit_price is the all-in per-unit cost (already includes labor).
- Always extract client_name and site_address from the transcript if the estimator mentioned them.
- Write scope_narrative as a professional 2–4 sentence summary of the work for the client.
- List every uncertainty, assumed quantity, or missing detail in assumptions_for_estimator_to_confirm.

## Output
When you are done with all tool calls, output ONLY a valid JSON object matching this schema — no markdown, no explanation:

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

// ── Main agent function ────────────────────────────────────────────────────

function extractJson(content: string): string {
  // Try to find a ```json block first, then fall back to raw content
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : content.trim();
}

export async function draftQuote(
  transcript: string,
  supabase: SupabaseClient,
  agentModel?: string | null,
): Promise<QuoteDraftType> {
  const model = agentModel ?? DEFAULT_AGENT_MODEL;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Here is the site-walk transcript. Please produce the quote draft.\n\n---\n${transcript}\n---`,
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

    // No tool calls → agent is done, parse the JSON output
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const raw = extractJson(msg.content ?? "");
      const parsed = JSON.parse(raw);
      return QuoteDraft.parse(parsed);
    }

    // Execute each tool call and feed results back
    for (const tc of msg.tool_calls) {
      const args = JSON.parse(tc.function.arguments ?? "{}") as ToolArgs;
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
