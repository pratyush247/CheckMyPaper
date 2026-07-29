import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";
import { canonicalPair } from "@/lib/social";

export const maxDuration = 30;

// GET /api/social/peers?me=&phones=a,b,c
// For the post-battle "add as friend" popup: @handle + bio + friendship state of
// the people I just played with. Bio exposure here is allowed by design — it is
// exactly the friend-request context.
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, peers: [] });
  const url = new URL(req.url);
  const me = (url.searchParams.get("me") || "").replace(/\D/g, "");
  const phones = (url.searchParams.get("phones") || "")
    .split(",")
    .map((p) => p.replace(/\D/g, ""))
    .filter((p) => p.length === 10 && p !== me);
  if (me.length !== 10 || phones.length === 0) return NextResponse.json({ configured: true, peers: [] });
  try {
    const { data: hs } = await supabase().from("handles").select("phone, handle, bio").in("phone", phones);
    const peers = [];
    for (const h of hs ?? []) {
      const [low, high] = canonicalPair(me, h.phone as string);
      const { data: f } = await supabase().from("friendships").select("status").eq("low_phone", low).eq("high_phone", high).maybeSingle();
      peers.push({
        phone: h.phone as string,
        handle: h.handle as string,
        bio: (h.bio as string | null) ?? null,
        status: f?.status ?? "none", // none | pending | accepted | blocked
      });
    }
    return NextResponse.json({ configured: true, peers });
  } catch (err) {
    console.error("peers error", err);
    return NextResponse.json({ configured: true, peers: [], error: "failed" }, { status: 500 });
  }
}
