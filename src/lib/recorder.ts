"use client";

import { useEffect, useRef, useState } from "react";
import { blobToWavFile } from "./wav";

export type RecPhase = "idle" | "recording" | "transcribing";

// Shared mic → WAV → Sarvam transcription. Used by the Ask doubt-solver and the
// narrate flow so the format fix + error handling live in one place.
export function useRecorder(onText: (text: string) => void) {
  const [phase, setPhase] = useState<RecPhase>("idle");
  const [hint, setHint] = useState("");
  const [seconds, setSeconds] = useState(0);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function start() {
    setHint("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        setPhase("transcribing");
        try {
          const raw = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
          const wav = await blobToWavFile(raw);
          const form = new FormData();
          form.append("audio", wav, "clip.wav");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = (await res.json()) as { transcript?: string; enabled?: boolean };
          if (data.enabled === false) setHint("Voice isn't set up yet — type your doubt below.");
          else if (data.transcript) onText(data.transcript);
          else setHint("Couldn't catch that — try again, or type below.");
        } catch {
          setHint("Couldn't process the audio — type below.");
        } finally {
          setPhase("idle");
        }
      };
      mr.current = rec;
      rec.start();
      setPhase("recording");
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setHint("Mic not available — type your doubt below.");
    }
  }

  function stop() {
    mr.current?.stop();
  }

  function toggle() {
    if (phase === "recording") stop();
    else if (phase === "idle") start();
  }

  return { phase, hint, seconds, start, stop, toggle };
}
