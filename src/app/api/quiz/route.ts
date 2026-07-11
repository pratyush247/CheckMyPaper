import { NextRequest, NextResponse } from "next/server";
import { generateQuiz } from "@/lib/ai";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const questions = await generateQuiz(
      String(body.topic || "Unknown"),
      String(body.subject || "Unknown"),
      Math.max(1, Math.min(10, Number(body.n) || 10)),
      { className: body.className ? String(body.className) : undefined },
    );
    return NextResponse.json({ questions });
  } catch (err) {
    console.error("quiz error", err);
    return NextResponse.json({ error: "Could not generate the quiz" }, { status: 500 });
  }
}
