import { NextRequest, NextResponse } from "next/server";
import { summarizePaper } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await summarizePaper({
      paperName: String(body.paperName || "this paper"),
      rows: Array.isArray(body.rows) ? body.rows : [],
      priorTags: Array.isArray(body.priorTags) ? body.priorTags : [],
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("insight error", err);
    return NextResponse.json({ error: "Insight failed" }, { status: 500 });
  }
}
