"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "recording" | "transcribing";

// Records a short voice clip, sends it for transcription, and surfaces the text
// in an editable box. If no transcription provider is configured (or mic is
// blocked), the student simply types their approach instead — the loop still works.
export function VoiceRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [hint, setHint] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => stopTimer(), []);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function start() {
    setHint("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await transcribe(new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" }));
      };
      recorderRef.current = mr;
      mr.start();
      setPhase("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setHint("Mic isn't available — just type your approach below.");
    }
  }

  function stop() {
    stopTimer();
    recorderRef.current?.stop();
    setPhase("transcribing");
  }

  async function transcribe(blob: Blob) {
    try {
      const form = new FormData();
      form.append("audio", blob, "clip.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = (await res.json()) as { transcript: string; enabled?: boolean };
      if (data.enabled === false) {
        setHint("Recorded! Transcription isn't set up yet — type what you said below.");
      } else if (data.transcript) {
        onChange(value ? `${value} ${data.transcript}` : data.transcript);
      } else {
        setHint("Couldn't catch that — try again or type it below.");
      }
    } catch {
      setHint("Couldn't transcribe — type your approach below.");
    } finally {
      setPhase("idle");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        {phase === "recording" ? (
          <button onClick={stop} className="btn recording w-full bg-[var(--color-bad)] text-white">
            <StopIcon /> Stop · {seconds}s
          </button>
        ) : phase === "transcribing" ? (
          <button disabled className="btn btn-ghost w-full">
            <Spinner /> Transcribing…
          </button>
        ) : (
          <button onClick={start} className="btn btn-ghost w-full">
            <MicIcon /> {value ? "Record more" : "Hold to record your approach"}
          </button>
        )}
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="…or type how you approached it and what you picked."
        className="mt-3 w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3 text-sm outline-none focus:border-[var(--color-violet)]"
      />
      {hint && <p className="mt-1.5 text-xs font-medium text-[var(--color-ink-soft)]">{hint}</p>}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="animate-spin" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
