import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";

export const maxDuration = 30;

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
