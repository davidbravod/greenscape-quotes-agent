import { NextResponse } from "next/server";
import { listModels } from "@/lib/openrouter";

export async function GET() {
  const models = await listModels();

  const slim = models.map((m) => ({
    id: m.id,
    name: m.name,
    context_length: m.context_length,
    input_modalities: m.architecture?.input_modalities ?? [],
    supported_parameters: m.supported_parameters ?? [],
    pricing_prompt: m.pricing?.prompt ?? null,
  }));

  return NextResponse.json(slim);
}
