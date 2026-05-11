import { createServiceClient } from "@/lib/supabase/server";
import { transcribe } from "@/lib/openrouter";

const DEFAULT_STT_MODEL = "openai/whisper-large-v3";

export async function runRecordingPipeline(recordingId: string) {
  const supabase = createServiceClient();

  async function fail(msg: string) {
    await supabase
      .from("recordings")
      .update({ status: "failed", error: msg })
      .eq("id", recordingId);
  }

  try {
    // 1. Fetch recording row
    const { data: rec, error: recErr } = await supabase
      .from("recordings")
      .select("storage_path")
      .eq("id", recordingId)
      .single();
    if (recErr || !rec) return await fail("Recording row not found");

    // 2. Fetch settings for model selection
    const { data: settings } = await supabase
      .from("settings")
      .select("transcription_model")
      .eq("id", 1)
      .single();
    const sttModel = settings?.transcription_model ?? DEFAULT_STT_MODEL;

    // 3. Download audio from Storage
    await supabase
      .from("recordings")
      .update({ status: "transcribing" })
      .eq("id", recordingId);

    const { data: audioData, error: dlErr } = await supabase.storage
      .from("recordings")
      .download(rec.storage_path);
    if (dlErr || !audioData) return await fail(`Storage download failed: ${dlErr?.message}`);

    // 4. Transcribe via OpenRouter
    const { text: transcript, raw } = await transcribe({
      model: sttModel,
      audio: audioData,
      mimeType: audioData.type || "audio/webm",
    });

    // 5. Save transcript
    const { data: transcriptRow, error: txErr } = await supabase
      .from("transcripts")
      .insert({
        recording_id: recordingId,
        model: sttModel,
        text: transcript,
        raw_response_json: raw,
      })
      .select("id")
      .single();
    if (txErr || !transcriptRow) return await fail(`Failed to save transcript: ${txErr?.message}`);

    await supabase
      .from("recordings")
      .update({ status: "transcribed" })
      .eq("id", recordingId);

    // 6. Draft quote (agent — stub until step 6)
    await supabase
      .from("recordings")
      .update({ status: "drafting" })
      .eq("id", recordingId);

    const { data: quoteRow, error: qErr } = await supabase
      .from("quotes")
      .insert({
        recording_id: recordingId,
        transcript_id: transcriptRow.id,
        status: "draft",
        scope_narrative: transcript, // placeholder until agent is wired
        notes: "",
        terms_md: "",
        assumptions: [],
      })
      .select("id")
      .single();
    if (qErr || !quoteRow) return await fail(`Failed to create quote: ${qErr?.message}`);

    await supabase
      .from("recordings")
      .update({ status: "drafted" })
      .eq("id", recordingId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await fail(msg);
  }
}
