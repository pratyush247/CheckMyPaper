import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";
import { embed, embeddingsEnabled } from "@/lib/embeddings";
import { deepseekChat } from "@/lib/ai";
import { TAG_SHORT } from "@/lib/errorTags";
import type { ChatMessage } from "@/lib/llm";
import type { ErrorTag } from "@/lib/types";

export const maxDuration = 60;

interface Match {
  question_text: string; transcript: string | null; topic: string | null;
  subject: string | null; error_tag: string | null; similarity: number;
}

// RAG chat: retrieve the student's most relevant past mistakes, then answer
// grounded in them with DeepSeek.
export async function POST(req: NextRequest) {
  if (!supabaseConfigured() || !embeddingsEnabled()) {
    return NextResponse.json({
      answer: "Your tutor isn't set up yet — it needs the database + embeddings configured.",
      configured: false,
    });
  }
  try {
    const b = await req.json();
    const phone = String(b.phone || "").replace(/\D/g, "");
    const message = String(b.message || "").trim();
    const history: ChatMessage[] = Array.isArray(b.history) ? b.history.slice(-8) : [];
    if (phone.length !== 10 || !message) return NextResponse.json({ error: "bad input" }, { status: 400 });

    const queryEmbedding = await embed(message);
    const { data, error } = await supabase().rpc("match_mistakes", {
      query_embedding: queryEmbedding,
      match_phone: phone,
      match_count: 6,
    });
    if (error) throw error;
    const matches = (data ?? []) as Match[];

    const context = matches.length
      ? matches
          .map(
            (m) =>
              `- [${m.topic || "?"}] "${m.question_text}" — they said: "${m.transcript || "(no note)"}" — slipped on: ${TAG_SHORT[m.error_tag as ErrorTag] ?? m.error_tag ?? "?"}`,
          )
          .join("\n")
      : "(No matching past mistakes found for this question.)";

    const system: ChatMessage = {
      role: "system",
      content: `You are "Coach" inside CheckMyPaper — the student's favourite teacher: fun, caring, and genuinely invested in them, with an expert eye for exactly where they slip. You can see THEIR real past mistakes below. Ground everything in that data; never invent mistakes that aren't listed.

HOW TO RESPOND:
- If the student raises a NEW or vague struggle (e.g. "I don't get chemical bonding"), do NOT lecture yet. First ask 1-2 short, specific follow-up questions to pin down what exactly confuses them (which part? what goes wrong when they try?). If their logged mistakes hint at the answer, mention it while asking ("I see you mixed up X twice — is that the part?"). Keep this under 60 words.
- Once the problem is clear, answer with: one bold headline naming the core issue, then 2-3 short bullets (each with a bold 2-4 word lead-in) explaining it with evidence from their mistakes, then ONE concrete step starting with "**Do this:**".
- After an answer, end with one short check-in question ("Does that click, or should we go slower on X?") and keep following up until they say it's clear.

RULES: warm, playful, encouraging — like a teacher they actually like; simple words a 15-year-old understands; under 130 words total; never use internal tag names (say "calculation slip" not "calc_slip", "misread the question" not "misread", "concept gap" not "concept"); no headings, no tables, no nested lists.

THE STUDENT'S RELEVANT PAST MISTAKES:
${context}`,
    };

    const answer = await deepseekChat([system, ...history, { role: "user", content: message }], 700);
    return NextResponse.json({
      answer: answer || "I couldn't generate a reply just now — try again.",
      configured: true,
      usedTopics: [...new Set(matches.map((m) => m.topic).filter(Boolean))],
    });
  } catch (err) {
    console.error("tutor chat error", err);
    return NextResponse.json({ answer: "Something went wrong — try again.", error: true }, { status: 500 });
  }
}
