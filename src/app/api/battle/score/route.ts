import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";

export const maxDuration = 30;

// Record a battle result to the shared leaderboard. No-op (configured:false) when
// Supabase isn't set up, so the client falls back to local/simulated boards.
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const phone = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    const topic = String(b.topic || "").trim();
    const score = Math.max(0, Math.min(10, Number(b.score)));
    const timeMs = Math.max(0, Number(b.timeMs) || 0);
    if (phone.length !== 10 || !name || !topic) {
      return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    }
    await upsertStudent(phone, name);
    const { error } = await supabase().from("battle_scores").insert({ phone, topic, score, time_ms: timeMs });
    if (error) throw error;
    return NextResponse.json({ ok: true, configured: true });
  } catch (err) {
    console.error("score error", err);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
