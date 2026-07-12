import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";
import { rankChallenge } from "@/lib/social";
import { createChallengeRecord, pickTopicForPair } from "@/lib/challengeServer";
import type { CoreSubject } from "@/lib/syllabus";

export const maxDuration = 120;

// POST { phone, name, subject, participants?, groupCode?, threadId?, topic? }
// When no topic is given the server picks one from the JEE syllabus ladder:
// the pair's common weak areas first, beginner → advanced.
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const me = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    let topic = String(b.topic || "").trim();
    const subject = String(b.subject || "Unknown").trim() || "Unknown";
    if (me.length !== 10 || (!topic && !["Physics", "Chemistry", "Maths"].includes(subject))) {
      return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    }
    if (name) await upsertStudent(me, name);

    let participants: string[] = Array.isArray(b.participants) ? b.participants.map((p: string) => String(p).replace(/\D/g, "")) : [];
    if (b.groupCode) {
      const { data } = await supabase().from("group_members").select("phone").eq("group_code", String(b.groupCode));
      participants = (data ?? []).map((m) => m.phone as string);
    }
    participants = Array.from(new Set([me, ...participants].filter((p) => p.length === 10))).slice(0, 8);

    let difficulty: 1 | 2 | 3 | undefined;
    if (!topic) {
      const peer = participants.find((p) => p !== me) ?? me;
      const pick = await pickTopicForPair(me, peer, subject as CoreSubject);
      topic = pick.topic;
      difficulty = pick.difficulty;
    }

    const { challengeId, questions } = await createChallengeRecord({
      creatorPhone: me, topic, subject, participants, difficulty,
      threadId: b.threadId ?? null, groupCode: b.groupCode ?? null,
    });
    return NextResponse.json({ ok: true, challengeId, topic, questions });
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
