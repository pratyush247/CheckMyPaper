"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BottomNav } from "@/components/BottomNav";
import { ProfileButton } from "@/components/ProfileButton";
import { TopBar, TrafficDot, EmptyState, AppLoading } from "@/components/ui";
import { computeProfile, getPapers } from "@/lib/store";
import { useStoreVersion, useMounted } from "@/lib/useStore";
import type { Paper } from "@/lib/types";

function paperHref(p: Paper) {
  if (p.status === "done") return `/papers/${p.id}/insight`;
  if (p.status === "narrating") return `/papers/${p.id}/narrate`;
  return `/papers/${p.id}/triage`;
}

function statusLabel(p: Paper) {
  switch (p.status) {
    case "done":
      return "Reviewed";
    case "narrating":
      return "Talk in progress";
    default:
      return "Ready to review";
  }
}

export default function Home() {
  const v = useStoreVersion();
  const mounted = useMounted();
  const papers = useMemo(() => getPapers(), [v]);
  const profile = useMemo(() => computeProfile(), [v]);
  const hasData = profile.totalDiagnosed > 0;
  const paperCount = profile.papersLogged || profile.history.length;

  if (!mounted) return <AppLoading />;

  return (
    <main className="pb-28">
      <TopBar
        left={<ProfileButton />}
        right={
          <Link href="/progress" className="text-sm font-semibold text-[var(--color-violet)]">
            Progress
          </Link>
        }
      />

      <div className="px-4">
        <h1 className="text-[1.7rem] font-extrabold leading-tight tracking-tight">
          See <span className="text-[var(--color-violet)]">why</span> you lose marks.
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Scan a mock, talk through what tripped you up, and your patterns get clearer every paper.
        </p>

        {hasData && profile.history[0]?.dominantTag && (
          <Link href="/progress" className="card mt-4 block p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">
              <TrafficDot light="amber" /> Your pattern so far
            </div>
            <p className="mt-1.5 text-[0.95rem] font-semibold leading-snug">
              Across {paperCount} paper{paperCount === 1 ? "" : "s"}, your most common slip is{" "}
              {topTagLabel(profile)}. Tap to see the full picture →
            </p>
          </Link>
        )}

        <Link href="/papers/new" className="btn btn-primary mt-4 w-full text-base">
          <PlusIcon /> Add a paper
        </Link>
      </div>

      <section className="mt-7 px-4">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">
          Your papers
        </h2>

        {papers.length === 0 ? (
          <EmptyState
            emoji="📄"
            title="No papers yet"
            body="Add your first mock test to start spotting your patterns."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {papers.map((p) => (
              <li key={p.id}>
                <Link href={paperHref(p)} className="card flex items-center gap-3 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-violet-soft)] text-lg">
                    {p.status === "done" ? "✅" : "📝"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.name}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">
                      {p.questionCount} questions · {statusLabel(p)}
                    </p>
                  </div>
                  {p.insight && <TrafficDot light={p.insight.light} size={14} />}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--color-ink-soft)]">
                    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BottomNav />
    </main>
  );
}

function topTagLabel(profile: ReturnType<typeof computeProfile>) {
  const entries = Object.entries(profile.tagTotals);
  if (entries.length === 0) return "—";
  entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
  const labels: Record<string, string> = {
    concept: "concept gaps",
    calc_slip: "calculation slips",
    misread: "misreading questions",
    wrong_method: "wrong methods",
    time: "time pressure",
    second_guess: "second-guessing",
  };
  return labels[entries[0][0]] || entries[0][0];
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
