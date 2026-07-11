import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";
import { allVoted, resolveVote, type VoteOption } from "@/lib/social";
import { createChallengeRecord } from "@/lib/challengeServer";

export const maxDuration = 120;

// POST { voteId, phone, optionId } → record a vote. When everyone has voted the
// winner is resolved and a challenge is created (once, via an atomic claim).
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const voteId = String(b.voteId || "");
    const phone = String(b.phone || "").replace(/\D/g, "");
    const optionId = String(b.optionId || "");
    if (!voteId || phone.length !== 10 || !optionId) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });

    const cur = await supabase().from("challenge_votes").select("*").eq("id", voteId).maybeSingle();
    if (!cur.data) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    // Already resolved → just return the outcome.
    if (cur.data.status === "closed") {
      return NextResponse.json({ ok: true, closed: true, challengeId: cur.data.challenge_id, votes: cur.data.votes });
    }

    const options = (cur.data.options ?? []) as VoteOption[];
    if (!options.some((o) => o.id === optionId)) return NextResponse.json({ ok: false, error: "bad option" }, { status: 400 });
    const participants: string[] = cur.data.participant_phones ?? [];
    if (!participants.includes(phone)) return NextResponse.json({ ok: false, error: "not a participant" }, { status: 403 });

    const votes: Record<string, string> = { ...(cur.data.votes ?? {}), [phone]: optionId };
    await supabase().from("challenge_votes").update({ votes }).eq("id", voteId);

    if (!allVoted(participants, votes)) {
      return NextResponse.json({ ok: true, closed: false, votes });
    }

    // Everyone voted — claim the resolution atomically so only one request
    // creates the challenge, even if both final votes land together.
    const claim = await supabase()
      .from("challenge_votes")
      .update({ status: "closed" })
      .eq("id", voteId)
      .eq("status", "open")
      .select("id")
      .maybeSingle();
    if (!claim.data) {
      // Another request already resolved it — return the settled state.
      const re = await supabase().from("challenge_votes").select("challenge_id, votes").eq("id", voteId).maybeSingle();
      return NextResponse.json({ ok: true, closed: true, challengeId: re.data?.challenge_id, votes: re.data?.votes ?? votes });
    }

    const winner = resolveVote(options, votes)!;
    const { challengeId } = await createChallengeRecord({
      creatorPhone: cur.data.creator_phone,
      topic: winner.topic,
      subject: winner.subject,
      participants,
      threadId: cur.data.thread_id,
      postCard: false, // the vote card itself shows the resolved challenge
    });
    await supabase()
      .from("challenge_votes")
      .update({ chosen_topic: winner.topic, chosen_subject: winner.subject, challenge_id: challengeId })
      .eq("id", voteId);

    return NextResponse.json({ ok: true, closed: true, challengeId, chosenTopic: winner.topic, votes });
  } catch (err) {
    console.error("vote cast error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
