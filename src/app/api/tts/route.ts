import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Sarvam text-to-speech (Bulbul). Reuses SARVAM_API_KEY. Returns base64 WAV.
// Without a key, returns enabled:false so the UI just shows text silently.
export async function POST(req: NextRequest) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) return NextResponse.json({ enabled: false });

  try {
    const body = await req.json();
    const text = String(body.text || "").slice(0, 2400); // bulbul:v3 cap is 2500
    if (!text.trim()) return NextResponse.json({ error: "No text" }, { status: 400 });

    const res = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: { "api-subscription-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        target_language_code: process.env.SARVAM_TTS_LANGUAGE || "en-IN",
        speaker: process.env.SARVAM_TTS_SPEAKER || "shubh",
        model: process.env.SARVAM_TTS_MODEL || "bulbul:v3",
      }),
    });
    if (!res.ok) {
      console.error("tts upstream", res.status, await res.text());
      return NextResponse.json({ enabled: true, error: "TTS failed" });
    }
    const data = (await res.json()) as { audios?: string[] };
    const audio = data.audios?.[0];
    return audio
      ? NextResponse.json({ enabled: true, audio, mime: "audio/wav" })
      : NextResponse.json({ enabled: true, error: "No audio" });
  } catch (err) {
    console.error("tts error", err);
    return NextResponse.json({ enabled: true, error: "TTS failed" });
  }
}
