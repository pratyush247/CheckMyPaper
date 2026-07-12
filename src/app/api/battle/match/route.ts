import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent, broadcast } from "@/lib/supabaseServer";
import { createChallengeRecord } from "@/lib/challengeServer";
import { SYLLABUS, type CoreSubject } from "@/lib/syllabus";

export const maxDuration = 120;

interface QueueRow { phone: string; klass: string; subject: string; topic: string | null; size: number; rating: number; enqueued_at: string }

// The rating window starts at ±150 and widens +50 every 10s the longest-waiting
// player has been in queue, so nobody waits forever.
function windowFor(rows: QueueRow[]): number {
  const oldest = Math.min(...rows.map((r) => new Date(r.enqueued_at).getTime()));
  return 150 + 50 * Math.floor((Date.now() - oldest) / 10_000);
}

function pickOnlineTopic(subject: CoreSubject, klass: string, topic: string | null, avgRating: number): { topic: string; difficulty: 1 | 2 | 3 } {
  const difficulty: 1 | 2 | 3 = avgRating >= 1200 ? 3 : avgRating >= 1050 ? 2 : 1;
  if (topic) return { topic, difficulty };
  const ladder = SYLLABUS[subject].filter((t) => klass === "Dropper" || t.klass === klass);
  const atTier = ladder.filter((t) => t.difficulty === difficulty);
  const pool = atTier.length ? atTier : ladder;
  return { topic: pool[Math.floor(Math.random() * pool.length)].name, difficulty };
}

// Try to form a lobby around `me`. Returns the challengeId when matched.
// ponytail: optimistic delete-claim, no queue lock — a rare double-match race
// just puts a player in one lobby and drops them from the queue; add a
// SELECT ... FOR UPDATE rpc if it ever bites at scale.
async function tryMatch(me: QueueRow, force: boolean): Promise<string | null> {
  let q = supabase()
    .from("match_queue")
    .select("*")
    .eq("subject", me.subject)
    .eq("size", me.size)
    .eq("klass", me.klass)
    .order("enqueued_at", { ascending: true });
  if (me.topic) q = q.eq("topic", me.topic);
  const { data } = await q;
  const rows = ((data ?? []) as QueueRow[]).filter((r) => r.topic === me.topic || (!r.topic && !me.topic));
  if (rows.length < 2) return null;

  const win = windowFor(rows);
  const near = rows.filter((r) => Math.abs(r.rating - me.rating) <= win);
  const need = force ? 2 : me.size;
  if (near.length < need) return null;
  const lobby = near.slice(0, me.size);

  // Claim: remove the lobby from the queue; whoever we lost the race on is skipped.
  const { data: claimed } = await supabase()
    .from("match_queue")
    .delete()
    .in("phone", lobby.map((r) => r.phone))
    .select("phone");
  const players = (claimed ?? []).map((r) => r.phone as string);
  if (players.length < 2) return null;

  const avg = lobby.reduce((s, r) => s + r.rating, 0) / lobby.length;
  const pick = pickOnlineTopic(me.subject as CoreSubject, me.klass, me.topic, avg);
  const { challengeId } = await createChallengeRecord({
    creatorPhone: me.phone,
    topic: pick.topic,
    subject: me.subject,
    participants: players,
    difficulty: pick.difficulty,
    postCard: false,
  });
  for (const p of players) {
    await broadcast(`user:${p}`, "matched", { challengeId, topic: pick.topic, players: players.length });
  }
  return challengeId;
}

// POST { action: "join"|"leave"|"force", phone, name?, klass?, subject?, topic?, size? }
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const phone = String(b.phone || "").replace(/\D/g, "");
    if (phone.length !== 10) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });

    if (b.action === "leave") {
      await supabase().from("match_queue").delete().eq("phone", phone);
      return NextResponse.json({ ok: true });
    }

    if (b.action === "join" || b.action === "force") {
      const subject = String(b.subject || "");
      const klass = String(b.klass || "Dropper");
      const size = [2, 4, 6, 8].includes(Number(b.size)) ? Number(b.size) : 2;
      const topic = String(b.topic || "").trim() || null;
      if (!["Physics", "Chemistry", "Maths"].includes(subject)) return NextResponse.json({ ok: false, error: "pick a subject" }, { status: 400 });
      if (b.name) await upsertStudent(phone, String(b.name));

      const { data: s } = await supabase().from("students").select("rating").eq("phone", phone).maybeSingle();
      const rating = (s?.rating as number) ?? 1000;
      const row: QueueRow = { phone, klass, subject, topic, size, rating, enqueued_at: new Date().toISOString() };
      if (b.action === "join") {
        await supabase().from("match_queue").upsert({ phone, klass, subject, topic, size, rating }, { onConflict: "phone" });
      }

      const challengeId = await tryMatch(row, b.action === "force");
      if (challengeId) return NextResponse.json({ ok: true, matched: true, challengeId });

      // Not matched yet — report how many are waiting on the same key.
      const { count } = await supabase()
        .from("match_queue")
        .select("phone", { count: "exact", head: true })
        .eq("subject", subject).eq("size", size).eq("klass", klass);
      return NextResponse.json({ ok: true, matched: false, waiting: count ?? 1 });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (err) {
    console.error("match error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
