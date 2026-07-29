import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";

export const maxDuration = 30;

// GET /api/social/profile?phone= → does this student already exist, and who
// are they? Powers number-only login for returning users on a fresh device.
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, exists: false });
  const phone = (new URL(req.url).searchParams.get("phone") || "").replace(/\D/g, "");
  if (phone.length !== 10) return NextResponse.json({ configured: true, exists: false });
  try {
    const { data } = await supabase()
      .from("students")
      .select("name, class, weak_subject")
      .eq("phone", phone)
      .maybeSingle();
    if (!data?.name) return NextResponse.json({ configured: true, exists: false });
    return NextResponse.json({
      configured: true,
      exists: true,
      name: data.name as string,
      klass: (data.class as string | null) ?? undefined,
      weakSubject: (data.weak_subject as string | null) ?? undefined,
    });
  } catch (err) {
    console.error("profile lookup error", err);
    return NextResponse.json({ configured: true, exists: false, error: "failed" }, { status: 500 });
  }
}

// POST { phone, name, klass?, weakSubject? } → mirror the device profile to the
// students table (best-effort; the device stays the source of truth).
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const phone = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    if (phone.length !== 10 || !name) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    await upsertStudent(phone, name, {
      klass: b.klass ? String(b.klass).trim() : undefined,
      weakSubject: b.weakSubject ? String(b.weakSubject).trim() : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("profile sync error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
