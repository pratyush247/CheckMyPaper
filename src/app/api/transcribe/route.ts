import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Transcribes a short audio clip via any OpenAI-compatible Whisper endpoint
// (OpenAI, Groq, etc.). Configure with:
//   TRANSCRIBE_API_KEY   (required to enable)
//   TRANSCRIBE_BASE_URL  (default https://api.openai.com/v1)
//   TRANSCRIBE_MODEL     (default whisper-1)
// When no key is set, returns transcript:"" and enabled:false so the UI lets
// the student type/edit their approach instead.
export async function POST(req: NextRequest) {
  const key = process.env.TRANSCRIBE_API_KEY;
  if (!key) {
    return NextResponse.json({ transcript: "", enabled: false });
  }

  try {
    const inForm = await req.formData();
    const audio = inForm.get("audio");
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "No audio" }, { status: 400 });
    }

    const base = process.env.TRANSCRIBE_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.TRANSCRIBE_MODEL || "whisper-1";

    const outForm = new FormData();
    outForm.append("file", audio, "clip.webm");
    outForm.append("model", model);
    // JEE students mix Hindi + English; let the model auto-detect.

    const res = await fetch(`${base}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: outForm,
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("transcribe upstream error", res.status, detail);
      return NextResponse.json({ transcript: "", enabled: true, error: "Transcription failed" });
    }
    const data = (await res.json()) as { text?: string };
    return NextResponse.json({ transcript: data.text || "", enabled: true });
  } catch (err) {
    console.error("transcribe error", err);
    return NextResponse.json({ transcript: "", enabled: true, error: "Transcription failed" });
  }
}
