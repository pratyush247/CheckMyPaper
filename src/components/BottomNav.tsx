"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Papers", icon: PaperIcon },
  { href: "/battle", label: "Battle", icon: BattleIcon },
  null, // center voice FAB slot
  { href: "/tutor", label: "Coach", icon: CoachIcon },
  { href: "/progress", label: "Progress", icon: ChartIcon },
] as const;

export function BottomNav() {
  const path = usePathname();
  const askActive = path.startsWith("/ask");
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[30rem] -translate-x-1/2 border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur">
      <div className="flex items-end justify-around pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t, i) =>
          t === null ? (
            <div key="fab" className="flex flex-1 justify-center">
              <Link
                href="/ask"
                aria-label="Ask a doubt by voice"
                className="btn-primary -mt-6 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[var(--shadow-pop)] ring-4 ring-[var(--color-paper)] transition-transform active:scale-95"
                style={askActive ? { filter: "brightness(1.05)" } : undefined}
              >
                <MicIcon />
              </Link>
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
