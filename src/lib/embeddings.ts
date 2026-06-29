// Server-side text embeddings via OpenRouter (openai/text-embedding-3-small, 1536-d).
// Reuses the OpenRouter key already configured for the other models.
const KEY = process.env.EMBED_API_KEY || process.env.DEEPSEEK_API_KEY;
const BASE = process.env.EMBED_BASE_URL || "https://openrouter.ai/api/v1";
const MODEL = process.env.EMBED_MODEL || "openai/text-embedding-3-small";

export const embeddingsEnabled = () => Boolean(KEY);

export async function embed(input: string): Promise<number[]> {
  const res = await fetch(`${BASE.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: input.slice(0, 8000) }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data[0].embedding;
}
