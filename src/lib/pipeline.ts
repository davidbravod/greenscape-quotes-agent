import { createServiceClient } from "@/lib/supabase/server";
import { transcribe } from "@/lib/openrouter";
import { draftQuote } from "@/lib/agent";

const DEFAULT_STT_MODEL = "openai/gpt-4o-audio-preview";

export async function runRecordingPipeline(recordingId: string) {
  const supabase = createServiceClient();

  async function fail(msg: string) {
    await supabase
      .from("recordings")
      .update({ status: "failed", error: msg })
      .eq("id", recordingId);
  }

  try {
    // ── 1. Fetch recording + settings ────────────────────────────────────
    const [{ data: rec, error: recErr }, { data: settings }] = await Promise.all([
      supabase.from("recordings").select("storage_path, user_id").eq("id", recordingId).single(),
      supabase.from("settings").select("transcription_model, agent_model, default_tax_rate, default_terms_md").eq("id", 1).single(),
    ]);
    if (recErr || !rec) return await fail("Recording row not found");

    const sttModel = settings?.transcription_model ?? DEFAULT_STT_MODEL;
    const agentModel = settings?.agent_model ?? null;
    const taxRate = Number(settings?.default_tax_rate ?? 0);
    const defaultTerms = settings?.default_terms_md ?? "";

    // ── 2. Download audio ─────────────────────────────────────────────────
    await supabase.from("recordings").update({ status: "transcribing" }).eq("id", recordingId);

    const { data: audioData, error: dlErr } = await supabase.storage
      .from("recordings")
      .download(rec.storage_path);
    if (dlErr || !audioData) return await fail(`Storage download failed: ${dlErr?.message}`);

    // ── 3. Transcribe ─────────────────────────────────────────────────────
    const { text: transcript, raw: rawTranscription } = await transcribe({
      model: sttModel,
      audio: audioData,
      mimeType: audioData.type || "audio/webm",
    });

    const { data: transcriptRow, error: txErr } = await supabase
      .from("transcripts")
      .insert({ recording_id: recordingId, model: sttModel, text: transcript, raw_response_json: rawTranscription })
      .select("id")
      .single();
    if (txErr || !transcriptRow) return await fail(`Failed to save transcript: ${txErr?.message}`);

    await supabase.from("recordings").update({ status: "transcribed" }).eq("id", recordingId);

    // ── 4. Draft quote via agent ──────────────────────────────────────────
    await supabase.from("recordings").update({ status: "drafting" }).eq("id", recordingId);

    const draft = await draftQuote(transcript, supabase, agentModel);

    // ── 5. Compute totals ─────────────────────────────────────────────────
    const allItems = draft.sections.flatMap((s) => s.items);
    const subtotal = allItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    // ── 6. Persist quote + sections + line items ──────────────────────────
    const { data: quoteRow, error: qErr } = await supabase
      .from("quotes")
      .insert({
        recording_id: recordingId,
        transcript_id: transcriptRow.id,
        status: "draft",
        client_name: draft.client_name,
        site_address: draft.site_address,
        scope_narrative: draft.scope_narrative,
        notes: draft.notes,
        terms_md: draft.terms_md || defaultTerms,
        assumptions: draft.assumptions_for_estimator_to_confirm,
        subtotal: subtotal.toFixed(2),
        tax_rate: taxRate,
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        created_by: rec.user_id,
      })
      .select("id")
      .single();
    if (qErr || !quoteRow) return await fail(`Failed to create quote: ${qErr?.message}`);

    for (let sIdx = 0; sIdx < draft.sections.length; sIdx++) {
      const section = draft.sections[sIdx];
      const { data: sectionRow, error: sErr } = await supabase
        .from("quote_sections")
        .insert({ quote_id: quoteRow.id, title: section.title, sort_order: sIdx })
        .select("id")
        .single();
      if (sErr || !sectionRow) return await fail(`Failed to create section "${section.title}": ${sErr?.message}`);

      if (section.items.length > 0) {
        const { error: liErr } = await supabase.from("quote_line_items").insert(
          section.items.map((item, iIdx) => ({
            section_id: sectionRow.id,
            catalog_item_id: item.catalog_item_id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            line_total: (item.quantity * item.unit_price).toFixed(2),
            is_labor: item.is_labor,
            is_ad_hoc: item.is_ad_hoc,
            sort_order: iIdx,
          })),
        );
        if (liErr) return await fail(`Failed to create line items: ${liErr.message}`);
      }
    }

    await supabase.from("recordings").update({ status: "drafted" }).eq("id", recordingId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await fail(msg);
  }
}
