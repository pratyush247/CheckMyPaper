"use client";

import { useRef, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/ui";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { VisualAnswer } from "@/components/VisualAnswer";

interface Visual {
  title: string;
  explanation: string;
  svg: string;
}

export default function AskPage() {
  const [doubt, setDoubt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Visual | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function speak(text: string) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as { audio?: string; mime?: string; enabled?: boolean };
      if (!data.audio) return;
      audioRef.current?.pause();
      const audio = new Audio(`data:${data.mime || "audio/wav"};base64,${data.audio}`);
      audioRef.current = audio;
      audio.onplay = () => setSpeaking(true);
      audio.onended = () => setSpeaking(false);
      audio.onpause = () => setSpeaking(false);
      await audio.play().catch(() => setSpeaking(false));
    } catch {
      /* silent — text is always shown */
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

  return (
    <main className="pb-28">
      <TopBar title="Ask a doubt" />

      <div className="px-4">
        {!result && (
          <>
            <div className="card mb-4 bg-[var(--color-violet-soft)] p-4">
              <p className="text-[0.95rem] font-semibold leading-snug text-[var(--color-violet-ink)]">
                🎙️ Speak your doubt — get a quick visual that explains it.
              </p>
              <p className="mt-1 text-xs text-[var(--color-violet-ink)]/80">
                e.g. &ldquo;Why does a rolling ball go slower than a sliding one?&rdquo;
              </p>
            </div>

            <VoiceRecorder value={doubt} onChange={setDoubt} />

            {error && (
              <p className="mt-3 rounded-xl bg-[var(--color-bad-soft)] px-4 py-3 text-sm font-medium text-[var(--color-bad)]">
                {error}
              </p>
            )}

            <button onClick={ask} disabled={!doubt.trim() || busy} className="btn btn-primary mt-4 w-full text-base">
              {busy ? "Thinking…" : "Show me a visual ✨"}
            </button>
          </>
        )}

        {busy && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <div className="text-4xl">🎨</div>
            <p className="font-bold">Drawing your answer…</p>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-extrabold leading-tight">{result.title}</h2>
            <VisualAnswer svg={result.svg} />
            {result.explanation && (
              <div className="card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">
                    Explanation
                  </span>
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
            <button onClick={reset} className="btn btn-line w-full">
              Ask another doubt
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
