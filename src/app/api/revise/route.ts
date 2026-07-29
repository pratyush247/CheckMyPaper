import { NextRequest, NextResponse } from "next/server";
import { aiEnabled, deepseekChat } from "@/lib/ai";
import { parseJson } from "@/lib/llm";

export const maxDuration = 120;

export interface ConceptItem { name: string; explanation: string }
export interface Flashcard { front: string; back: string }
export interface MindNode { label: string; children?: MindNode[] }

// One route, three artifacts, all grounded in the student's own wrong
// questions for a topic. POST { topic, subject, kind, questions: string[] }
// kind: "concepts" | "flashcards" | "mindmap"
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const topic = String(b.topic || "Unknown");
    const subject = String(b.subject || "Unknown");
    const kind = String(b.kind || "concepts");
    const questions: string[] = Array.isArray(b.questions) ? b.questions.map(String).slice(0, 15) : [];

    const grounding = questions.length
      ? `The student got these questions wrong:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : "No specific wrong questions available — cover the standard JEE essentials of the topic.";

    if (!aiEnabled()) {
      // Student-friendly degraded mode — never mention keys or providers.
      if (kind === "concepts") return NextResponse.json({ concepts: [{ name: topic, explanation: "The concept engine is taking a break — try again in a bit." }] });
      if (kind === "flashcards") return NextResponse.json({ cards: [{ front: `${topic} — sample card`, back: "Real cards arrive once the generator is back. Try again in a bit." }] });
      return NextResponse.json({ root: { label: topic, children: [{ label: "Try again in a bit — the map maker is taking a break." }] } });
    }

    if (kind === "concepts") {
      const out = await deepseekChat([
        {
          role: "user",
          content: `A JEE student keeps getting the topic "${topic}" (${subject}) wrong.
${grounding}

List EVERY distinct concept involved in these mistakes (4-8 concepts). For each, explain it the way a friendly Indian tutor would — in Hinglish (natural Hindi-English mix in Roman script), 3 short lines:
"Idea: <the concept in one plain line>
Jaise: <an everyday example that makes it click>
JEE mein: <how it shows up in questions / the classic trap>"
Keep technical terms (force, velocity, mole, matrix) in English.
Return ONLY JSON: {"concepts": [{"name": "<concept, <=6 words>", "explanation": "<the 3 lines, separated by \\n>"}]}`,
        },
      ], 4000);
      const parsed = parseJson<{ concepts: ConceptItem[] }>(out);
      return NextResponse.json({ concepts: (parsed.concepts ?? []).slice(0, 8) });
    }

    if (kind === "flashcards") {
      const out = await deepseekChat([
        {
          role: "user",
          content: `Make revision flashcards for the JEE topic "${topic}" (${subject}).
${grounding}

10-14 cards. Mix: key definitions, must-know formulas, classic traps from the wrong questions above, and one-line problem-solving cues. Front = a short question/prompt (<=15 words). Back = the crisp answer (<=30 words; formulas in readable unicode like ², √, π).
Return ONLY JSON: {"cards": [{"front": "...", "back": "..."}]}`,
        },
      ], 4000);
      const parsed = parseJson<{ cards: Flashcard[] }>(out);
      return NextResponse.json({ cards: (parsed.cards ?? []).slice(0, 14) });
    }

    // mindmap
    const out = await deepseekChat([
      {
        role: "user",
        content: `Build a revision mind map for the JEE topic "${topic}" (${subject}).
${grounding}

Root = the topic. First level = 4-6 major branches (sub-areas / concept clusters, biased toward what the student got wrong). Each branch: 2-4 leaves (key formulas, laws, classic question types, traps). Labels short (<=6 words), formulas in readable unicode.
Return ONLY JSON: {"root": {"label": "${topic}", "children": [{"label": "...", "children": [{"label": "..."}]}]}}`,
      },
    ], 3000);
    const parsed = parseJson<{ root: MindNode }>(out);
    return NextResponse.json({ root: parsed.root ?? { label: topic, children: [] } });
  } catch (err) {
    console.error("revise error", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
