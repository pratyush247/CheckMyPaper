import Anthropic from "@anthropic-ai/sdk";
import type { ErrorTag } from "./types";
import { ERROR_TAGS } from "./errorTags";
import { SAMPLE_QUESTIONS, type ExtractedQuestion } from "./sampleData";

// Server-side AI helpers. When ANTHROPIC_API_KEY is absent every function falls
// back to a realistic mock so the whole loop is demoable with zero credentials.

const KEY = process.env.ANTHROPIC_API_KEY;
export const aiEnabled = () => Boolean(KEY);

// Sonnet for high-volume structured calls (extraction, per-question diagnosis);
// Opus for the once-per-paper narrative summary.
const MODEL_FAST = "claude-sonnet-4-6";
const MODEL_SMART = "claude-opus-4-8";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: KEY });
  return _client;
}

// Pull the first JSON object/array out of a model response, tolerating prose/fences.
function parseJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("No JSON in model output");
  return JSON.parse(candidate.slice(start)) as T;
}

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  data: string; // base64, no data: prefix
}
export interface PdfInput {
  data: string; // base64, no data: prefix
}

const EXTRACTION_PROMPT = `You are reading a JEE (Indian engineering entrance) mock test paper.
Extract EVERY question you can see. For each, return:
- "number": the question number on the paper (integer; best guess if unclear)
- "text": the full question text, transcribed faithfully. Render math readably in plain unicode (use ², ³, √, π, θ, ∫, subscripts where possible). Do NOT solve it.
- "subject": one of "Physics", "Chemistry", "Maths", or "Unknown"
- "topic": the standard JEE chapter, e.g. "Rotational Motion", "Electrostatics", "Chemical Kinetics", "Integral Calculus"
- "subtopic": a short specific sub-area if clear, else omit

Return ONLY a JSON array of these objects, nothing else.`;

