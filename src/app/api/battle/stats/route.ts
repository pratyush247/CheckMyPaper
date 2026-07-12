import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";

export const maxDuration = 30;

// Battle analytics, one route:
//   GET ?phone=         → my rating + totals across ALL battles
//   GET ?code=          → squad leaderboard (ranked by avg perf in that squad)
//   GET ?global=1&me=   → platform top-20 by rating + my rank
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false });
  const url = new URL(req.url);
  try {
    const phone = url.searchParams.get("phone")?.replace(/\D/g, "");
    if (phone && phone.length === 10) {
      const { data: s } = await supabase().from("students").select("rating").eq("phone", phone).maybeSingle();
      const { data: mine } = await supabase()
        .from("battle_results").select("battle_id, score, time_ms, perf")
        .eq("phone", phone).order("created_at", { ascending: false }).limit(50);
      const rows = mine ?? [];
      let wins = 0;
      if (rows.length) {
        const ids = rows.map((r) => r.battle_id as string);
        const { data: all } = await supabase().from("battle_results").select("battle_id, phone, perf").in("battle_id", ids);
        for (const r of rows) {
          const peers = (all ?? []).filter((x) => x.battle_id === r.battle_id);
          if (peers.length > 1 && peers.every((x) => x.phone === phone || (x.perf as number) <= (r.perf as number))) wins++;
        }
      }
      const avg = (f: (r: (typeof rows)[number]) => number) => (rows.length ? rows.reduce((a, r) => a + f(r), 0) / rows.length : 0);
      const { count: above } = await supabase().from("students").select("phone", { count: "exact", head: true }).gt("rating", s?.rating ?? 1000);
      return NextResponse.json({
        configured: true,
        rating: s?.rating ?? 1000,
        battles: rows.length,
        wins,
        avgPerf: Math.round(avg((r) => r.perf as number)),
        avgScore: Math.round(avg((r) => r.score as number) * 10) / 10,
        globalRank: (above ?? 0) + 1,
      });
    }

    const code = url.searchParams.get("code")?.trim().toUpperCase();
    if (code) {
      const { data: mem } = await supabase().from("group_members").select("phone").eq("group_code", code);
      const phones = (mem ?? []).map((m) => m.phone as string);
      if (phones.length === 0) return NextResponse.json({ configured: true, rows: [] });
      const [{ data: hs }, { data: ss }, { data: br }] = await Promise.all([
        supabase().from("handles").select("phone, handle").in("phone", phones),
        supabase().from("students").select("phone, rating").in("phone", phones),
        supabase().from("battle_results").select("phone, perf, score").eq("group_code", code).in("phone", phones),
      ]);
      const handleOf = new Map((hs ?? []).map((h) => [h.phone as string, h.handle as string]));
      const ratingOf = new Map((ss ?? []).map((s) => [s.phone as string, (s.rating as number) ?? 1000]));
      const rows = phones.map((p) => {
        const mine = (br ?? []).filter((r) => r.phone === p);
        const avgPerf = mine.length ? Math.round(mine.reduce((a, r) => a + (r.perf as number), 0) / mine.length) : 0;
        return { phone: p, handle: handleOf.get(p) ?? null, rating: ratingOf.get(p) ?? 1000, battles: mine.length, avgPerf };
      }).sort((a, b) => b.avgPerf - a.avgPerf || b.rating - a.rating);
      return NextResponse.json({ configured: true, rows });
    }

    if (url.searchParams.get("global")) {
      const me = url.searchParams.get("me")?.replace(/\D/g, "") ?? "";
      // Only students who actually battled make the board.
      const { data: br } = await supabase().from("battle_results").select("phone").limit(2000);
      const played = [...new Set((br ?? []).map((r) => r.phone as string))];
      if (played.length === 0) return NextResponse.json({ configured: true, top: [], myRank: null });
      const { data: ss } = await supabase().from("students").select("phone, rating").in("phone", played).order("rating", { ascending: false });
      const { data: hs } = await supabase().from("handles").select("phone, handle").in("phone", played);
      const handleOf = new Map((hs ?? []).map((h) => [h.phone as string, h.handle as string]));
      const board = (ss ?? []).map((s, i) => ({
        rank: i + 1, phone: s.phone as string,
        handle: handleOf.get(s.phone as string) ?? null, rating: (s.rating as number) ?? 1000,
      }));
      const myRank = board.find((b) => b.phone === me)?.rank ?? null;
      return NextResponse.json({ configured: true, top: board.slice(0, 20), total: board.length, myRank });
    }

    return NextResponse.json({ configured: true, error: "bad query" }, { status: 400 });
  } catch (err) {
    console.error("battle stats error", err);
    return NextResponse.json({ configured: true, error: "failed" }, { status: 500 });
  }
}
