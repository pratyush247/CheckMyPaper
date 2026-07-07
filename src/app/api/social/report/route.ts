import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";

export const maxDuration = 30;

// POST { reporter, target, messageId?, reason }
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const reporter = String(b.reporter || "").replace(/\D/g, "");
    const target = String(b.target || "").replace(/\D/g, "");
    if (reporter.length !== 10 || target.length !== 10) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    await supabase().from("reports").insert({
      reporter_phone: reporter, target_phone: target,
      message_id: b.messageId ? String(b.messageId) : null, reason: String(b.reason || "").slice(0, 500),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("report error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