export async function extractQuestions(
  images: ImageInput[],
  pdfs: PdfInput[],
): Promise<ExtractedQuestion[]> {
  if (!aiEnabled() || (images.length === 0 && pdfs.length === 0)) {
    return SAMPLE_QUESTIONS;
  }

  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of images) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.data },
    });
  }
  for (const pdf of pdfs) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: pdf.data },
    });
  }
  content.push({ type: "text", text: EXTRACTION_PROMPT });

  const res = await client().messages.create({
    model: MODEL_FAST,
    max_tokens: 8000,
    messages: [{ role: "user", content }],
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const raw = parseJson<ExtractedQuestion[]>(text);
  return raw.map((q, i) => ({
    number: q.number ?? i + 1,
    text: q.text ?? "",
    subject: (["Physics", "Chemistry", "Maths"].includes(q.subject) ? q.subject : "Unknown") as ExtractedQuestion["subject"],
    topic: q.topic || "Unknown",
    subtopic: q.subtopic,
  }));
}

export interface DiagnoseInput {
  questionText: string;
  topic: string;
  transcript: string;
  selfTag?: ErrorTag;
}
export interface DiagnoseResult {
  aiTag: ErrorTag;
  confidence: number;
  note: string;
}

const VALID_TAGS = ERROR_TAGS.map((t) => t.tag);

export async function diagnose(input: DiagnoseInput): Promise<DiagnoseResult> {
  if (!aiEnabled() || !input.transcript.trim()) {
    return {
      aiTag: input.selfTag ?? "concept",
      confidence: input.selfTag ? 0.6 : 0.3,
      note: input.selfTag
        ? "Noted. Add an API key to get AI feedback on your approach."
        : "Tell me your approach to get feedback.",
    };
  }

  const prompt = `A JEE student got this question wrong or was unsure, and explained their approach out loud.
Question (topic: ${input.topic}): "${input.questionText}"
Student's spoken approach: "${input.transcript}"
${input.selfTag ? `The student self-tagged this as: "${input.selfTag}".` : ""}

Decide the single best "error type" tag from this exact list:
${ERROR_TAGS.map((t) => `- "${t.tag}": ${t.blurb}`).join("\n")}

Respect the student's self-tag unless their words clearly indicate a different cause.
Return ONLY JSON: {"aiTag": "<tag>", "confidence": <0..1>, "note": "<one short, encouraging, specific sentence of feedback>"}`;

  const res = await client().messages.create({
    model: MODEL_FAST,
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const out = parseJson<DiagnoseResult>(text);
  return {
    aiTag: VALID_TAGS.includes(out.aiTag) ? out.aiTag : input.selfTag ?? "concept",
    confidence: Math.max(0, Math.min(1, Number(out.confidence) || 0.5)),
    note: out.note || "Keep going — every paper sharpens the picture.",
  };
}

export interface SummaryInput {
  paperName: string;
  rows: { topic: string; tag: ErrorTag }[];
  // newest-first history of prior papers' dominant tag, for trend awareness
  priorTags: ErrorTag[];
}
export interface SummaryResult {
  headline: string;
  light: "green" | "amber" | "red";
  advice: string;
}

export async function summarizePaper(input: SummaryInput): Promise<SummaryResult> {
  const total = input.rows.length;

  if (!aiEnabled() || total === 0) {
    return deterministicSummary(input.rows);
  }

  const prompt = `You are a warm, honest JEE mentor talking to a teenager who is a BEGINNER at self-analysis.
They just finished reviewing their mistakes on "${input.paperName}".
Here are their ${total} diagnosed mistakes as (topic, cause):
${input.rows.map((r) => `- ${r.topic}: ${r.tag}`).join("\n")}
${input.priorTags.length ? `Their previous papers' main cause was: ${input.priorTags.join(", ")}.` : ""}

Write ONE honest, specific, encouraging headline sentence about the BIGGEST pattern (e.g. "Your physics is solid — you're losing marks to rushed arithmetic, not concepts.").
Then ONE concrete piece of advice (one sentence).
Pick a traffic light: green (mostly careless/fixable), amber (mixed), red (real concept gaps to revise).
Avoid jargon. Never say "analytics". Return ONLY JSON: {"headline": "...", "light": "green|amber|red", "advice": "..."}`;

  try {
    const res = await client().messages.create({
      model: MODEL_SMART,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const out = parseJson<SummaryResult>(text);
    return {
      headline: out.headline || deterministicSummary(input.rows).headline,
      light: (["green", "amber", "red"] as const).includes(out.light) ? out.light : "amber",
      advice: out.advice || "Pick your most-repeated mistake and target it next paper.",
    };
  } catch {
    return deterministicSummary(input.rows);
  }
}

// Pure, dependency-free summary used as the no-key fallback and on AI failure.
function deterministicSummary(rows: { topic: string; tag: ErrorTag }[]): SummaryResult {
  const counts: Partial<Record<ErrorTag, number>> = {};
  const topicCounts: Record<string, number> = {};
  for (const r of rows) {
    counts[r.tag] = (counts[r.tag] || 0) + 1;
    topicCounts[r.topic] = (topicCounts[r.topic] || 0) + 1;
  }
  const total = rows.length || 1;
  let topTag: ErrorTag = "concept";
  let topN = 0;
  for (const [t, n] of Object.entries(counts)) if (n! > topN) ((topN = n!), (topTag = t as ErrorTag));
  let weakTopic = "";
  let wN = 0;
  for (const [t, n] of Object.entries(topicCounts)) if (n > wN) ((wN = n), (weakTopic = t));

  const share = Math.round((topN / total) * 100);
  const conceptHeavy = (counts.concept || 0) / total > 0.4;
  const carelessHeavy = ((counts.calc_slip || 0) + (counts.misread || 0) + (counts.second_guess || 0)) / total > 0.5;

  const tagLabel: Record<ErrorTag, string> = {
    concept: "concept gaps",
    calc_slip: "silly calculation slips",
    misread: "misreading questions",
    wrong_method: "wrong methods",
    time: "time pressure",
    second_guess: "second-guessing yourself",
  };

  return {
    headline: rows.length
      ? `${share}% of your mistakes here came down to ${tagLabel[topTag]}${weakTopic ? `, mostly in ${weakTopic}.` : "."}`
      : "No mistakes logged for this paper yet.",
    light: conceptHeavy ? "red" : carelessHeavy ? "green" : "amber",
    advice: conceptHeavy
      ? `Revise ${weakTopic || "your weakest topic"} before the next test — these are concept gaps, not slips.`
      : carelessHeavy
        ? "These are fixable habits, not knowledge gaps — slow down and re-check before locking an answer."
        : `Target ${weakTopic || "your most-repeated topic"} next paper and watch the pattern shift.`,
  };
}
