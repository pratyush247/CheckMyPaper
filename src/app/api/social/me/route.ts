import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";

export const maxDuration = 30;

// GET /api/social/me?phone=  → my handle, invite code, bio, pending request count
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, handle: null, inviteCode: null, bio: null, pending: 0 });
  const phone = (new URL(req.url).searchParams.get("phone") || "").replace(/\D/g, "");
  if (phone.length !== 10) return NextResponse.json({ configured: true, handle: null, inviteCode: null, bio: null, pending: 0 });
  try {
    const h = await supabase().from("handles").select("handle, invite_code, bio").eq("phone", phone).maybeSingle();
    const { count } = await supabase()
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("addressee_phone", phone)
      .eq("status", "pending");
    return NextResponse.json({
      configured: true,
      handle: h.data?.handle ?? null,
      inviteCode: h.data?.invite_code ?? null,
      bio: h.data?.bio ?? null,
      pending: count ?? 0,
    });
  } catch (err) {
    console.error("social me error", err);
    return NextResponse.json({ configured: true, handle: null, inviteCode: null, bio: null, pending: 0, error: "failed" }, { status: 500 });
  }
}

// POST { phone, bio } → update my flauntable bio (≤120 chars)
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const phone = String(b.phone || "").replace(/\D/g, "");
    const bio = String(b.bio ?? "").trim().slice(0, 120);
    if (phone.length !== 10) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    await supabase().from("handles").update({ bio: bio || null }).eq("phone", phone);
    return NextResponse.json({ ok: true, bio: bio || null });
  } catch (err) {
    console.error("bio update error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
