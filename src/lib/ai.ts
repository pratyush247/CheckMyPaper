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
  // disableReasoning: deepseek-v4-flash defaults to "thinking" mode, which makes
  // structured generation (esp. a 10-question quiz) slow enough to time out.
  return chatComplete(messages, {
    base: TEXT_BASE,
    key: TEXT_KEY!,
    model: TEXT_MODEL,
    maxTokens,
    disableReasoning: true,
  });
}

// ---- Visuals: a separate cheap model good at SVG (configurable) -------------
// Defaults to OpenRouter; pick any cheap visual-capable model via VISUAL_MODEL.
const VIS_KEY = process.env.VISUAL_API_KEY || OCR_KEY; // reuse OpenRouter key if shared
const VIS_BASE = process.env.VISUAL_BASE_URL || "https://openrouter.ai/api/v1";
const VIS_MODEL = process.env.VISUAL_MODEL || "google/gemini-2.5-flash-lite";
export const visualEnabled = () => Boolean(VIS_KEY);

async function visualModel(messages: ChatMessage[], maxTokens: number): Promise<string> {
  return chatComplete(messages, { base: VIS_BASE, key: VIS_KEY!, model: VIS_MODEL, maxTokens, temperature: 0.4 });
}

// Generic grounded chat on the text model (reasoning off). Returns "" when no key.
export async function deepseekChat(messages: ChatMessage[], maxTokens = 700): Promise<string> {
  if (!aiEnabled()) return "";
  return text(messages, maxTokens);
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

export async function extractQuestions(images: ImageInput[]): Promise<ExtractedQuestion[]> {
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
    // No transcript (student tagged without narrating) or no key: return no
    // note at all — the insight page hides note-less rows, so students never
    // see filler or developer copy here.
    return {
      aiTag: input.selfTag ?? "concept",
      confidence: input.selfTag ? 0.6 : 0.3,
      note: "",
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
  for (const [t, n] of Object.entries(counts)) {
    if (n! > topN) {
      topN = n!;
      topTag = t as ErrorTag;
    }
  }
  let weakTopic = "";
  let wN = 0;
  for (const [t, n] of Object.entries(topicCounts)) {
    if (n > wN) {
      wN = n;
      weakTopic = t;
    }
  }

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

// ---- Visual explanation (doubt answers + battle lessons) -------------------
export interface VisualInput {
  prompt: string; // the student's doubt, or a topic to explain
  context?: string; // optional extra context (e.g. the questions they got wrong)
  kind: "doubt" | "lesson";
}
export interface VisualResult {
  title: string;
  explanation: string; // concise, suitable to read aloud
  svg: string; // self-contained <svg>...</svg>
}

// Remove anything executable so the SVG is safe even outside the sandbox.
export function sanitizeSvg(svg: string): string {
  const start = svg.indexOf("<svg");
  const end = svg.lastIndexOf("</svg>");
  if (start === -1 || end === -1) return "";
  let s = svg.slice(start, end + 6);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  s = s.replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
  return s;
}

export async function generateVisual(input: VisualInput): Promise<VisualResult> {
  if (!visualEnabled()) return mockVisual(input);

  const ask =
    input.kind === "doubt"
      ? `A JEE student asked this doubt out loud: "${input.prompt}"`
      : `Explain the JEE topic "${input.prompt}" to a student who keeps getting it wrong.`;

  const prompt = `${ask}
${input.context ? `Context: ${input.context}` : ""}

Make ONE clean DIAGRAM as an SVG that builds intuition (a force diagram, graph, geometry sketch, or simple before/after). Strict rules:
- A single self-contained <svg viewBox="0 0 400 300"> ... </svg>; omit width/height so it scales.
- It is a PICTURE, not a slide: use shapes, arrows, and SHORT labels only (1-3 words each). Do NOT put sentences, numbered steps, or paragraphs inside the SVG.
- Keep every element fully inside the viewBox with ~20px padding. Elements must NOT overlap or sit on top of text. Leave whitespace.
- Inline styles only. NO <script>, no external images/fonts. Dark text (#1f2937) on transparent; use colour to highlight the key idea.

Then write the actual teaching in "explanation" — in HINGLISH (natural Hindi-English mix written in Roman/English script, the way a friendly Indian tutor explains to a student). Keep it SIMPLE and STRUCTURED, on separate lines, ALWAYS with a real-life example:
"Idea: <the core concept in one simple line>
Jaise: <ek roz-marra (everyday) example that makes it click>
Isliye: <why this matters for the answer, one line>"
Use short sentences and plain everyday words, minimal jargon. Keep technical terms (like force, velocity) in English. 3-4 short lines total.

Return ONLY JSON: {"title": "<=6 words", "explanation": "...", "svg": "<svg ...>...</svg>"}`;

  try {
    const out = parseJson<VisualResult>(await visualModel([{ role: "user", content: prompt }], 4000));
    const svg = sanitizeSvg(out.svg || "");
    return {
      title: out.title || (input.kind === "doubt" ? "Here's the idea" : input.prompt),
      explanation: out.explanation || "",
      svg: svg || mockVisual(input).svg,
    };
  } catch (err) {
    console.error("visual failed", err);
    return mockVisual(input);
  }
}

function mockVisual(input: VisualInput): VisualResult {
  const label = input.prompt.length > 40 ? input.prompt.slice(0, 40) + "…" : input.prompt;
  return {
    title: input.kind === "doubt" ? "Here's the idea" : input.prompt,
    explanation:
      "Idea: The drawing tool is taking a break right now.\nJaise: Blackboard pe chalk khatam ho gaya ho.\nIsliye: Try again in a bit — your " +
      (input.kind === "doubt" ? "doubt is saved." : "topic will get a real diagram."),
    svg: `<svg viewBox="0 0 400 320" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="20" width="360" height="280" rx="16" fill="#ece9ff" stroke="#5b4bff" stroke-width="2"/>
      <circle cx="200" cy="130" r="46" fill="#5b4bff" opacity="0.15" stroke="#5b4bff" stroke-width="2"/>
      <text x="200" y="135" text-anchor="middle" font-size="34">💡</text>
      <text x="200" y="220" text-anchor="middle" font-size="16" font-weight="700" fill="#1f2937">${escapeXml(label)}</text>
      <text x="200" y="250" text-anchor="middle" font-size="12" fill="#6b6258">Sample visual — the real diagram is on its way</text>
    </svg>`,
  };
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}

// ---- Quiz generation (Battle Mode) -----------------------------------------
export interface QuizQuestion {
  q: string;
  options: string[]; // exactly 4
  answer: number; // 0..3
  explanation: string;
}

export async function generateQuiz(topic: string, subject: string, n = 10, opts?: { className?: string; difficulty?: 1 | 2 | 3; ladder?: boolean }): Promise<QuizQuestion[]> {
  if (opts?.ladder) n = 20; // mastery ladder is always 5 easy + 10 medium + 5 hard
  if (!aiEnabled()) return mockQuiz(topic, n);

  const level = opts?.className ? `a ${opts.className} JEE aspirant` : "a JEE aspirant";
  const depth = opts?.difficulty === 3 ? "advanced (tough JEE Main / easy Advanced)" : opts?.difficulty === 1 ? "beginner (NCERT / early JEE Main)" : "intermediate (typical JEE Main)";
  const difficultyRule = opts?.ladder
    ? `- Difficulty LADDER, strictly in this order: questions 1-5 beginner (NCERT / early JEE Main), questions 6-15 intermediate (typical JEE Main), questions 16-20 advanced (tough JEE Main / easy Advanced).`
    : `- Difficulty: ${depth}. Pitch it to the student's class level.`;
  const prompt = `Generate ${n} multiple-choice questions to test mastery of the JEE topic "${topic}" (${subject}) for ${level}.
${difficultyRule}
- Exactly 4 options each, exactly one correct.
- Include a one-line explanation of the correct answer.
Return ONLY a JSON array of objects: {"q": "...", "options": ["a","b","c","d"], "answer": <0-3>, "explanation": "..."}`;

  try {
    const arr = parseJson<QuizQuestion[]>(await text([{ role: "user", content: prompt }], opts?.ladder ? 12000 : 6000));
    return arr
      .filter((x) => Array.isArray(x.options) && x.options.length === 4)
      .slice(0, n)
      .map((x) => ({
        q: String(x.q || ""),
        options: x.options.map(String),
        answer: Math.max(0, Math.min(3, Number(x.answer) || 0)),
        explanation: String(x.explanation || ""),
      }));
  } catch (err) {
    console.error("quiz failed", err);
    return mockQuiz(topic, n);
  }
}

function mockQuiz(topic: string, n: number): QuizQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    q: `(Sample) ${topic} — practice question ${i + 1}. The question generator isn't reachable right now; try again in a bit.`,
    options: ["Option A", "Option B", "Option C", "Option D"],
    answer: i % 4,
    explanation: "Sample explanation — real questions arrive once the generator is back.",
  }));
}
