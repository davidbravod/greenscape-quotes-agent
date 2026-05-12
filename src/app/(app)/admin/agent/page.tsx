import { createClient } from "@/lib/supabase/server";
import { fetchFullCatalog, formatCatalogBlock, buildSystemPrompt } from "@/lib/agent";
import AgentInspector from "./agent-inspector";

const TOOL_DOCS = [
  {
    name: "get_item",
    description:
      "Fetches full details of a single catalog item by its UUID. Used only when the catalog table in the prompt is ambiguous (e.g. to check min_qty or description).",
    params: [{ name: "id", type: "string", required: true, description: "Catalog item UUID" }],
  },
];

const BEHAVIOR_RULES = [
  {
    label: "Catalog matching order",
    value: "Alias substring check → name/description semantic → ad-hoc (last resort only)",
  },
  {
    label: "Allowed units",
    value: "ea · sq_ft · lin_ft · cu_yd · ton · hr  —  no other units accepted",
  },
  {
    label: "Pricing — material",
    value: "unit_price × quantity",
  },
  {
    label: "Pricing — labor",
    value: "labor_rate × quantity  (is_labor: true)",
  },
  {
    label: "Pricing — composite",
    value: "unit_price all-in (already includes labor)",
  },
  {
    label: "Ambiguous quantities",
    value: "Never auto-pick. Output the range and add to assumptions_for_estimator_to_confirm.",
  },
  {
    label: "Verification pass",
    value: "Re-scan every ad-hoc flagged item against aliases before finalizing output.",
  },
  {
    label: "Notes discipline",
    value: "Notes only for genuine uncertainty. No second-guessing correctly priced items.",
  },
];

export default async function AgentAdminPage() {
  const supabase = await createClient();
  const rows = await fetchFullCatalog(supabase);
  const catalogBlock = formatCatalogBlock(rows);
  const systemPrompt = buildSystemPrompt(catalogBlock);

  const { data: settings } = await supabase
    .from("settings")
    .select("agent_model")
    .eq("id", 1)
    .single();

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">Agent</h1>
        <p className="text-sm text-black/50 mt-1">
          Live view of what the quote-drafting agent sees. Prompt is compiled fresh from the current catalog on every quote run.
        </p>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-6 text-sm">
        <div>
          <p className="text-xs text-black/40 uppercase tracking-wide mb-0.5">Model</p>
          <p className="font-mono">{settings?.agent_model ?? "anthropic/claude-sonnet-4-6 (default)"}</p>
        </div>
        <div>
          <p className="text-xs text-black/40 uppercase tracking-wide mb-0.5">Catalog rows in prompt</p>
          <p className="font-mono">{rows.length} active items</p>
        </div>
        <div>
          <p className="text-xs text-black/40 uppercase tracking-wide mb-0.5">Prompt length</p>
          <p className="font-mono">~{Math.round(systemPrompt.length / 4).toLocaleString()} tokens (est.)</p>
        </div>
      </div>

      {/* Behavior rules */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 mb-3">Behavior Rules</h2>
        <div className="border border-black/10 divide-y divide-black/5">
          {BEHAVIOR_RULES.map((rule) => (
            <div key={rule.label} className="flex gap-4 px-4 py-3 text-sm">
              <span className="text-black/40 shrink-0 w-48">{rule.label}</span>
              <span>{rule.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Tools */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 mb-3">Tools</h2>
        <div className="space-y-3">
          {TOOL_DOCS.map((tool) => (
            <div key={tool.name} className="border border-black/10 px-4 py-3 text-sm space-y-2">
              <p className="font-mono font-semibold">{tool.name}</p>
              <p className="text-black/60">{tool.description}</p>
              <div className="space-y-1">
                {tool.params.map((p) => (
                  <div key={p.name} className="flex gap-3 text-xs">
                    <span className="font-mono text-black/50 w-20 shrink-0">{p.name}</span>
                    <span className="text-black/40">{p.type}{p.required ? " · required" : " · optional"}</span>
                    <span className="text-black/60">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive parts: prompt viewer + test run */}
      <AgentInspector systemPrompt={systemPrompt} defaultModel={settings?.agent_model ?? null} />
    </div>
  );
}
