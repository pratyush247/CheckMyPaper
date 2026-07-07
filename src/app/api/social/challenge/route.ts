import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";
import { rankChallenge } from "@/lib/social";
import { generateQuiz } from "@/lib/ai";

export const maxDuration = 120;

// POST { phone, name, topic, subject?, participants?, groupCode?, threadId? }
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const me = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    const topic = String(b.topic || "").trim();
    const subject = String(b.subject || "Unknown").trim() || "Unknown";
    if (me.length !== 10 || !topic) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    if (name) await upsertStudent(me, name);

    let participants: string[] = Array.isArray(b.participants) ? b.participants.map((p: string) => String(p).replace(/\D/g, "")) : [];
    if (b.groupCode) {
      const { data } = await supabase().from("group_members").select("phone").eq("group_code", String(b.groupCode));
      participants = (data ?? []).map((m) => m.phone as string);
    }
    participants = Array.from(new Set([me, ...participants].filter((p) => p.length === 10))).slice(0, 8);

    const questions = await generateQuiz(topic, subject, 10);
    const ins = await supabase().from("challenges").insert({
      topic, creator_phone: me, question_set: questions, participant_phones: participants,
      status: "open", thread_id: b.threadId ?? null, group_code: b.groupCode ?? null,
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    }).select("id").single();
    const challengeId = ins.data?.id as string;

    if (b.threadId) {
      await supabase().from("dm_messages").insert({
        thread_id: b.threadId, sender_phone: me, kind: "challenge", body: `Challenge: ${topic}`,
        meta: { challengeId, topic },
      });
      await supabase().from("dm_threads").update({ last_message_at: new Date().toISOString() }).eq("id", b.threadId);
    }
    return NextResponse.json({ ok: true, challengeId, questions });
  } catch (err) {
    console.error("challenge create error", err);
    return NextResponse.json({ ok: false, error: "create failed" }, { status: 500 });
  }
}

// GET ?id=  → challenge topic, questions, participants, ranked scores, status
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ configured: true, error: "no id" }, { status: 400 });
  try {
    const c = await supabase().from("challenges").select("*").eq("id", id).maybeSingle();
    if (!c.data) return NextResponse.json({ configured: true, error: "not found" }, { status: 404 });
    const { data: sc } = await supabase().from("challenge_scores").select("phone,score,time_ms").eq("challenge_id", id);
    const ranked = rankChallenge((sc ?? []).map((s) => ({ phone: s.phone as string, score: s.score as number, timeMs: s.time_ms as number })));
    return NextResponse.json({
      configured: true, topic: c.data.topic, questions: c.data.question_set,
      participants: c.data.participant_phones, status: c.data.status, scores: ranked,
    });
  } catch (err) {
    console.error("challenge get error", err);
    return NextResponse.json({ configured: true, error: "failed" }, { status: 500 });
  }
}
