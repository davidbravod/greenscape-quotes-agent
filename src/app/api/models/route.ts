import { NextResponse } from "next/server";
import { listModels } from "@/lib/openrouter";

// GET /api/models?type=transcription|text
// Called by the Settings page to populate model pickers.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "transcription" ? "transcription" : "text";

  const models = await listModels(
    type === "transcription" ? { outputModality: "transcription" } : undefined,
  );

  // For text/agent models, only keep those with tool-calling support (architecture hint)
  // OpenRouter doesn't always expose this, so we return all and let the admin choose.
  const slim = models.map((m) => ({
    id: m.id,
    name: m.name,
    context_length: m.context_length,
  }));

  return NextResponse.json(slim);
}
