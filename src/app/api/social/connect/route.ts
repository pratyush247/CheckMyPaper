import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";
import { canonicalPair, normalizeHandle } from "@/lib/social";

export const maxDuration = 30;

// POST { phone, name, by:'handle'|'code', value } → send/auto-accept a friend request
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const me = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    if (me.length !== 10 || !name) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    await upsertStudent(me, name);

    const by = b.by === "code" ? "code" : "handle";
    const q = by === "code" ? String(b.value || "").trim().toUpperCase() : normalizeHandle(String(b.value || ""));
    if (!q) return NextResponse.json({ ok: false, error: "Enter a handle or code" }, { status: 400 });
    const target = await supabase()
      .from("handles")
      .select("phone")
      .eq(by === "code" ? "invite_code" : "handle", q)
      .maybeSingle();
    const other = target.data?.phone as string | undefined;
    if (!other) return NextResponse.json({ ok: false, error: "No one found for that" }, { status: 404 });
    if (other === me) return NextResponse.json({ ok: false, error: "That's you 🙂" }, { status: 400 });

    const [low, high] = canonicalPair(me, other);
    const existing = await supabase().from("friendships").select("id,status,requester_phone").eq("low_phone", low).eq("high_phone", high).maybeSingle();

    if (existing.data) {
      const f = existing.data;
      if (f.status === "blocked") return NextResponse.json({ ok: false, error: "Unavailable" }, { status: 403 });
      if (f.status === "accepted") return NextResponse.json({ ok: true, status: "accepted" });
      // pending: if the other person already requested me, accept it
      if (f.requester_phone === other) {
        await supabase().from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", f.id);
        return NextResponse.json({ ok: true, status: "accepted" });
      }
      return NextResponse.json({ ok: true, status: "pending" }); // my own pending already exists
    }

    await supabase().from("friendships").insert({
      requester_phone: me, addressee_phone: other, low_phone: low, high_phone: high, status: "pending",
    });
    return NextResponse.json({ ok: true, status: "pending" });
  } catch (err) {
    console.error("connect error", err);
    return NextResponse.json({ ok: false, error: "connect failed" }, { status: 500 });
  }
}
