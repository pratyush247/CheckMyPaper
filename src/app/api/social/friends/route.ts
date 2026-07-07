import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";

export const maxDuration = 30;

type Row = { id: string; requester_phone: string; addressee_phone: string; status: string };

// GET /api/social/friends?phone=  → accepted friends (+ friendship id) and pending in/out
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, friends: [], incoming: [], outgoing: [] });
  const me = (new URL(req.url).searchParams.get("phone") || "").replace(/\D/g, "");
  if (me.length !== 10) return NextResponse.json({ configured: true, friends: [], incoming: [], outgoing: [] });
  try {
    const { data } = await supabase()
      .from("friendships")
      .select("id,requester_phone,addressee_phone,status")
      .or(`requester_phone.eq.${me},addressee_phone.eq.${me}`);
    const rows = (data ?? []) as Row[];
    const others = rows.map((r) => (r.requester_phone === me ? r.addressee_phone : r.requester_phone));
    const { data: hs } = await supabase().from("handles").select("phone, handle, students(name)").in("phone", others.length ? others : ["_"]);
    const info = new Map<string, { handle: string; name: string }>();
    for (const h of hs ?? []) {
      const s = Array.isArray(h.students) ? h.students[0] : h.students;
      info.set(h.phone as string, { handle: h.handle as string, name: (s as { name: string } | null)?.name ?? "" });
    }
    const pick = (p: string) => ({ phone: p, handle: info.get(p)?.handle ?? "", name: info.get(p)?.name ?? "" });

    const friends = rows.filter((r) => r.status === "accepted").map((r) => ({ id: r.id, ...pick(r.requester_phone === me ? r.addressee_phone : r.requester_phone) }));
    const incoming = rows.filter((r) => r.status === "pending" && r.addressee_phone === me).map((r) => ({ id: r.id, ...pick(r.requester_phone) }));
    const outgoing = rows.filter((r) => r.status === "pending" && r.requester_phone === me).map((r) => ({ id: r.id, ...pick(r.addressee_phone) }));
    return NextResponse.json({ configured: true, friends, incoming, outgoing });
  } catch (err) {
    console.error("friends list error", err);
    return NextResponse.json({ configured: true, friends: [], incoming: [], outgoing: [], error: "failed" }, { status: 500 });
  }
}
