import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, broadcast } from "@/lib/supabaseServer";

export const maxDuration = 15;

// Live mid-quiz progress: fire-and-forget broadcast to everyone in the battle.
// Nothing is stored — it only feeds the little "rival" box on opponents' screens.
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false });
  try {
    const b = await req.json();
    const challengeId = String(b.challengeId || "");
    const phone = String(b.phone || "").replace(/\D/g, "");
    if (!challengeId || phone.length !== 10) return NextResponse.json({ ok: false }, { status: 400 });
    await broadcast(`battle:${challengeId}`, "progress", {
      phone,
      answered: Math.max(0, Number(b.answered) || 0),
      score: Math.max(0, Number(b.score) || 0),
      timeMs: Math.max(0, Number(b.timeMs) || 0),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
