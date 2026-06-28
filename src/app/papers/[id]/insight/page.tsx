"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { TopBar, TrafficDot, EmptyState, TagBadge, AppLoading } from "@/components/ui";
import { TAG_MAP } from "@/lib/errorTags";
import { getAttempts, getPaper, getQuestions } from "@/lib/store";
import { useStoreVersion, useMounted } from "@/lib/useStore";
import type { ErrorTag } from "@/lib/types";

const lightCopy = {
  green: { soft: "var(--color-good-soft)", ink: "var(--color-good)", word: "Mostly fixable habits" },
  amber: { soft: "var(--color-warn-soft)", ink: "var(--color-warn)", word: "A mixed picture" },
  red: { soft: "var(--color-bad-soft)", ink: "var(--color-bad)", word: "Some real gaps to revise" },
};

export default function InsightPage() {
  const { id } = useParams<{ id: string }>();
  const v = useStoreVersion();
  const mounted = useMounted();
  const paper = useMemo(() => getPaper(id), [id, v]);
  const attempts = useMemo(() => getAttempts(id), [id, v]);
  const questions = useMemo(() => getQuestions(id), [id, v]);

  if (!mounted) return <AppLoading />;

  if (!paper) {
    return (
      <main>
        <TopBar title="Insight" back="/" />
        <EmptyState emoji="🤔" title="Paper not found" body="It may have been removed." />
      </main>
    );
  }
  const insight = paper.insight;
  if (!insight) {
    return (
      <main>
        <TopBar title={paper.name} back="/" />
        <EmptyState
          emoji="🎙️"
          title="Not reviewed yet"
          body="Talk through your mistakes to unlock your insight."
        />
        <div className="px-4">
          <Link href={`/papers/${id}/narrate`} className="btn btn-primary w-full">
            Continue review
          </Link>
        </div>
      </main>
    );
  }

  const lc = lightCopy[insight.light];
  const maxCount = Math.max(1, ...insight.breakdown.map((b) => b.count));
  const noteAttempts = attempts.filter((a) => a.aiNote && (a.aiTag || a.selfTag));

  return (
    <main className="pb-28">
      <TopBar title={paper.name} back="/" />

      <div className="px-4">
        {/* The one honest sentence */}
        <div className="card overflow-hidden p-0">
          <div className="flex items-center gap-2 px-5 pt-5">
            <TrafficDot light={insight.light} size={14} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: lc.ink }}>
              {lc.word}
            </span>
          </div>
          <p className="px-5 pb-4 pt-2 text-[1.18rem] font-extrabold leading-snug">{insight.headline}</p>
          <div className="px-5 pb-5">
            <div className="rounded-xl px-4 py-3 text-[0.95rem] font-semibold" style={{ background: lc.soft, color: lc.ink }}>
              💡 {insight.advice}
            </div>
          </div>
        </div>

        {/* Breakdown */}
        {insight.breakdown.length > 0 && (
          <div className="card mt-4 p-5">
            <h3 className="mb-3 text-sm font-bold">Where your marks went</h3>
            <div className="flex flex-col gap-2.5">
              {insight.breakdown
                .sort((a, b) => b.count - a.count)
                .map((b) => (
                  <div key={b.tag} className="flex items-center gap-3">
                    <span className="w-7 text-center text-lg">{TAG_MAP[b.tag as ErrorTag].emoji}</span>
                    <div className="flex-1">
                      <div className="mb-1 flex justify-between text-xs font-semibold">
                        <span>{TAG_MAP[b.tag as ErrorTag].label}</span>
                        <span className="text-[var(--color-ink-soft)]">{b.count}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-paper-2)]">
                        <div
                          className="h-full rounded-full bg-[var(--color-violet)]"
                          style={{ width: `${(b.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            {insight.weakestTopic && (
              <p className="mt-4 rounded-xl bg-[var(--color-paper-2)] px-4 py-2.5 text-sm">
                📌 Topic to revisit: <b>{insight.weakestTopic}</b>
              </p>
            )}
          </div>
        )}

        {/* Per-question AI notes */}
        {noteAttempts.length > 0 && (
          <div className="card mt-4 p-5">
            <h3 className="mb-3 text-sm font-bold">Notes on each one</h3>
            <ul className="flex flex-col gap-3">
              {noteAttempts.map((a) => {
                const q = questions.find((x) => x.id === a.questionId);
                return (
                  <li key={a.id} className="border-b border-[var(--color-line)] pb-3 last:border-0 last:pb-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--color-ink-soft)]">Q{q?.number}</span>
                      <TagBadge tag={(a.aiTag || a.selfTag)!} />
                    </div>
                    <p className="text-sm text-[var(--color-ink-soft)]">{a.aiNote}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          <Link href="/progress" className="btn btn-primary w-full">
            See my progress over time →
          </Link>
          <Link href="/papers/new" className="btn btn-line w-full">
            Add another paper
          </Link>
        </div>
      </div>
    </main>
  );
}
