"use client";

import { useRef, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/ui";
import { VisualAnswer } from "@/components/VisualAnswer";
import { FeedbackThumbs } from "@/components/FeedbackThumbs";
import { useRecorder } from "@/lib/recorder";

interface Visual { title: string; explanation: string; svg: string }

export default function AskPage() {
  const [doubt, setDoubt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Visual | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { phase, hint, seconds, toggle } = useRecorder((t) => setDoubt((d) => (d ? `${d} ${t}` : t)));

  async function speak(text: string) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as { audio?: string; mime?: string };
      if (!data.audio) return;
      audioRef.current?.pause();
      const audio = new Audio(`data:${data.mime || "audio/wav"};base64,${data.audio}`);
      audioRef.current = audio;
      audio.onplay = () => setSpeaking(true);
      audio.onended = () => setSpeaking(false);
      audio.onpause = () => setSpeaking(false);
      await audio.play().catch(() => setSpeaking(false));
    } catch {
      /* text is always shown */
    }
  }

  async function ask() {
    if (!doubt.trim()) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: doubt, kind: "doubt" }),
      });
      if (!res.ok) throw new Error("Could not generate an answer");
      const data = (await res.json()) as Visual;
      setResult(data);
      if (data.explanation) speak(data.explanation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    audioRef.current?.pause();
    setResult(null);
    setDoubt("");
    setError("");
  }

  // ---- Result view ----
  if (result) {
    return (
      <main className="pb-28">
        <TopBar title="Ask a doubt" />
        <div className="flex flex-col gap-4 px-4">
          <h2 className="text-xl font-extrabold leading-tight">{result.title}</h2>
          <VisualAnswer svg={result.svg} />
          {result.explanation && (
            <div className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">Explanation</span>
                <button
                  onClick={() => speak(result.explanation)}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--color-violet-soft)] px-3 py-1 text-xs font-bold text-[var(--color-violet-ink)]"
                >
                  {speaking ? "🔊 Playing…" : "🔊 Play"}
                </button>
              </div>
              <p className="text-[0.95rem] leading-relaxed">{result.explanation}</p>
            </div>
          )}
          <FeedbackThumbs target="visual" label="Did this visual help?" />
          <button onClick={reset} className="btn btn-primary w-full">
            Ask another doubt
          </button>
        </div>
        <BottomNav />
      </main>
    );
  }

  // ---- Ask view ----
  return (
    <main className="pb-56">
      <TopBar title="Ask a doubt" />
      <div className="px-4">
        <div className="card mb-4 bg-[var(--color-violet-soft)] p-4">
          <p className="text-[0.95rem] font-semibold leading-snug text-[var(--color-violet-ink)]">
            🎙️ Tap the mic and speak your doubt — get a quick visual that explains it.
          </p>
          <p className="mt-1 text-xs text-[var(--color-violet-ink)]/80">
            e.g. &ldquo;Why does a rolling ball go slower than a sliding one?&rdquo;
          </p>
        </div>

        <textarea
          value={doubt}
          onChange={(e) => setDoubt(e.target.value)}
          rows={4}
          placeholder="Your doubt will appear here — or just type it."
          className="w-full resize-none rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3 text-[0.95rem] outline-none focus:border-[var(--color-violet)]"
        />
        {hint && <p className="mt-2 text-xs font-medium text-[var(--color-ink-soft)]">{hint}</p>}
        {error && (
          <p className="mt-2 rounded-xl bg-[var(--color-bad-soft)] px-4 py-3 text-sm font-medium text-[var(--color-bad)]">
            {error}
          </p>
        )}
      </div>

      {/* Thumb-reachable action bar, just above the nav */}
      <div
        className="fixed left-1/2 z-20 w-full max-w-[30rem] -translate-x-1/2 border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 px-4 pt-3 pb-3 backdrop-blur"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
      >
        {doubt.trim() && phase === "idle" && (
          <button onClick={ask} disabled={busy} className="btn btn-primary mb-3 w-full text-base">
            {busy ? "Drawing your answer…" : "Show me a visual ✨"}
          </button>
        )}
        <div className="flex flex-col items-center">
          <button
            onClick={toggle}
            disabled={phase === "transcribing" || busy}
            aria-label={phase === "recording" ? "Stop recording" : "Start recording"}
            className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[var(--shadow-card)] ${
              phase === "recording" ? "recording bg-[var(--color-bad)]" : "bg-[var(--color-violet)]"
            }`}
          >
            {phase === "recording" ? <StopIcon /> : phase === "transcribing" ? <Spinner /> : <MicIcon />}
          </button>
          <span className="mt-1.5 text-xs font-semibold text-[var(--color-ink-soft)]">
            {phase === "recording" ? `Recording ${seconds}s · tap to stop` : phase === "transcribing" ? "Transcribing…" : "Tap to speak"}
          </span>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

function MicIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="animate-spin" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
