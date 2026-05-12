"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type ModelOption = {
  id: string;
  name: string;
  context_length?: number;
  input_modalities: string[];
  supported_parameters: string[];
  pricing_prompt: string | null;
};

type Settings = {
  transcription_model?: string | null;
  agent_model?: string | null;
  default_tax_rate?: number | null;
  default_terms_md?: string | null;
};

const ALL_MODALITIES = ["text", "audio", "image", "video", "file"];

function formatPrice(prompt: string | null): string {
  if (!prompt) return "free";
  const n = parseFloat(prompt);
  if (n === 0) return "free";
  return `$${(n * 1_000_000).toFixed(2)}/1M`;
}

function ModelPickerModal({
  open,
  onClose,
  models,
  onSelect,
  title,
  requiredModalities = [],
  requiredParams = [],
}: {
  open: boolean;
  onClose: () => void;
  models: ModelOption[];
  onSelect: (id: string) => void;
  title: string;
  requiredModalities?: string[];
  requiredParams?: string[];
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<string[]>([]);

  function toggleFilter(mod: string) {
    setFilters((prev) =>
      prev.includes(mod) ? prev.filter((f) => f !== mod) : [...prev, mod],
    );
  }

  const filtered = useMemo(() => {
    const allActive = [...requiredModalities, ...filters];
    return models.filter((m) => {
      const matchesSearch =
        search === "" ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.id.toLowerCase().includes(search.toLowerCase());
      const matchesModalities =
        allActive.length === 0 ||
        allActive.every((f) => m.input_modalities.includes(f));
      const matchesParams =
        requiredParams.length === 0 ||
        requiredParams.every((p) => m.supported_parameters.includes(p));
      return matchesSearch && matchesModalities && matchesParams;
    });
  }, [models, search, filters, requiredModalities, requiredParams]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <DialogTitle>{title}</DialogTitle>
          <Input
            placeholder="Search by name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-2"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ALL_MODALITIES.map((mod) => {
              const required = requiredModalities.includes(mod);
              const active = required || filters.includes(mod);
              return (
                <button
                  key={mod}
                  type="button"
                  onClick={() => !required && toggleFilter(mod)}
                  className={`px-2 py-0.5 text-xs border rounded-full transition-colors ${
                    active
                      ? "bg-black text-white border-black"
                      : "bg-white text-black/60 border-black/20 hover:border-black/40"
                  } ${required ? "cursor-default opacity-80" : ""}`}
                >
                  {mod}
                  {required && " ✕"}
                </button>
              );
            })}
            {filters.length > 0 && (
              <button
                type="button"
                onClick={() => setFilters([])}
                className="px-2 py-0.5 text-xs text-black/40 hover:text-black"
              >
                clear
              </button>
            )}
          </div>
          {requiredParams.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className="text-[10px] text-black/30 self-center">params:</span>
              {requiredParams.map((p) => (
                <span
                  key={p}
                  className="px-2 py-0.5 text-xs border rounded-full bg-black text-white border-black opacity-80 cursor-default"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-black/40 text-center">
              No models match your filters.
            </p>
          ) : (
            <ul>
              {filtered.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(m.id);
                      onClose();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-black/5 border-b border-black/5 flex items-start justify-between gap-4 group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-black">
                        {m.name}
                      </p>
                      <p className="text-xs text-black/40 truncate">{m.id}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {m.input_modalities.map((mod) => (
                          <span
                            key={mod}
                            className="text-[10px] px-1.5 py-0 border border-black/10 rounded-full text-black/50"
                          >
                            {mod}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0 text-xs text-black/40 mt-0.5">
                      <p>{m.context_length ? `${Math.round(m.context_length / 1000)}k ctx` : ""}</p>
                      <p>{formatPrice(m.pricing_prompt)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-2 border-t text-xs text-black/30">
          {filtered.length} model{filtered.length !== 1 ? "s" : ""}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Settings>(initialSettings);
  const [picker, setPicker] = useState<"transcription" | "agent" | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: ModelOption[]) => {
        setModels(data);
        setLoading(false);
      })
      .catch(() => {
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

  function modelName(id: string | null | undefined) {
    if (!id) return null;
    return models.find((m) => m.id === id)?.name ?? id;
  }

  return (
    <>
      <ModelPickerModal
        open={picker === "transcription"}
        onClose={() => setPicker(null)}
        models={models}
        title="Select transcription model"
        requiredModalities={["audio"]}
        onSelect={(id) => setForm((f) => ({ ...f, transcription_model: id }))}
      />
      <ModelPickerModal
        open={picker === "agent"}
        onClose={() => setPicker(null)}
        models={models}
        title="Select agent model"
        requiredParams={["tools"]}
        onSelect={(id) => setForm((f) => ({ ...f, agent_model: id }))}
      />

      <form onSubmit={save} className="space-y-6">
        {/* STT model */}
        <div className="space-y-2">
          <Label>Transcription model</Label>
          <button
            type="button"
            disabled={loading}
            onClick={() => setPicker("transcription")}
            className="w-full text-left border border-black/20 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black disabled:opacity-50 hover:border-black/40 transition-colors"
          >
            {loading
              ? "Loading…"
              : form.transcription_model
              ? modelName(form.transcription_model)
              : "— pick a model —"}
          </button>
          {form.transcription_model && (
            <p className="text-xs text-black/40 font-mono">{form.transcription_model}</p>
          )}
          <p className="text-xs text-black/50">
            Default: <code>openai/gpt-4o-audio-preview</code>
          </p>
        </div>

        {/* Agent model */}
        <div className="space-y-2">
          <Label>Quote-drafting agent model</Label>
          <button
            type="button"
            disabled={loading}
            onClick={() => setPicker("agent")}
            className="w-full text-left border border-black/20 bg-white px-3 py-2 text-sm focus:outline-none focus:border-black disabled:opacity-50 hover:border-black/40 transition-colors"
          >
            {loading
              ? "Loading…"
              : form.agent_model
              ? modelName(form.agent_model)
              : "— pick a model —"}
          </button>
          {form.agent_model && (
            <p className="text-xs text-black/40 font-mono">{form.agent_model}</p>
          )}
          <p className="text-xs text-black/50">
            Default: <code>anthropic/claude-sonnet-4-6</code>
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
              = {((form.default_tax_rate ?? 0) * 100).toFixed(2)}%
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
    </>
  );
}
