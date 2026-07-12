"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { RecPhase } from "@/lib/recorder";

// Swipe order for horizontal navigation between the main tabs.
const SWIPE_ORDER = ["/", "/battle", "/tutor", "/progress"];

// Left/right swipes move between the bottom-nav tabs. Ignores swipes that
// start on inputs or inside horizontally scrollable elements.
function useSwipeNav(path: string) {
  const router = useRouter();
  useEffect(() => {
    const idx = SWIPE_ORDER.findIndex((p) => (p === "/" ? path === "/" : path.startsWith(p)));
    if (idx < 0) return;
    let start: { x: number; y: number; ok: boolean } | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      let el = e.target as HTMLElement | null;
      let ok = !(el && el.closest("input, textarea, select"));
      while (ok && el) {
        if (el.scrollWidth > el.clientWidth + 2) ok = false; // horizontal scroller — let it scroll
        el = el.parentElement;
      }
      start = { x: t.clientX, y: t.clientY, ok };
    };
    const onEnd = (e: TouchEvent) => {
      const s = start; start = null;
      if (!s || !s.ok) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < 60 || Math.abs(dy) > 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const next = SWIPE_ORDER[idx + (dx < 0 ? 1 : -1)];
      if (next) router.push(next);
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [path, router]);
}

const tabs = [
  { href: "/", label: "Papers", icon: PaperIcon },
  { href: "/battle", label: "Battle", icon: BattleIcon },
  null, // center voice FAB slot
  { href: "/tutor", label: "Coach", icon: CoachIcon },
  { href: "/progress", label: "Progress", icon: ChartIcon },
] as const;

// When `mic` is passed (only on the Ask page), the centre FAB becomes the live
// voice recorder: white, breathing to invite a tap, pulsing red while recording,
// with a floating status label. Everywhere else it stays a link to /ask.
export type MicControl = { phase: RecPhase; seconds: number; onToggle: () => void; disabled?: boolean };

export function BottomNav({ mic }: { mic?: MicControl } = {}) {
  const path = usePathname();
  const askActive = path.startsWith("/ask");
  useSwipeNav(path);
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[30rem] -translate-x-1/2 border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur">
      <div className="flex items-end justify-around pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) =>
          t === null ? (
            <div key="fab" className="relative flex flex-1 justify-center">
              {mic ? (
                <>
                  {mic.phase !== "idle" && (
                    <span className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--color-ink)] px-3 py-1 text-[11px] font-semibold text-[var(--color-card)] shadow-[var(--shadow-pop)]">
                      {mic.phase === "recording" ? `● ${mic.seconds}s · tap to stop` : "Transcribing…"}
                    </span>
                  )}
                  <button
                    onClick={mic.onToggle}
                    disabled={mic.disabled || mic.phase === "transcribing"}
                    aria-label={mic.phase === "recording" ? "Stop recording" : "Start recording"}
                    className={`-mt-5 mb-2.5 flex h-14 w-14 items-center justify-center rounded-full ring-4 ring-[var(--color-paper)] transition-transform active:scale-95 disabled:opacity-60 ${
                      mic.phase === "recording"
                        ? "fab-recording bg-[var(--color-bad)] text-white"
                        : "btn-primary fab-idle"
                    }`}
                  >
                    {mic.phase === "recording" ? <StopIcon /> : mic.phase === "transcribing" ? <SpinnerIcon /> : <MicIcon />}
                  </button>
                </>
              ) : (
                <Link
                  href="/ask"
                  aria-label="Ask a doubt by voice"
                  className="btn-primary -mt-5 mb-2.5 flex h-14 w-14 items-center justify-center rounded-full shadow-[var(--shadow-pop)] ring-4 ring-[var(--color-paper)] transition-transform active:scale-95"
                  style={askActive ? { filter: "brightness(1.05)" } : undefined}
                >
                  <MicIcon />
                </Link>
              )}
            </div>
          ) : (
            <Link
              key={t.href}
              href={t.href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold"
              style={{ color: (t.href === "/" ? path === "/" : path.startsWith(t.href)) ? "var(--color-violet)" : "var(--color-ink-soft)" }}
            >
              <t.icon active={t.href === "/" ? path === "/" : path.startsWith(t.href)} />
              {t.label}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}

function MicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="animate-spin" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
function PaperIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="14" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill={active ? "var(--color-violet-soft)" : "none"} />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function BattleIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.9 7.2 18l.9-5.4L4.2 8.7l5.4-.8L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill={active ? "var(--color-violet-soft)" : "none"} />
    </svg>
  );
}
function CoachIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 4l9 4-9 4-9-4 9-4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" fill={active ? "var(--color-violet-soft)" : "none"} />
      <path d="M7 10.5V15c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.5M21 8v4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 20V5M20 20H4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="7" y="12" width="3" height="5" rx="1" fill="currentColor" opacity={active ? 1 : 0.7} />
      <rect x="12" y="9" width="3" height="8" rx="1" fill="currentColor" opacity={active ? 1 : 0.7} />
      <rect x="17" y="6" width="3" height="11" rx="1" fill="currentColor" opacity={active ? 1 : 0.7} />
    </svg>
  );
}
