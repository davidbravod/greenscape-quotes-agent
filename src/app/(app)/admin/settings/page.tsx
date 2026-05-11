import { createClient } from "@/lib/supabase/server";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("transcription_model, agent_model, default_tax_rate, default_terms_md")
    .eq("id", 1)
    .single();

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-black/60 mt-1">
          Models are fetched live from OpenRouter. Changes apply to all future quotes.
        </p>
      </div>
      <SettingsForm initialSettings={settings ?? {}} />
    </div>
  );
}
