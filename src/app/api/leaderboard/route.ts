import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigured } from "@/lib/supabaseServer";

export const maxDuration = 30;

interface Row {
  phone: string;
  score: number;
  time_ms: number;
  students: { name: string } | { name: string }[] | null;
}

// GET /api/leaderboard?topic=...&scope=global|group&code=ABC123
// Returns top racers for a topic (best attempt per student): score desc, time asc.
export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, racers: [] });

  const { searchParams } = new URL(req.url);
  const topic = searchParams.get("topic")?.trim();
  const scope = searchParams.get("scope") === "group" ? "group" : "global";
  const code = searchParams.get("code")?.trim().toUpperCase();
  if (!topic) return NextResponse.json({ error: "topic required" }, { status: 400 });

  try {
    let phones: string[] | null = null;
    if (scope === "group") {
      if (!code) return NextResponse.json({ configured: true, racers: [] });
      const { data: members } = await supabase().from("group_members").select("phone").eq("group_code", code);
      phones = (members ?? []).map((m) => m.phone as string);
      if (phones.length === 0) return NextResponse.json({ configured: true, racers: [] });
    }

    let q = supabase()
      .from("battle_scores")
      .select("phone, score, time_ms, students(name)")
      .eq("topic", topic)
      .order("score", { ascending: false })
      .order("time_ms", { ascending: true })
      .limit(500);
    if (phones) q = q.in("phone", phones);

    const { data, error } = await q;
    if (error) throw error;

    // Best attempt per student (rows already sorted best-first).
    const seen = new Set<string>();
    const racers: { name: string; score: number; timeMs: number; phone: string }[] = [];
    for (const r of (data ?? []) as Row[]) {
      if (seen.has(r.phone)) continue;
      seen.add(r.phone);
      const s = Array.isArray(r.students) ? r.students[0] : r.students;
      racers.push({ name: s?.name ?? "Student", score: r.score, timeMs: r.time_ms, phone: r.phone });
      if (racers.length >= 20) break;
    }
    return NextResponse.json({ configured: true, racers });
  } catch (err) {
    console.error("leaderboard error", err);
    return NextResponse.json({ configured: true, racers: [], error: "fetch failed" }, { status: 500 });
  }
}
