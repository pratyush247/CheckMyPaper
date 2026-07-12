import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";
import { type TopicRef } from "@/lib/social";

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

// (The old GET ?me=&peer= common-topics endpoint is gone — the server now
// picks challenge topics itself via the syllabus ladder in challengeServer.)
