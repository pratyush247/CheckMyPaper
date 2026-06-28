import { NextRequest, NextResponse } from "next/server";
import { diagnose } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await diagnose({
      questionText: String(body.questionText || ""),
      topic: String(body.topic || "Unknown"),
      transcript: String(body.transcript || ""),
      selfTag: body.selfTag || undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("diagnose error", err);
    return NextResponse.json({ error: "Diagnosis failed" }, { status: 500 });
  }
}
