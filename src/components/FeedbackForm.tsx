"use client";

import { useState } from "react";
import { sendFeedback, type FeedbackType } from "@/lib/feedback";

const CATEGORIES: { type: FeedbackType; target: string; emoji: string; label: string; placeholder: string }[] = [
  { type: "idea", target: "next", emoji: "💡", label: "Idea / what next", placeholder: "What should we build next? What would make this more useful?" },
  { type: "bug", target: "general", emoji: "🐞", label: "Something broke", placeholder: "What went wrong? What were you doing?" },
  { type: "love", target: "general", emoji: "❤️", label: "Love it", placeholder: "What's working well for you?" },
];

export function FeedbackForm() {
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!message.trim()) return;
    setBusy(true);
    await sendFeedback({ type: cat.type, target: cat.target, message: message.trim() });
    setBusy(false);
    setDone(true);
  }

  return (
    <div className="card mt-4 p-4">
      <h3 className="text-sm font-bold">Tell us what you think 💬</h3>
      {done ? (
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">Got it — thank you! This shapes what we build next. 🙌</p>
      ) : (
        <>
          <p className="mt-0.5 mb-3 text-xs text-[var(--color-ink-soft)]">Your feedback decides what we build next.</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.label} onClick={() => setCat(c)} className="chip !px-3 !py-1.5 text-xs" data-on={cat.label === c.label}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={cat.placeholder}
            className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-violet)]"
          />
          <button onClick={submit} disabled={busy || !message.trim()} className="btn btn-primary mt-2 w-full !py-2.5 text-sm">
            {busy ? "Sending…" : "Send feedback"}
          </button>
        </>
      )}
    </div>
  );
}
