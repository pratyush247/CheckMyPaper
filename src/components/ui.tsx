"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ErrorTag, Subject } from "@/lib/types";
import { TAG_MAP } from "@/lib/errorTags";

export function TopBar({
  title,
  back,
  right,
}: {
  title?: string;
  back?: string | boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 bg-[var(--color-paper)]/95 px-4 py-3 backdrop-blur">
      {back ? (
        <button
          onClick={() => (typeof back === "string" ? router.push(back) : router.back())}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-card)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
      {title ? <h1 className="text-lg font-bold tracking-tight">{title}</h1> : null}
      <div className="ml-auto">{right}</div>
    </header>
  );
}

export function TrafficDot({ light, size = 12 }: { light: "green" | "amber" | "red"; size?: number }) {
  const color = light === "green" ? "var(--color-good)" : light === "amber" ? "var(--color-warn)" : "var(--color-bad)";
  return <span style={{ width: size, height: size, background: color }} className="inline-block rounded-full" />;
}

export function TagBadge({ tag }: { tag: ErrorTag }) {
  const m = TAG_MAP[tag];
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-paper-2)] px-2.5 py-1 text-xs font-semibold text-[var(--color-ink-soft)]">
      <span>{m.emoji}</span>
      {m.label}
    </span>
  );
}

const subjectColor: Record<Subject, string> = {
  Physics: "#5b4bff",
  Chemistry: "#15a36b",
  Maths: "#d98a18",
  Unknown: "#6b6258",
};

export function SubjectTag({ subject }: { subject: Subject }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{ background: `${subjectColor[subject]}1a`, color: subjectColor[subject] }}
    >
      {subject}
    </span>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="btn btn-primary w-full">
      {children}
    </Link>
  );
}

export function AppLoading() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center">
      <svg width="28" height="28" viewBox="0 0 24 24" className="animate-spin text-[var(--color-violet)]" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.2" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </main>
  );
}

export function EmptyState({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-8 py-16 text-center">
      <div className="text-5xl">{emoji}</div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm text-[var(--color-ink-soft)]">{body}</p>
    </div>
  );
}
