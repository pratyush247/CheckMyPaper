import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent, broadcast } from "@/lib/supabaseServer";
import { canonicalPair, normalizeHandle } from "@/lib/social";

export const maxDuration = 30;

const MAX_MEMBERS = 8;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
const genCode = () =>
  Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

async function memberCount(code: string): Promise<number> {
  const { count } = await supabase().from("group_members").select("phone", { count: "exact", head: true }).eq("group_code", code);
  return count ?? 0;
}

// GET /api/group?phone=...           → groups this student belongs to
// GET /api/group?members=CODE        → members of a group (with @handle + name)
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, groups: [], members: [] });
  const url = new URL(req.url);
  const membersCode = url.searchParams.get("members");
  try {
    if (membersCode) {
      const code = membersCode.trim().toUpperCase();
      const { data: mem } = await supabase().from("group_members").select("phone, joined_at").eq("group_code", code).order("joined_at", { ascending: true });
      const phones = (mem ?? []).map((m) => m.phone as string);
      if (phones.length === 0) return NextResponse.json({ configured: true, members: [] });
      const { data: hs } = await supabase().from("handles").select("phone, handle").in("phone", phones);
      const { data: ss } = await supabase().from("students").select("phone, name").in("phone", phones);
      const handleFor = new Map((hs ?? []).map((h) => [h.phone as string, h.handle as string]));
      const nameFor = new Map((ss ?? []).map((s) => [s.phone as string, s.name as string]));
      const members = phones.map((p) => ({ phone: p, handle: handleFor.get(p) ?? null, name: nameFor.get(p) ?? "" }));
      return NextResponse.json({ configured: true, members });
    }

    const phone = url.searchParams.get("phone")?.replace(/\D/g, "");
    if (!phone) return NextResponse.json({ configured: true, groups: [] });
    const { data } = await supabase()
      .from("group_members")
      .select("group_code, groups(name, owner_phone)")
      .eq("phone", phone);
    const groups = (data ?? []).map((m) => {
      const g = Array.isArray(m.groups) ? m.groups[0] : m.groups;
      return { code: m.group_code as string, name: (g as { name: string } | null)?.name ?? "Group", owner: (g as { owner_phone?: string } | null)?.owner_phone ?? "" };
    });
    return NextResponse.json({ configured: true, groups });
  } catch (err) {
    console.error("group list error", err);
    return NextResponse.json({ configured: true, groups: [], members: [], error: "fetch failed" }, { status: 500 });
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
      const mine = await supabase().from("group_members").select("phone").eq("group_code", code).eq("phone", phone).maybeSingle();
      if (!mine.data && (await memberCount(code)) >= MAX_MEMBERS) {
        return NextResponse.json({ ok: false, error: "Squad is full (8 max)" }, { status: 409 });
      }
      await supabase().from("group_members").upsert({ group_code: code, phone }, { onConflict: "group_code,phone" });
      await broadcast(`squad:${code}`, "members", { code });
      return NextResponse.json({ ok: true, code: group.code, name: group.name });
    }

    // Add an accepted friend to my group by @handle (only accepted friends).
    if (b.action === "add") {
      const code = String(b.code || "").trim().toUpperCase();
      const handle = normalizeHandle(String(b.handle || ""));
      const g = await supabase().from("groups").select("code").eq("code", code).maybeSingle();
      if (!g.data) return NextResponse.json({ ok: false, error: "No group with that code" }, { status: 404 });
      const iAmIn = await supabase().from("group_members").select("phone").eq("group_code", code).eq("phone", phone).maybeSingle();
      if (!iAmIn.data) return NextResponse.json({ ok: false, error: "Join the squad first" }, { status: 403 });

      const h = await supabase().from("handles").select("phone").eq("handle", handle).maybeSingle();
      if (!h.data) return NextResponse.json({ ok: false, error: "No one with that @handle" }, { status: 404 });
      const target = h.data.phone as string;
      if (target === phone) return NextResponse.json({ ok: false, error: "That's you" }, { status: 400 });

      const [low, high] = canonicalPair(phone, target);
      const f = await supabase().from("friendships").select("status").eq("low_phone", low).eq("high_phone", high).maybeSingle();
      if (!f.data || f.data.status !== "accepted") {
        return NextResponse.json({ ok: false, error: "You can only add friends who accepted your request" }, { status: 403 });
      }
      const already = await supabase().from("group_members").select("phone").eq("group_code", code).eq("phone", target).maybeSingle();
      if (!already.data && (await memberCount(code)) >= MAX_MEMBERS) {
        return NextResponse.json({ ok: false, error: "Squad is full (8 max)" }, { status: 409 });
      }
      await supabase().from("group_members").upsert({ group_code: code, phone: target }, { onConflict: "group_code,phone" });
      await broadcast(`squad:${code}`, "members", { code });
      await broadcast(`user:${target}`, "squad-added", { code });
      return NextResponse.json({ ok: true, code });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (err) {
    console.error("group error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
