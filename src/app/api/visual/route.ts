import { NextRequest, NextResponse } from "next/server";
import { generateVisual } from "@/lib/ai";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await generateVisual({
      prompt: String(body.prompt || ""),
      context: body.context ? String(body.context) : undefined,
      kind: body.kind === "lesson" ? "lesson" : "doubt",
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("visual error", err);
    return NextResponse.json({ error: "Could not generate a visual" }, { status: 500 });
  }
}
