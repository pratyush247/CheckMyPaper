// Minimal OpenAI-compatible chat client. Used for both DeepSeek V4 Flash
// (text reasoning, via api.deepseek.com) and DeepSeek-OCR (vision, via an
// OpenRouter/Novita/DeepInfra-style host). Plain fetch — no SDK needed.

export type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatContent;
}

export interface ChatOptions {
  base: string; // root URL, e.g. https://api.deepseek.com or https://openrouter.ai/api/v1
  key: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export async function chatComplete(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.key}`,
    "Content-Type": "application/json",
  };
  // OpenRouter likes these attribution headers (harmless elsewhere).
  if (opts.base.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = process.env.APP_URL || "https://checkmypaper.vercel.app";
    headers["X-Title"] = "CheckMyPaper";
  }

  const res = await fetch(`${opts.base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: opts.model,
      messages,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.2,
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM ${opts.model} ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

// Pull the first JSON object/array out of a model response, tolerating prose/fences.
export function parseJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("No JSON in model output");
  return JSON.parse(candidate.slice(start)) as T;
}
