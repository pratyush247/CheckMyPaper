import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";

export const maxDuration = 30;

// POST { phone, friendshipId, action:'accept'|'decline'|'block' }
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const me = String(b.phone || "").replace(/\D/g, "");
    const id = String(b.friendshipId || "");
    const action = b.action;
    if (me.length !== 10 || !id) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });

    const row = await supabase().from("friendships").select("id,requester_phone,addressee_phone").eq("id", id).maybeSingle();
    if (!row.data) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    if (me !== row.data.requester_phone && me !== row.data.addressee_phone) return NextResponse.json({ ok: false, error: "not yours" }, { status: 403 });

    if (action === "accept") {
      await supabase().from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", id);
    } else if (action === "block") {
      await supabase().from("friendships").update({ status: "blocked", blocked_by: me, updated_at: new Date().toISOString() }).eq("id", id);
    } else {
      await supabase().from("friendships").delete().eq("id", id); // decline
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("respond error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
