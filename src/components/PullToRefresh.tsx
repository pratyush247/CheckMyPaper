"use client";

import { useRef, useState } from "react";

// Drag down from the top of the page → spinner → refetch. Wrap a page's
// scrollable content and pass the refetch.
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown> | void; children: React.ReactNode }) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0 && !busy) startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    setPull(dy > 0 && window.scrollY <= 0 ? Math.min(dy * 0.5, 70) : 0);
  };
  const onTouchEnd = async () => {
    const fire = pull >= 55;
    startY.current = null;
    if (!fire) return setPull(0);
    setBusy(true);
    try { await onRefresh(); } finally { setBusy(false); setPull(0); }
  };

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height]"
        style={{ height: busy ? 44 : pull }}
        aria-hidden={pull === 0 && !busy}
      >
        <span className={`text-xl ${busy ? "animate-spin" : ""}`} style={{ opacity: busy || pull > 20 ? 1 : 0 }}>
          {busy ? "⏳" : pull >= 55 ? "↻" : "↓"}
        </span>
      </div>
      {children}
    </div>
  );
}
