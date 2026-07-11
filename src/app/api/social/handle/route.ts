import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";
import { normalizeHandle, isValidHandle, genInviteCode } from "@/lib/social";

export const maxDuration = 30;

// GET /api/social/handle?q=&me=  → search handles by prefix (max 10, excludes me)
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, results: [] });
  const url = new URL(req.url);
  const q = normalizeHandle(url.searchParams.get("q") || "");
  const me = (url.searchParams.get("me") || "").replace(/\D/g, "");
  if (q.length < 2) return NextResponse.json({ configured: true, results: [] });
  try {
    const { data } = await supabase()
      .from("handles")
      .select("handle, phone, students(name)")
      .ilike("handle", `${q}%`)
      .limit(11);
    const results = (data ?? [])
      .filter((r) => r.phone !== me)
      .slice(0, 10)
      .map((r) => {
        const s = Array.isArray(r.students) ? r.students[0] : r.students;
        return { handle: r.handle as string, phone: r.phone as string, name: (s as { name: string } | null)?.name ?? "" };
      });
    return NextResponse.json({ configured: true, results });
  } catch (err) {
    console.error("handle search error", err);
    return NextResponse.json({ configured: true, results: [], error: "search failed" }, { status: 500 });
  }
}

// POST { phone, name, handle } → claim a handle (once)
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const phone = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    const handle = normalizeHandle(String(b.handle || ""));
    if (phone.length !== 10 || !name) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    if (!isValidHandle(handle)) return NextResponse.json({ ok: false, error: "Handle must be 3–20 chars, start with a letter, use a–z 0–9 _" }, { status: 400 });
    await upsertStudent(phone, name);

    const existing = await supabase().from("handles").select("handle, invite_code").eq("phone", phone).maybeSingle();
    if (existing.data) return NextResponse.json({ ok: true, handle: existing.data.handle, inviteCode: existing.data.invite_code, already: true });

    for (let i = 0; i < 5; i++) {
      const invite_code = genInviteCode();
      const { error } = await supabase().from("handles").insert({ phone, handle, invite_code });
      if (!error) return NextResponse.json({ ok: true, handle, inviteCode: invite_code });
      if (error.code === "23505" && String(error.message).includes("handle")) return NextResponse.json({ ok: false, error: "That handle is taken" }, { status: 409 });
      if (error.code === "23505") continue; // invite_code collision → retry with a new code
      // Any other error (missing table, schema mismatch, …): surface it, don't spin.
      console.error("handle insert error", error);
      return NextResponse.json({ ok: false, error: error.message || "Could not claim, try again" }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "Could not claim, try again" }, { status: 500 });
  } catch (err) {
    console.error("handle claim error", err);
    return NextResponse.json({ ok: false, error: "claim failed" }, { status: 500 });
  }
}
