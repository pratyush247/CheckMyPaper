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
  const mic = { phase, seconds, onToggle: toggle, disabled: busy };

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

  const doubtPreview = doubt.trim().length > 70 ? `${doubt.trim().slice(0, 70)}…` : doubt.trim();

  // ---- Result view ----
  if (result) {
    return (
      <main className="pb-28">
        <TopBar title="Ask a doubt" />
        <div className="flex flex-col gap-4 px-4 pt-1">
          <h2 className="animate-fade-up text-xl font-bold leading-tight">{result.title}</h2>
          <div className="animate-fade-up">
            <VisualAnswer svg={result.svg} />
          </div>
          {result.explanation && (
            <div className="card animate-fade-up p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">Explanation</span>
                <button
                  onClick={() => speak(result.explanation)}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--color-violet-soft)] px-3 py-1 text-xs font-bold text-[var(--color-violet-ink)] transition-transform active:scale-95"
                >
                  {speaking ? "🔊 Playing…" : "🔊 Play"}
                </button>
              </div>
              <p className="whitespace-pre-line text-[0.95rem] leading-relaxed">{result.explanation}</p>
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

  // ---- Loading view: an obvious "drawing" state so it never feels frozen ----
  if (busy) {
    return (
      <main className="pb-28">
        <TopBar title="Ask a doubt" />
        <div className="flex flex-col gap-4 px-4 pt-1">
          <p className="animate-fade-in text-sm font-medium text-[var(--color-ink-soft)]">
            Drawing your answer{doubtPreview ? ` for “${doubtPreview}”` : ""} ✨
          </p>
          <div className="skeleton h-[300px] w-full" />
          <div className="card flex flex-col gap-2.5 p-4">
            <div className="skeleton h-2.5 w-20" />
            <div className="skeleton h-2.5 w-full" />
            <div className="skeleton h-2.5 w-11/12" />
            <div className="skeleton h-2.5 w-2/3" />
          </div>
        </div>
        <BottomNav mic={mic} />
      </main>
    );
  }

  // ---- Ask view ----
  return (
    <main className="pb-28">
      <TopBar title="Ask a doubt" />
      <div className="flex flex-col gap-4 px-4 pt-1">
        <div className="card animate-fade-up bg-[var(--color-violet-soft)] p-4">
          <p className="text-[0.95rem] font-semibold leading-snug text-[var(--color-violet-ink)]">
            🎙️ Tap the glowing mic below and speak your doubt — get a quick visual that explains it.
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
          className="w-full resize-none rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3 text-[0.95rem] outline-none transition-colors focus:border-[var(--color-violet)]"
        />
        {hint && <p className="text-xs font-medium text-[var(--color-ink-soft)]">{hint}</p>}
        {error && (
          <p className="rounded-xl bg-[var(--color-bad-soft)] px-4 py-3 text-sm font-medium text-[var(--color-bad)]">
            {error}
          </p>
        )}

        {doubt.trim() ? (
          <button onClick={ask} className="btn btn-primary w-full text-base">
            Show me a visual ✨
          </button>
        ) : (
          <p className="text-center text-xs font-medium text-[var(--color-ink-soft)]">
            Tap the glowing mic below to speak ↓
          </p>
        )}
      </div>

      <BottomNav mic={mic} />
    </main>
  );
}
