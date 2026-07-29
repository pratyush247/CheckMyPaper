import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured, upsertStudent, broadcast } from "@/lib/supabaseServer";
import { canonicalPair, blockState } from "@/lib/social";

export const maxDuration = 30;

async function friendship(me: string, peer: string) {
  const [low, high] = canonicalPair(me, peer);
  const { data } = await supabase().from("friendships").select("status,blocked_by").eq("low_phone", low).eq("high_phone", high).maybeSingle();
  return data as { status: string; blocked_by: string | null } | null;
}

async function resolveThread(me: string, peer: string): Promise<string | null> {
  const f = await friendship(me, peer);
  if (!f || f.status !== "accepted") return null;
  const [a, b] = canonicalPair(me, peer);
  const existing = await supabase().from("dm_threads").select("id").eq("a_phone", a).eq("b_phone", b).maybeSingle();
  if (existing.data) return existing.data.id as string;
  const created = await supabase().from("dm_threads").insert({ a_phone: a, b_phone: b }).select("id").single();
  return (created.data?.id as string) ?? null;
}

function mapMsg(m: Record<string, unknown>) {
  return { id: m.id, sender: m.sender_phone, body: m.body, kind: m.kind, meta: m.meta ?? null, createdAt: m.created_at };
}

// GET ?phone=&peer=&since=  → poll messages (max 100, after `since`)
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, threadId: null, messages: [] });
  const url = new URL(req.url);
  const me = (url.searchParams.get("phone") || "").replace(/\D/g, "");
  const peer = (url.searchParams.get("peer") || "").replace(/\D/g, "");
  const since = url.searchParams.get("since");
  if (me.length !== 10 || peer.length !== 10) return NextResponse.json({ configured: true, threadId: null, messages: [] });
  try {
    const threadId = await resolveThread(me, peer);
    if (!threadId) return NextResponse.json({ configured: true, threadId: null, messages: [] });
    let query = supabase().from("dm_messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(100);
    if (since) query = query.gt("created_at", since);
    const { data } = await query;
    return NextResponse.json({ configured: true, threadId, messages: (data ?? []).map(mapMsg) });
  } catch (err) {
    console.error("messages get error", err);
    return NextResponse.json({ configured: true, threadId: null, messages: [], error: "failed" }, { status: 500 });
  }
}

// POST { phone, name, peer, body }
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, configured: false });
  try {
    const b = await req.json();
    const me = String(b.phone || "").replace(/\D/g, "");
    const name = String(b.name || "").trim();
    const peer = String(b.peer || "").replace(/\D/g, "");
    const body = String(b.body || "").trim();
    const kind = b.kind === "sticker" ? "sticker" : "text";
    if (me.length !== 10 || peer.length !== 10 || !body) return NextResponse.json({ ok: false, error: "bad input" }, { status: 400 });
    if (body.length > 2000) return NextResponse.json({ ok: false, error: "too long" }, { status: 400 });
    if (name) await upsertStudent(me, name);

    const f = await friendship(me, peer);
    if (blockState(f, me) !== "none") return NextResponse.json({ ok: false, error: "unavailable" }, { status: 403 });
    const threadId = await resolveThread(me, peer);
    if (!threadId) return NextResponse.json({ ok: false, error: "not connected" }, { status: 403 });

    const ins = await supabase().from("dm_messages").insert({ thread_id: threadId, sender_phone: me, body, kind }).select("*").single();
    await supabase().from("dm_threads").update({ last_message_at: new Date().toISOString() }).eq("id", threadId);
    const message = mapMsg(ins.data as Record<string, unknown>);
    await broadcast(`dm:${threadId}`, "message", message);
    return NextResponse.json({ ok: true, message });
  } catch (err) {
    console.error("messages post error", err);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
