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
  inputModality?: "audio" | "image" | "text";
}): Promise<OpenRouterModel[]> {
  const qs = opts?.inputModality
    ? `?input_modalities=${opts.inputModality}`
    : "";
  const res = await fetch(`${BASE}/models${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(`OpenRouter models: ${res.status}`);
  const json = (await res.json()) as { data: OpenRouterModel[] };
  return json.data;
}

function mimeToFormat(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

export async function transcribe(args: {
  model: string;
  audio: Blob | ArrayBuffer;
  mimeType?: string;
}): Promise<{ text: string; raw: unknown }> {
  // OpenRouter routes audio through /chat/completions with base64-encoded audio
  // content parts. The /audio/transcriptions multipart endpoint is unreliable on
  // OpenRouter regardless of Content-Type headers sent.
  const mimeType = args.mimeType ?? "audio/webm";
  const format = mimeToFormat(mimeType);

  const arrayBuffer =
    args.audio instanceof Blob
      ? await args.audio.arrayBuffer()
      : args.audio;
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const body = {
    model: args.model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: { data: base64, format },
          },
          {
            type: "text",
            text: "Transcribe this audio recording verbatim. Return only the transcription text with no commentary, headings, or formatting.",
          },
        ],
      },
    ],
    temperature: 0,
  };

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenRouter transcribe: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  return { text, raw: json };
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
