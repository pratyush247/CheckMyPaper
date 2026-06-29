"use client";

import { useState } from "react";
import { sendFeedback } from "@/lib/feedback";

// Lightweight "Was this helpful?" 👍/👎 for an AI output. On 👎 it asks one
// optional follow-up line. Sends a reaction to the feedback store.
export function FeedbackThumbs({ target, label = "Was this helpful?" }: { target: string; label?: string }) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  function rate(r: "up" | "down") {
    setRating(r);
    sendFeedback({ type: "reaction", target, rating: r });
    if (r === "up") setDone(true);
  }

  function submitNote() {
    if (note.trim()) sendFeedback({ type: "reaction", target, rating: "down", message: note.trim() });
    setDone(true);
  }

  if (done) {
    return <p className="py-1 text-center text-xs font-medium text-[var(--color-ink-soft)]">Thanks for the feedback 🙏</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2 py-1">
      {rating !== "down" ? (
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[var(--color-ink-soft)]">{label}</span>
          <button onClick={() => rate("up")} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-sm">👍</button>
          <button onClick={() => rate("down")} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-sm">👎</button>
        </div>
      ) : (
        <div className="w-full">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was off? (optional)"
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-violet)]"
          />
          <button onClick={submitNote} className="btn btn-ghost mt-2 w-full !py-2 text-sm">Send</button>
        </div>
      )}
    </div>
  );
}
