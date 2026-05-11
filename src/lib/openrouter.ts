const BASE = "https://openrouter.ai/api/v1";

function headers() {
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "",
    "X-Title": process.env.OPENROUTER_APP_NAME ?? "Greenscape Quotes Agent",
    "Content-Type": "application/json",
  };
}

export type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
};

export async function listModels(opts?: {
  outputModality?: "text" | "transcription" | "image";
}): Promise<OpenRouterModel[]> {
  const qs = opts?.outputModality
    ? `?output_modalities=${opts.outputModality}`
    : "";
  const res = await fetch(`${BASE}/models${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(`OpenRouter models: ${res.status}`);
  const json = (await res.json()) as { data: OpenRouterModel[] };
  return json.data;
}

export async function transcribe(args: {
  model: string;
  audio: Blob | ArrayBuffer;
  mimeType?: string;
}): Promise<{ text: string; raw: unknown }> {
  // OpenRouter supports OpenAI-compatible audio/transcriptions for STT-capable models.
  const form = new FormData();
  const blob =
    args.audio instanceof Blob
      ? args.audio
      : new Blob([args.audio], { type: args.mimeType ?? "audio/webm" });
  form.append("file", blob, "audio");
  form.append("model", args.model);

  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Greenscape Quotes Agent",
    },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenRouter transcribe: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { text: string };
  return { text: json.text, raw: json };
}

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: unknown;
  tool_call_id?: string;
};

export async function chat(args: {
  model: string;
  messages: ChatMessage[];
  tools?: unknown[];
  tool_choice?: "auto" | "none";
  response_format?: unknown;
  temperature?: number;
}) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`OpenRouter chat: ${res.status} ${await res.text()}`);
  return res.json();
}
