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

// Accepted friendship between two students?
async function isFriend(a: string, b: string): Promise<boolean> {
  const [low, high] = canonicalPair(a, b);
  const { data } = await supabase().from("friendships").select("status").eq("low_phone", low).eq("high_phone", high).maybeSingle();
  return data?.status === "accepted";
}

// GET /api/group?phone=...           → groups this student belongs to
// GET /api/group?members=CODE        → members of a group (with @handle + name)
// GET /api/group?invites=PHONE       → my pending squad invites
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, groups: [], members: [] });
  const url = new URL(req.url);
  const membersCode = url.searchParams.get("members");
  const invitesFor = url.searchParams.get("invites")?.replace(/\D/g, "");
  try {
    if (invitesFor) {
      const { data: inv } = await supabase().from("squad_invites").select("id, group_code, from_phone").eq("to_phone", invitesFor).eq("status", "pending");
      const rows = inv ?? [];
      if (rows.length === 0) return NextResponse.json({ configured: true, invites: [] });
      const codes = rows.map((r) => r.group_code as string);
      const froms = rows.map((r) => r.from_phone as string);
      const { data: gs } = await supabase().from("groups").select("code, name").in("code", codes);
      const { data: hs } = await supabase().from("handles").select("phone, handle").in("phone", froms);
      const gName = new Map((gs ?? []).map((g) => [g.code as string, g.name as string]));
      const hFor = new Map((hs ?? []).map((h) => [h.phone as string, h.handle as string]));
      const invites = rows.map((r) => ({
        id: r.id as string, code: r.group_code as string,
        groupName: gName.get(r.group_code as string) ?? "Squad",
        from: hFor.get(r.from_phone as string) ?? "",
      }));
      return NextResponse.json({ configured: true, invites });
    }
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
      const { data: group } = await supabase().from("groups").select("code, name, owner_phone").eq("code", code).maybeSingle();
      if (!group) return NextResponse.json({ ok: false, error: "No group with that code" }, { status: 404 });
      const mine = await supabase().from("group_members").select("phone").eq("group_code", code).eq("phone", phone).maybeSingle();
      // Squads are friends-only: the code works only if the owner accepted you.
      if (!mine.data && group.owner_phone !== phone && !(await isFriend(phone, group.owner_phone as string))) {
        return NextResponse.json({ ok: false, error: "Squads are friends-only — add the squad owner as a friend first" }, { status: 403 });
      }
      if (!mine.data && (await memberCount(code)) >= MAX_MEMBERS) {
        return NextResponse.json({ ok: false, error: "Squad is full (8 max)" }, { status: 409 });
      }
      await supabase().from("group_members").upsert({ group_code: code, phone }, { onConflict: "group_code,phone" });
      await broadcast(`squad:${code}`, "members", { code });
      return NextResponse.json({ ok: true, code: group.code, name: group.name });
    }

    // Ask an accepted friend to join my squad — lands on their phone as a request.
    if (b.action === "invite") {
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
      if (!(await isFriend(phone, target))) {
        return NextResponse.json({ ok: false, error: "You can only invite friends who accepted your request" }, { status: 403 });
      }
      if ((await memberCount(code)) >= MAX_MEMBERS) {
        return NextResponse.json({ ok: false, error: "Squad is full (8 max)" }, { status: 409 });
      }
      await supabase().from("squad_invites").upsert(
        { group_code: code, from_phone: phone, to_phone: target, status: "pending" },
        { onConflict: "group_code,to_phone" },
      );
      await broadcast(`user:${target}`, "squad-invite", { code });
      return NextResponse.json({ ok: true, invited: true });
    }

    // Accept / decline a squad invite (on the invitee's phone).
    if (b.action === "respondInvite") {
      const inviteId = String(b.inviteId || "");
      const accept = Boolean(b.accept);
      const inv = await supabase().from("squad_invites").select("id, group_code, from_phone, to_phone, status").eq("id", inviteId).maybeSingle();
      if (!inv.data || inv.data.to_phone !== phone) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
      if (inv.data.status !== "pending") return NextResponse.json({ ok: true, status: inv.data.status });
      if (!accept) {
        await supabase().from("squad_invites").update({ status: "declined" }).eq("id", inviteId);
        return NextResponse.json({ ok: true, status: "declined" });
      }
      const code = inv.data.group_code as string;
      if ((await memberCount(code)) >= MAX_MEMBERS) {
        return NextResponse.json({ ok: false, error: "Squad is full (8 max)" }, { status: 409 });
      }
      await supabase().from("group_members").upsert({ group_code: code, phone }, { onConflict: "group_code,phone" });
      await supabase().from("squad_invites").update({ status: "accepted" }).eq("id", inviteId);
      await broadcast(`squad:${code}`, "members", { code });
      await broadcast(`user:${inv.data.from_phone}`, "squad-invite-accepted", { code });
      return NextResponse.json({ ok: true, status: "accepted", code });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (err) {
    console.error("group error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
