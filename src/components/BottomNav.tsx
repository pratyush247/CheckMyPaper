"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Papers", icon: PaperIcon },
  { href: "/progress", label: "Progress", icon: ChartIcon },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[30rem] -translate-x-1/2 border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur">
      <div className="flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold"
              style={{ color: active ? "var(--color-violet)" : "var(--color-ink-soft)" }}
            >
              <t.icon active={active} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function PaperIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="14" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "var(--color-violet-soft)" : "none"} />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
