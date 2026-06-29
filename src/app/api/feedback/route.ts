import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";

export const maxDuration = 30;

// POST: submit feedback (reaction / idea / bug / love). No-op when unconfigured.
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const type = String(b.type || "").trim();
    if (!["reaction", "idea", "bug", "love"].includes(type)) {
      return NextResponse.json({ ok: false, error: "bad type" }, { status: 400 });
    }
    const { error } = await supabase().from("feedback").insert({
      phone: b.phone ? String(b.phone).replace(/\D/g, "") : null,
      name: b.name ? String(b.name).trim() : null,
      type,
      target: b.target ? String(b.target).slice(0, 60) : null,
      rating: b.rating === "up" || b.rating === "down" ? b.rating : null,
      message: b.message ? String(b.message).slice(0, 2000) : null,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, configured: true });
  } catch (err) {
    console.error("feedback submit error", err);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}

// GET ?token=ADMIN_TOKEN : list recent feedback for review.
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, items: [] });
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { data, error } = await supabase()
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;
    return NextResponse.json({ configured: true, items: data ?? [] });
  } catch (err) {
    console.error("feedback list error", err);
    return NextResponse.json({ items: [], error: "fetch failed" }, { status: 500 });
  }
}
