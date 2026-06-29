import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";
import { embed, embeddingsEnabled } from "@/lib/embeddings";

export const maxDuration = 120;

interface InMistake {
  sourceId: string;
  questionText: string;
  transcript?: string;
  topic?: string;
  subject?: string;
  errorTag?: string;
}

// Embed and upsert a student's diagnosed mistakes into pgvector. Idempotent:
// skips mistakes already synced (by phone + source_id).
export async function POST(req: NextRequest) {
  if (!supabaseConfigured() || !embeddingsEnabled()) {
    return NextResponse.json({ ok: false, configured: false });
  }
  try {
    const b = await req.json();
    const phone = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    const mistakes: InMistake[] = Array.isArray(b.mistakes) ? b.mistakes : [];
    if (phone.length !== 10 || !name) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });

    await upsertStudent(phone, name);

    const { data: existing } = await supabase().from("mistakes").select("source_id").eq("phone", phone);
    const have = new Set((existing ?? []).map((r) => r.source_id as string));
    const todo = mistakes.filter((m) => m.sourceId && m.questionText && !have.has(m.sourceId));

    let synced = 0;
    for (const m of todo) {
      const text = `${m.topic || ""}: ${m.questionText} ${m.transcript || ""}`.trim();
      let embedding: number[];
      try {
        embedding = await embed(text);
      } catch (e) {
        console.error("embed failed", e);
        continue;
      }
      const { error } = await supabase().from("mistakes").insert({
        phone,
        source_id: m.sourceId,
        question_text: m.questionText,
        transcript: m.transcript ?? null,
        topic: m.topic ?? null,
        subject: m.subject ?? null,
        error_tag: m.errorTag ?? null,
        embedding,
      });
      if (!error) synced += 1;
    }
    return NextResponse.json({ ok: true, configured: true, synced, total: have.size + synced });
  } catch (err) {
    console.error("tutor sync error", err);
    return NextResponse.json({ ok: false, error: "sync failed" }, { status: 500 });
  }
}
