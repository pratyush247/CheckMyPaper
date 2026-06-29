"use client";

import { useRecorder } from "@/lib/recorder";

// Record (→WAV→Sarvam) or type. Used in the narrate flow. The Ask page has its
// own bottom-bar layout but shares the same useRecorder hook.
export function VoiceRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string) => void;
}) {
  const { phase, hint, seconds, start, stop } = useRecorder((t) =>
    onChange(value ? `${value} ${t}` : t),
  );

  return (
    <div>
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
          <MicIcon /> {value ? "Record more" : "Tap to record your approach"}
        </button>
      )}

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
