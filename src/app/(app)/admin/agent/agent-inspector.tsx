"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { QuoteDraft } from "@/lib/schemas";

type TestResult =
  | { ok: true; draft: QuoteDraft; elapsed: number }
  | { ok: false; error: string };

export default function AgentInspector({
  systemPrompt,
  defaultModel,
}: {
  systemPrompt: string;
  defaultModel: string | null;
}) {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function copyPrompt() {
    await navigator.clipboard.writeText(systemPrompt);
    toast.success("Prompt copied to clipboard");
  }

  async function runTest() {
    if (!transcript.trim()) return;
    setRunning(true);
    setResult(null);
    const start = Date.now();
    try {
      const res = await fetch("/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json() as { ok: boolean; draft?: QuoteDraft; error?: string };
      const elapsed = Date.now() - start;
      if (data.ok && data.draft) {
        setResult({ ok: true, draft: data.draft, elapsed });
      } else {
        setResult({ ok: false, error: data.error ?? "Unknown error" });
      }
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      {/* System prompt viewer */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40">System Prompt</h2>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copyPrompt}>
              Copy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPromptExpanded((v) => !v)}
            >
              {promptExpanded ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>
        <div
          className={`border border-black/10 bg-black/[0.02] overflow-auto transition-all ${
            promptExpanded ? "max-h-[60vh]" : "max-h-48"
          }`}
        >
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed text-black/70">
            {systemPrompt}
          </pre>
        </div>
        {!promptExpanded && (
          <p className="text-xs text-black/30 mt-1 text-center">
            — scroll or click Expand to see full prompt —
          </p>
        )}
      </section>

      {/* Test run */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 mb-1">Test Run</h2>
          <p className="text-xs text-black/40">
            Paste a transcript and run the agent against the live catalog. Uses the configured agent model
            {defaultModel ? ` (${defaultModel})` : ""}.
          </p>
        </div>
        <Textarea
          rows={8}
          placeholder="Paste a site-walk transcript here…"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          className="font-mono text-xs"
          disabled={running}
        />
        <Button onClick={runTest} disabled={running || !transcript.trim()}>
          {running ? "Running agent…" : "Run agent"}
        </Button>

        {result && (
          <div className="mt-4 space-y-2">
            {result.ok ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                    Success
                  </span>
                  <span className="text-xs text-black/40">{(result.elapsed / 1000).toFixed(1)}s</span>
                  <QuoteSummaryBadges draft={result.draft} />
                </div>
                <QuoteDraftView draft={result.draft} />
              </>
            ) : (
              <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p className="font-semibold mb-1">Agent error</p>
                <p className="font-mono text-xs whitespace-pre-wrap">{result.error}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}

function QuoteSummaryBadges({ draft }: { draft: QuoteDraft }) {
  const totalItems = draft.sections.reduce((n, s) => n + s.items.length, 0);
  const adHocItems = draft.sections.reduce(
    (n, s) => n + s.items.filter((i) => i.is_ad_hoc).length,
    0,
  );
  const catalogItems = totalItems - adHocItems;
  const totalValue = draft.sections.reduce(
    (sum, s) => sum + s.items.reduce((si, i) => si + i.quantity * i.unit_price, 0),
    0,
  );

  return (
    <div className="flex gap-2 flex-wrap">
      <Badge label={`${totalItems} line items`} />
      <Badge label={`${catalogItems} catalog`} color="green" />
      {adHocItems > 0 && <Badge label={`${adHocItems} ad-hoc`} color="amber" />}
      {draft.assumptions_for_estimator_to_confirm.length > 0 && (
        <Badge label={`${draft.assumptions_for_estimator_to_confirm.length} assumptions`} color="amber" />
      )}
      <Badge label={`$${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} />
    </div>
  );
}

function Badge({
  label,
  color = "default",
}: {
  label: string;
  color?: "default" | "green" | "amber";
}) {
  const cls = {
    default: "bg-black/5 text-black/50",
    green: "bg-green-50 text-green-700 border border-green-200",
    amber: "bg-amber-50 text-amber-700 border border-amber-200",
  }[color];
  return <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>{label}</span>;
}

function QuoteDraftView({ draft }: { draft: QuoteDraft }) {
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="border border-black/10 text-sm space-y-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-black/5 flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{draft.client_name ?? "No client name"}</p>
          {draft.site_address && <p className="text-xs text-black/50">{draft.site_address}</p>}
          {draft.scope_narrative && (
            <p className="text-xs text-black/60 mt-1 italic">{draft.scope_narrative}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowJson((v) => !v)}
          className="text-xs text-black/30 hover:text-black shrink-0"
        >
          {showJson ? "formatted" : "raw JSON"}
        </button>
      </div>

      {showJson ? (
        <pre className="p-4 text-xs font-mono overflow-auto max-h-[50vh] whitespace-pre-wrap text-black/70">
          {JSON.stringify(draft, null, 2)}
        </pre>
      ) : (
        <>
          {/* Sections */}
          {draft.sections.map((section, si) => (
            <div key={si}>
              <div className="px-4 py-2 bg-black/[0.02] border-b border-black/5">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/40">{section.title}</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/5 text-black/30">
                    <th className="text-left px-4 py-1.5 font-normal">Description</th>
                    <th className="text-right px-2 py-1.5 font-normal w-20">Qty</th>
                    <th className="text-left px-2 py-1.5 font-normal w-16">Unit</th>
                    <th className="text-right px-2 py-1.5 font-normal w-24">Unit $</th>
                    <th className="text-right px-4 py-1.5 font-normal w-28">Line $</th>
                    <th className="text-center px-2 py-1.5 font-normal w-16">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item, ii) => (
                    <tr key={ii} className="border-b border-black/5 hover:bg-black/[0.01]">
                      <td className="px-4 py-2">{item.description}</td>
                      <td className="text-right px-2 py-2">{item.quantity}</td>
                      <td className="px-2 py-2 text-black/40">{item.unit}</td>
                      <td className="text-right px-2 py-2">
                        {item.unit_price === 0 ? (
                          <span className="text-black/30">—</span>
                        ) : (
                          `$${item.unit_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                        )}
                      </td>
                      <td className="text-right px-4 py-2 font-mono">
                        {item.unit_price === 0 ? (
                          <span className="text-black/30">TBD</span>
                        ) : (
                          `$${(item.quantity * item.unit_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                        )}
                      </td>
                      <td className="text-center px-2 py-2">
                        <div className="flex gap-1 justify-center">
                          {item.is_ad_hoc && (
                            <span className="bg-amber-50 text-amber-600 border border-amber-200 px-1 rounded text-[10px]">
                              ad-hoc
                            </span>
                          )}
                          {item.is_labor && (
                            <span className="bg-blue-50 text-blue-600 border border-blue-200 px-1 rounded text-[10px]">
                              labor
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Assumptions */}
          {draft.assumptions_for_estimator_to_confirm.length > 0 && (
            <div className="px-4 py-3 border-t border-black/10 space-y-1">
              <p className="text-xs font-semibold text-amber-700">Needs estimator review</p>
              <ul className="space-y-0.5">
                {draft.assumptions_for_estimator_to_confirm.map((a, i) => (
                  <li key={i} className="text-xs text-black/60 flex gap-2">
                    <span className="text-amber-400 shrink-0">·</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {draft.notes && (
            <div className="px-4 py-3 border-t border-black/10">
              <p className="text-xs text-black/50 italic">{draft.notes}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
