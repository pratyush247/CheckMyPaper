import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Transcribes a short voice clip. Provider priority:
//   1. Sarvam AI  (SARVAM_API_KEY)        — best for Hindi/English code-mixed JEE speech
//   2. Whisper    (TRANSCRIBE_API_KEY)    — any OpenAI-compatible endpoint
//   3. disabled   (returns enabled:false) — student types their approach instead
export async function POST(req: NextRequest) {
  const sarvamKey = process.env.SARVAM_API_KEY;
  const whisperKey = process.env.TRANSCRIBE_API_KEY;

  if (!sarvamKey && !whisperKey) {
    return NextResponse.json({ transcript: "", enabled: false });
  }

  try {
    const inForm = await req.formData();
    const audio = inForm.get("audio");
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "No audio" }, { status: 400 });
    }

    const transcript = sarvamKey
      ? await transcribeSarvam(audio, sarvamKey)
      : await transcribeWhisper(audio, whisperKey!);

    return NextResponse.json({ transcript, enabled: true });
  } catch (err) {
    console.error("transcribe error", err);
    return NextResponse.json({ transcript: "", enabled: true, error: "Transcription failed" });
  }
}

// --- Sarvam AI Speech-to-Text -------------------------------------------------
// POST https://api.sarvam.ai/speech-to-text  (multipart: file, model, language_code)
// Header: api-subscription-key. Response: { transcript, language_code, ... }
async function transcribeSarvam(audio: File, key: string): Promise<string> {
  const model = process.env.SARVAM_STT_MODEL || "saarika:v2.5";
  // "unknown" lets Sarvam auto-detect the spoken language (handles Hindi/English mix).
  const language = process.env.SARVAM_LANGUAGE || "unknown";

  const form = new FormData();
  form.append("file", audio, "clip.webm");
  form.append("model", model);
  form.append("language_code", language);
  if (model.startsWith("saaras")) form.append("mode", "transcribe");

  const res = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: { "api-subscription-key": key },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Sarvam ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { transcript?: string };
  return data.transcript || "";
}

// --- OpenAI-compatible Whisper (fallback) ------------------------------------
async function transcribeWhisper(audio: File, key: string): Promise<string> {
  const base = process.env.TRANSCRIBE_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.TRANSCRIBE_MODEL || "whisper-1";

  const form = new FormData();
  form.append("file", audio, "clip.webm");
  form.append("model", model);

  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { text?: string };
  return data.text || "";
}
