import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";
import { rankChallenge } from "@/lib/social";

export const maxDuration = 30;

// POST { challengeId, phone, score, timeMs } → record a score; close + post result when all played
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const challengeId = String(b.challengeId || "");
    const phone = String(b.phone || "").replace(/\D/g, "");
    const score = Number(b.score);
    const timeMs = Number(b.timeMs);
    if (!challengeId || phone.length !== 10 || Number.isNaN(score) || Number.isNaN(timeMs)) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });

    await supabase().from("challenge_scores").upsert({ challenge_id: challengeId, phone, score, time_ms: timeMs }, { onConflict: "challenge_id,phone" });

    const c = await supabase().from("challenges").select("participant_phones,thread_id,topic,status").eq("id", challengeId).maybeSingle();
    const { data: sc } = await supabase().from("challenge_scores").select("phone,score,time_ms").eq("challenge_id", challengeId);
    const ranked = rankChallenge((sc ?? []).map((s) => ({ phone: s.phone as string, score: s.score as number, timeMs: s.time_ms as number })));

    const participants: string[] = c.data?.participant_phones ?? [];
    const allPlayed = participants.length > 0 && participants.every((p) => ranked.some((r) => r.phone === p));
    if (allPlayed && c.data?.status !== "closed") {
      await supabase().from("challenges").update({ status: "closed" }).eq("id", challengeId);
      if (c.data?.thread_id) {
        await supabase().from("dm_messages").insert({
          thread_id: c.data.thread_id, sender_phone: phone, kind: "result", body: `Result: ${c.data.topic}`,
          meta: { challengeId, ranked },
        });
        await supabase().from("dm_threads").update({ last_message_at: new Date().toISOString() }).eq("id", c.data.thread_id);
      }
    }
    return NextResponse.json({ ok: true, ranked, closed: allPlayed });
  } catch (err) {
    console.error("challenge score error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
