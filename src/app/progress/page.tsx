"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TopBar, EmptyState, AppLoading } from "@/components/ui";
import { TAG_MAP, TAG_SHORT } from "@/lib/errorTags";
import { computeProfile, getPapers } from "@/lib/store";
import { useStoreVersion, useMounted } from "@/lib/useStore";
import type { ErrorTag } from "@/lib/types";

export default function ProgressPage() {
  const v = useStoreVersion();
  const mounted = useMounted();
  const profile = useMemo(() => computeProfile(), [v]);
  const papers = useMemo(() => getPapers(), [v]);
  const paperName = (pid: string) => papers.find((p) => p.id === pid)?.name ?? "Paper";

  if (!mounted) return <AppLoading />;

  if (profile.totalDiagnosed === 0) {
    return (
      <main className="pb-28">
        <TopBar title="Your progress" />
        <EmptyState
          emoji="📈"
          title="Your patterns will appear here"
          body="Review a paper or two and we'll start showing where you keep slipping — and where you're improving."
        />
        <div className="px-4">
          <Link href="/papers/new" className="btn btn-primary w-full">
            Add a paper
          </Link>
        </div>
        <BottomNav />
      </main>
    );
  }

  // dominant error mode overall
  const tagEntries = (Object.entries(profile.tagTotals) as [ErrorTag, number][]).sort((a, b) => b[1] - a[1]);
  const topTag = tagEntries[0]?.[0];
  const tagTotal = tagEntries.reduce((s, [, n]) => s + n, 0) || 1;

  // recurring trouble topics (seen across 2+ papers, or highest count)
  const topicEntries = Object.entries(profile.topicTrouble).sort(
    (a, b) => b[1].papers.length - a[1].papers.length || b[1].count - a[1].count,
  );
  const recurring = topicEntries.filter(([, t]) => t.papers.length >= 2);

  const history = profile.history.filter((h) => h.diagnosed > 0);

  return (
    <main className="pb-28">
      <TopBar title="Your progress" />

      <div className="px-4">
        {/* Headline fingerprint */}
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">
            Across {history.length} reviewed paper{history.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1.5 text-[1.1rem] font-extrabold leading-snug">
            {topTag ? (
              <>
                Your number-one leak is{" "}
                <span className="text-[var(--color-violet)]">{TAG_SHORT[topTag]}</span>{" "}
                — {Math.round((tagEntries[0][1] / tagTotal) * 100)}% of your logged mistakes.
              </>
            ) : (
              "Keep logging papers to reveal your pattern."
            )}
          </p>
        </div>

        {/* Error-mode breakdown across all papers */}
        <div className="card mt-4 p-5">
          <h3 className="mb-3 text-sm font-bold">Your mistake mix</h3>
          <div className="flex flex-col gap-2.5">
            {tagEntries.map(([tag, n]) => (
              <div key={tag} className="flex items-center gap-3">
                <span className="w-7 text-center text-lg">{TAG_MAP[tag].emoji}</span>
                <div className="flex-1">
                  <div className="mb-1 flex justify-between text-xs font-semibold">
                    <span>{TAG_MAP[tag].label}</span>
                    <span className="text-[var(--color-ink-soft)]">{Math.round((n / tagTotal) * 100)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-paper-2)]">
                    <div className="h-full rounded-full bg-[var(--color-violet)]" style={{ width: `${(n / tagTotal) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-paper trend */}
        {history.length >= 2 && (
          <div className="card mt-4 p-5">
            <h3 className="mb-3 text-sm font-bold">Paper by paper</h3>
            <ul className="flex flex-col gap-2.5">
              {history.map((h) => (
                <li key={h.paperId} className="flex items-center gap-3">
                  <span className="text-lg">{h.dominantTag ? TAG_MAP[h.dominantTag].emoji : "—"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{paperName(h.paperId)}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">
                      Mostly {h.dominantTag ? TAG_SHORT[h.dominantTag] : "—"} · {h.diagnosed} reviewed
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
              Watch the leading emoji change as your habits shift.
            </p>
          </div>
        )}

        {/* Revise-these (Practice Again) */}
        {topicEntries.length > 0 && (
          <div className="card mt-4 p-5">
            <h3 className="mb-1 text-sm font-bold">Revise these next</h3>
            <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
              {recurring.length > 0
                ? "These topics keep costing you marks across papers."
                : "Topics where you slipped this time."}
            </p>
            <ul className="flex flex-col gap-2">
              {topicEntries.slice(0, 5).map(([topic, t]) => (
                <li key={topic} className="flex items-center justify-between rounded-xl bg-[var(--color-paper-2)] px-4 py-2.5">
                  <span className="text-sm font-semibold">{topic}</span>
                  <span className="text-xs font-bold text-[var(--color-violet)]">
                    {t.papers.length >= 2 ? `${t.papers.length} papers` : `${t.count}×`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5">
          <Link href="/papers/new" className="btn btn-primary w-full">
            Add another paper
          </Link>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
