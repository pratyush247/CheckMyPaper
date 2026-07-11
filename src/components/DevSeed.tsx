"use client";

import { useState } from "react";
import { seedDemoData } from "@/lib/store";

// Dev-only: seed a paper with wrong answers across topics so battle / challenges
// / progress have data without grinding a real mock. Hidden in production.
export function DevSeed() {
  const [done, setDone] = useState(false);
  if (process.env.NODE_ENV === "production") return null;
  return (
    <button
      onClick={() => { seedDemoData(); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="mt-3 w-full rounded-xl border border-dashed border-[var(--color-line)] px-3 py-2 text-xs font-semibold text-[var(--color-ink-soft)]"
    >
      {done ? "✓ Seeded 4 weak topics" : "🌱 Dev: seed demo data"}
    </button>
  );
}
