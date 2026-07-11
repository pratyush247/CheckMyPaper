import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";
import type { VoteOption } from "@/lib/social";

export const maxDuration = 30;

function cleanOptions(raw: unknown): VoteOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o, i) => ({
      id: String((o as VoteOption)?.id || `o${i}`),
      topic: String((o as VoteOption)?.topic || "").trim(),
      subject: String((o as VoteOption)?.subject || "Unknown").trim() || "Unknown",
    }))
    .filter((o) => o.topic)
    .slice(0, 6);
}

// POST { phone, name, threadId, participants, options } → open a topic vote and
// drop a ballot card in the thread.
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const me = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    const threadId = b.threadId ? String(b.threadId) : null;
    const options = cleanOptions(b.options);
    const participants = Array.from(
      new Set([me, ...(Array.isArray(b.participants) ? b.participants.map((p: string) => String(p).replace(/\D/g, "")) : [])].filter((p) => p.length === 10)),
    ).slice(0, 8);
    if (me.length !== 10 || options.length === 0) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    if (name) await upsertStudent(me, name);

    const ins = await supabase()
      .from("challenge_votes")
      .insert({ thread_id: threadId, creator_phone: me, participant_phones: participants, options, votes: {}, status: "open" })
      .select("id")
      .single();
    const voteId = ins.data?.id as string;
    if (!voteId) return NextResponse.json({ ok: false, error: ins.error?.message || "create failed" }, { status: 500 });

    if (threadId) {
      await supabase().from("dm_messages").insert({
        thread_id: threadId, sender_phone: me, kind: "vote", body: "Topic vote", meta: { voteId },
      });
      await supabase().from("dm_threads").update({ last_message_at: new Date().toISOString() }).eq("id", threadId);
    }
    return NextResponse.json({ ok: true, voteId, options });
  } catch (err) {
    console.error("vote create error", err);
    return NextResponse.json({ ok: false, error: "create failed" }, { status: 500 });
  }
}

// GET ?id= → current ballot state (options, votes, status, resolved challenge).
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ configured: true, error: "no id" }, { status: 400 });
  try {
    const c = await supabase().from("challenge_votes").select("*").eq("id", id).maybeSingle();
    if (!c.data) return NextResponse.json({ configured: true, error: "not found" }, { status: 404 });
    return NextResponse.json({
      configured: true,
      id: c.data.id,
      options: c.data.options,
      votes: c.data.votes,
      participants: c.data.participant_phones,
      status: c.data.status,
      chosenTopic: c.data.chosen_topic,
      chosenSubject: c.data.chosen_subject,
      challengeId: c.data.challenge_id,
    });
  } catch (err) {
    console.error("vote get error", err);
    return NextResponse.json({ configured: true, error: "failed" }, { status: 500 });
  }
}
