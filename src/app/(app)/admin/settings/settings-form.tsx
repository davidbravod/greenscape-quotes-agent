"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type ModelOption = { id: string; name: string; context_length?: number };

type Settings = {
  transcription_model?: string | null;
  agent_model?: string | null;
  default_tax_rate?: number | null;
  default_terms_md?: string | null;
};

export default function SettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const [sttModels, setSttModels] = useState<ModelOption[]>([]);
  const [agentModels, setAgentModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Settings>(initialSettings);

  useEffect(() => {
    Promise.all([
      fetch("/api/models?type=transcription").then((r) => r.json()),
      fetch("/api/models?type=text").then((r) => r.json()),
    ]).then(([stt, agent]: [ModelOption[], ModelOption[]]) => {
      setSttModels(stt);
      setAgentModels(agent);
      setLoading(false);
    }).catch(() => {
      toast.error("Failed to load models from OpenRouter — check your API key.");
      setLoading(false);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) toast.success("Settings saved");
    else toast.error("Failed to save settings");
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {/* STT model */}
      <div className="space-y-2">
        <Label htmlFor="stt">Transcription model</Label>
        <select
          id="stt"
          disabled={loading}
          value={form.transcription_model ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, transcription_model: e.target.value }))}
          className="w-full border border-black/20 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black disabled:opacity-50"
        >
          <option value="">
            {loading ? "Loading…" : sttModels.length === 0 ? "No transcription models found" : "— pick a model —"}
          </option>
          {sttModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.id})
            </option>
          ))}
        </select>
        <p className="text-xs text-black/50">
          Fetched from OpenRouter with <code>input_modalities=audio</code> — multimodal
          models only (e.g. gpt-4o-audio-preview, gemini-flash). Default:{" "}
          <code>openai/gpt-4o-audio-preview</code>
        </p>
      </div>

      {/* Agent model */}
      <div className="space-y-2">
        <Label htmlFor="agent">Quote-drafting agent model</Label>
        <select
          id="agent"
          disabled={loading}
          value={form.agent_model ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, agent_model: e.target.value }))}
          className="w-full border border-black/20 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black disabled:opacity-50"
        >
          <option value="">
            {loading ? "Loading…" : "— pick a model —"}
          </option>
          {agentModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.id}){m.context_length ? ` — ${(m.context_length / 1000).toFixed(0)}k ctx` : ""}
            </option>
          ))}
        </select>
        <p className="text-xs text-black/50">
          Must support tool calling. Default: <code>anthropic/claude-sonnet-4-6</code>
        </p>
      </div>

      {/* Tax rate */}
      <div className="space-y-2">
        <Label htmlFor="tax">Default tax rate</Label>
        <div className="flex items-center gap-2">
          <input
            id="tax"
            type="number"
            min={0}
            max={1}
            step={0.001}
            value={form.default_tax_rate ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, default_tax_rate: parseFloat(e.target.value) }))}
            className="w-32 border border-black/20 px-3 py-2 text-sm focus:outline-none focus:border-black"
          />
          <span className="text-sm text-black/60">
            = {(((form.default_tax_rate ?? 0)) * 100).toFixed(2)}%
          </span>
        </div>
        <p className="text-xs text-black/50">Enter as a decimal (e.g. 0.085 for 8.5%)</p>
      </div>

      {/* Default terms */}
      <div className="space-y-2">
        <Label htmlFor="terms">Default payment terms</Label>
        <Textarea
          id="terms"
          rows={5}
          value={form.default_terms_md ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, default_terms_md: e.target.value }))}
          placeholder="e.g. 50% deposit due upon signing. Balance due upon completion."
        />
        <p className="text-xs text-black/50">Markdown supported. Applied to all new quotes.</p>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
