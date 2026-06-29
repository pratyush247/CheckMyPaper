import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";
import { embed, embeddingsEnabled } from "@/lib/embeddings";
import { deepseekChat } from "@/lib/ai";
import type { ChatMessage } from "@/lib/llm";

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
              `- [${m.topic || "?"}] "${m.question_text}" — they said: "${m.transcript || "(no note)"}" — slipped on: ${m.error_tag || "?"}`,
          )
          .join("\n")
      : "(No matching past mistakes found for this question.)";

    const system: ChatMessage = {
      role: "system",
      content: `You are the student's personal JEE tutor inside CheckMyPaper. You can see THEIR real past mistakes below. Answer their question grounded in these — point out the specific topics and recurring patterns you notice in their data. Be warm, encouraging, and use simple language a 15-year-old understands. Keep it concise (a few short paragraphs max). Do not invent mistakes that aren't listed.

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
