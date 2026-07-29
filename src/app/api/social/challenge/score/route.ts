import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, broadcast } from "@/lib/supabaseServer";
import { rankChallenge } from "@/lib/social";
import { perfScore, eloUpdate } from "@/lib/rating";

export const maxDuration = 30;

// When the last player finishes: score everyone's perf, move Elo ratings, and
// log one battle_results row per player (the matchmaking training data).
async function settleRatings(
  challengeId: string,
  groupCode: string | null,
  scores: { phone: string; score: number; timeMs: number }[],
  totalQuestions: number,
) {
  const phones = scores.map((s) => s.phone);
  const { data: ss } = await supabase().from("students").select("phone, rating").in("phone", phones);
  const ratingOf = new Map((ss ?? []).map((r) => [r.phone as string, (r.rating as number) ?? 1000]));

  const players = scores.map((s) => ({
    phone: s.phone,
    rating: ratingOf.get(s.phone) ?? 1000,
    perf: perfScore({ correct: s.score, total: totalQuestions, timeMs: s.timeMs }),
  }));
  const next = eloUpdate(players);

  for (const p of players) {
    const after = next.get(p.phone)!;
    await supabase().from("battle_results").upsert(
      {
        battle_id: challengeId, phone: p.phone, group_code: groupCode,
        score: scores.find((s) => s.phone === p.phone)!.score,
        time_ms: scores.find((s) => s.phone === p.phone)!.timeMs,
        perf: p.perf, rating_after: after,
      },
      { onConflict: "battle_id,phone" },
    );
    await supabase().from("students").update({ rating: after }).eq("phone", p.phone);
    await broadcast(`user:${p.phone}`, "rating", { rating: after, delta: after - p.rating });
  }
}

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

    const c = await supabase().from("challenges").select("participant_phones,thread_id,topic,status,group_code,question_set").eq("id", challengeId).maybeSingle();
    const { data: sc } = await supabase().from("challenge_scores").select("phone,score,time_ms").eq("challenge_id", challengeId);
    const ranked = rankChallenge((sc ?? []).map((s) => ({ phone: s.phone as string, score: s.score as number, timeMs: s.time_ms as number })));

    const participants: string[] = c.data?.participant_phones ?? [];
    const allPlayed = participants.length > 0 && participants.every((p) => ranked.some((r) => r.phone === p));
    if (allPlayed && c.data?.status !== "closed") {
      await supabase().from("challenges").update({ status: "closed" }).eq("id", challengeId);
      const total = Array.isArray(c.data?.question_set) ? c.data.question_set.length : 10;
      await settleRatings(
        challengeId,
        (c.data?.group_code as string | null) ?? null,
        (sc ?? []).map((s) => ({ phone: s.phone as string, score: s.score as number, timeMs: s.time_ms as number })),
        total,
      ).catch((e) => console.error("rating settle error", e));
      if (c.data?.thread_id) {
        const ins = await supabase().from("dm_messages").insert({
          thread_id: c.data.thread_id, sender_phone: phone, kind: "result", body: `Result: ${c.data.topic}`,
          meta: { challengeId, ranked },
        }).select("*").single();
        await supabase().from("dm_threads").update({ last_message_at: new Date().toISOString() }).eq("id", c.data.thread_id);
        const m = ins.data as Record<string, unknown> | null;
        if (m) await broadcast(`dm:${c.data.thread_id}`, "message", { id: m.id, sender: m.sender_phone, body: m.body, kind: m.kind, meta: m.meta ?? null, createdAt: m.created_at });
      }
    }
    await broadcast(`battle:${challengeId}`, "score", { ranked, closed: allPlayed });
    return NextResponse.json({ ok: true, ranked, closed: allPlayed });
  } catch (err) {
    console.error("challenge score error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
