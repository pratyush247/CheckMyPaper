import type { ErrorTag } from "./types";
import { ERROR_TAGS } from "./errorTags";
import { SAMPLE_QUESTIONS, type ExtractedQuestion } from "./sampleData";
import { chatComplete, parseJson, type ChatMessage } from "./llm";

// Server-side AI helpers, powered by DeepSeek:
//   - DeepSeek-OCR     reads paper images → text          (vision host, OpenAI-compatible)
//   - DeepSeek V4 Flash structures + diagnoses + summarizes (api.deepseek.com)
// Every function falls back to a realistic mock when its key is absent, so the
// whole loop stays demoable with zero credentials.

// ---- Text reasoning: DeepSeek V4 Flash -------------------------------------
const TEXT_KEY = process.env.DEEPSEEK_API_KEY;
const TEXT_BASE = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const TEXT_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
export const aiEnabled = () => Boolean(TEXT_KEY);

// ---- Vision OCR: DeepSeek-OCR (hosted) -------------------------------------
const OCR_KEY = process.env.DEEPSEEK_OCR_API_KEY;
const OCR_BASE = process.env.DEEPSEEK_OCR_BASE_URL || "https://openrouter.ai/api/v1";
const OCR_MODEL = process.env.DEEPSEEK_OCR_MODEL || "deepseek/deepseek-ocr";
export const ocrEnabled = () => Boolean(OCR_KEY);

async function text(messages: ChatMessage[], maxTokens: number): Promise<string> {
  return chatComplete(messages, { base: TEXT_BASE, key: TEXT_KEY!, model: TEXT_MODEL, maxTokens });
}

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  data: string; // base64, no data: prefix
}

// OCR a single page image with DeepSeek-OCR.
async function ocrImage(img: ImageInput): Promise<string> {
  const out = await chatComplete(
    [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.data}` } },
          { type: "text", text: "OCR this exam page. Transcribe all text faithfully, preserving question numbers and math notation. Do not solve anything." },
        ],
      },
    ],
    { base: OCR_BASE, key: OCR_KEY!, model: OCR_MODEL, maxTokens: 4096, temperature: 0 },
  );
  return out;
}

const STRUCTURE_PROMPT = `You are given the raw OCR text of one or more pages of a JEE (Indian engineering entrance) mock test.
Split it into individual questions. For each question return:
- "number": the question number (integer; best guess if unclear)
- "text": the full question text, faithfully, with readable unicode math (², ³, √, π, θ, ∫, subscripts)
- "subject": one of "Physics", "Chemistry", "Maths", or "Unknown"
- "topic": the standard JEE chapter (e.g. "Rotational Motion", "Electrostatics", "Chemical Kinetics", "Integral Calculus")
- "subtopic": a short specific sub-area if clear, else omit
Do NOT solve anything. Return ONLY a JSON array of these objects.

OCR TEXT:
`;

export async function extractQuestions(
  images: ImageInput[],
  _pdfsUnused: unknown[],
): Promise<ExtractedQuestion[]> {
  // Need both an OCR provider and a text provider, plus at least one image.
  if (!ocrEnabled() || !aiEnabled() || images.length === 0) {
    return SAMPLE_QUESTIONS;
  }

  // OCR every page, then structure the combined text in one text call.
  const pages: string[] = [];
  for (const img of images) {
    try {
      pages.push(await ocrImage(img));
    } catch (err) {
      console.error("ocr page failed", err);
    }
  }
  const ocrText = pages.join("\n\n--- page break ---\n\n").trim();
  if (!ocrText) return SAMPLE_QUESTIONS;

  const raw = parseJson<ExtractedQuestion[]>(
    await text([{ role: "user", content: STRUCTURE_PROMPT + ocrText }], 8000),
  );
  return raw.map((q, i) => ({
    number: q.number ?? i + 1,
    text: q.text ?? "",
    subject: (["Physics", "Chemistry", "Maths"].includes(q.subject) ? q.subject : "Unknown") as ExtractedQuestion["subject"],
    topic: q.topic || "Unknown",
    subtopic: q.subtopic,
  }));
}

// ---- Per-question diagnosis ------------------------------------------------
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
        ? "Noted. Add a DeepSeek API key to get AI feedback on your approach."
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

  try {
    const out = parseJson<DiagnoseResult>(await text([{ role: "user", content: prompt }], 400));
    return {
      aiTag: VALID_TAGS.includes(out.aiTag) ? out.aiTag : input.selfTag ?? "concept",
      confidence: Math.max(0, Math.min(1, Number(out.confidence) || 0.5)),
      note: out.note || "Keep going — every paper sharpens the picture.",
    };
  } catch (err) {
    console.error("diagnose failed", err);
    return { aiTag: input.selfTag ?? "concept", confidence: 0.5, note: "Saved your approach." };
  }
}

// ---- Paper insight summary -------------------------------------------------
export interface SummaryInput {
  paperName: string;
  rows: { topic: string; tag: ErrorTag }[];
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
    const out = parseJson<SummaryResult>(await text([{ role: "user", content: prompt }], 500));
    return {
      headline: out.headline || deterministicSummary(input.rows).headline,
      light: (["green", "amber", "red"] as const).includes(out.light) ? out.light : "amber",
      advice: out.advice || "Pick your most-repeated mistake and target it next paper.",
    };
  } catch (err) {
    console.error("summary failed", err);
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
