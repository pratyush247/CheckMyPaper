import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";
import { commonWeakTopics, commonSubjects, type TopicRef } from "@/lib/social";

export const maxDuration = 30;

function clean(list: unknown): TopicRef[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((t) => ({ topic: String((t as TopicRef)?.topic || "").trim(), subject: String((t as TopicRef)?.subject || "Unknown").trim() }))
    .filter((t) => t.topic)
    .slice(0, 40);
}

// POST { phone, topics: [{topic, subject}] } → store this device's weak topics
// on the player's handle so friends can find common ground for a challenge.
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const phone = String(b.phone || "").replace(/\D/g, "");
    if (phone.length !== 10) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    const { error } = await supabase().from("handles").update({ weak_topics: clean(b.topics) }).eq("phone", phone);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("weak-topics sync error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

// GET ?me=&peer= → the topics both are weak at, plus shared subjects for the
// fallback vote when there is no exact common topic.
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, common: [], subjects: [] });
  const url = new URL(req.url);
  const me = (url.searchParams.get("me") || "").replace(/\D/g, "");
  const peer = (url.searchParams.get("peer") || "").replace(/\D/g, "");
  if (me.length !== 10 || peer.length !== 10) return NextResponse.json({ configured: true, common: [], subjects: [] });
  try {
    const { data } = await supabase().from("handles").select("phone, weak_topics").in("phone", [me, peer]);
    const mine = clean((data ?? []).find((r) => r.phone === me)?.weak_topics);
    const theirs = clean((data ?? []).find((r) => r.phone === peer)?.weak_topics);
    return NextResponse.json({
      configured: true,
      common: commonWeakTopics(mine, theirs),
      subjects: commonSubjects(mine, theirs),
    });
  } catch (err) {
    console.error("weak-topics common error", err);
    return NextResponse.json({ configured: true, common: [], subjects: [] });
  }
}
