"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TopBar, EmptyState, SubjectTag, AppLoading } from "@/components/ui";
import { getBattleProgress, getWeakTopics } from "@/lib/store";
import { useStoreVersion, useMounted } from "@/lib/useStore";
import { fmtTime } from "@/lib/battle";

export default function BattlePage() {
  const v = useStoreVersion();
  const mounted = useMounted();
  const topics = useMemo(() => getWeakTopics().slice(0, 8), [v]);
  const progress = useMemo(() => getBattleProgress(), [v]);

  if (!mounted) return <AppLoading />;

  return (
    <main className="pb-28">
      <TopBar title="Battle Mode ⚔️" />

      {topics.length === 0 ? (
        <>
          <EmptyState
            emoji="⚔️"
            title="No battles yet"
            body="Review a mock paper first — your weak topics become battle stages to clear, one concept at a time."
          />
          <div className="px-4">
            <Link href="/" className="btn btn-primary w-full">
              Go review a paper
            </Link>
          </div>
        </>
      ) : (
        <div className="px-4">
          <p className="mb-4 text-sm text-[var(--color-ink-soft)]">
            Clear a stage by scoring <b>7/10</b>. Beat the clock to climb the leaderboard. 🏆
          </p>

          <ol className="relative flex flex-col gap-3">
            {topics.map((t, i) => {
              const prevCleared = i === 0 || Boolean(progress[topics[i - 1].topic]?.clearedAt);
              const mine = progress[t.topic];
              const cleared = Boolean(mine?.clearedAt);
              const locked = !prevCleared && !cleared;

              const inner = (
                <div
                  className="card flex items-center gap-3 p-4"
                  style={{ opacity: locked ? 0.55 : 1 }}
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold"
                    style={{
                      background: cleared ? "var(--color-good-soft)" : "var(--color-violet-soft)",
                      color: cleared ? "var(--color-good)" : "var(--color-violet-ink)",
                    }}
                  >
                    {locked ? "🔒" : cleared ? "✅" : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold">{t.topic}</p>
                      <SubjectTag subject={t.subject} />
                    </div>
                    <p className="text-xs text-[var(--color-ink-soft)]">
                      {cleared && mine
                        ? `Best ${mine.bestScore}/10${mine.bestTimeMs ? ` · ${fmtTime(mine.bestTimeMs)}` : ""}`
                        : locked
                          ? "Clear the previous stage to unlock"
                          : `From ${t.wrongCount} mistake${t.wrongCount === 1 ? "" : "s"} · tap to start`}
                    </p>
                  </div>
                  {!locked && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--color-ink-soft)]">
                      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              );

              return (
                <li key={t.topic}>
                  {locked ? inner : <Link href={`/battle/${encodeURIComponent(t.topic)}`}>{inner}</Link>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
