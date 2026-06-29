import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent } from "@/lib/supabaseServer";

export const maxDuration = 30;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
const genCode = () =>
  Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

// GET /api/group?phone=...  → groups this student belongs to
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, groups: [] });
  const phone = new URL(req.url).searchParams.get("phone")?.replace(/\D/g, "");
  if (!phone) return NextResponse.json({ configured: true, groups: [] });
  try {
    const { data } = await supabase()
      .from("group_members")
      .select("group_code, groups(name)")
      .eq("phone", phone);
    const groups = (data ?? []).map((m) => {
      const g = Array.isArray(m.groups) ? m.groups[0] : m.groups;
      return { code: m.group_code as string, name: (g as { name: string } | null)?.name ?? "Group" };
    });
    return NextResponse.json({ configured: true, groups });
  } catch (err) {
    console.error("group list error", err);
    return NextResponse.json({ configured: true, groups: [], error: "fetch failed" }, { status: 500 });
  }
}

// POST { action: "create"|"join", phone, name, groupName?, code? }
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const phone = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    if (phone.length !== 10 || !name) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    await upsertStudent(phone, name);

    if (b.action === "create") {
      const groupName = String(b.groupName || "").trim() || `${name}'s squad`;
      for (let i = 0; i < 5; i++) {
        const code = genCode();
        const { error } = await supabase().from("groups").insert({ code, name: groupName, owner_phone: phone });
        if (!error) {
          await supabase().from("group_members").insert({ group_code: code, phone });
          return NextResponse.json({ ok: true, code, name: groupName });
        }
      }
      return NextResponse.json({ ok: false, error: "could not create" }, { status: 500 });
    }

    if (b.action === "join") {
      const code = String(b.code || "").trim().toUpperCase();
      const { data: group } = await supabase().from("groups").select("code, name").eq("code", code).maybeSingle();
      if (!group) return NextResponse.json({ ok: false, error: "No group with that code" }, { status: 404 });
      await supabase().from("group_members").upsert({ group_code: code, phone }, { onConflict: "group_code,phone" });
      return NextResponse.json({ ok: true, code: group.code, name: group.name });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (err) {
    console.error("group error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
