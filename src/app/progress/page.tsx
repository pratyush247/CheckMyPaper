"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Tile } from "@/components/Tile";
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
        <TopBar title="Your progress 📊" />
        <EmptyState emoji="📈" title="Your patterns will appear here" body="Review a paper or two and we'll show where you keep slipping — and where you're improving." />
        <div className="px-4">
          <Link href="/papers/new" className="btn btn-primary w-full">Add a paper</Link>
        </div>
        <BottomNav />
      </main>
    );
  }

  const tagEntries = (Object.entries(profile.tagTotals) as [ErrorTag, number][]).sort((a, b) => b[1] - a[1]);
  const topTag = tagEntries[0]?.[0];
  const tagTotal = tagEntries.reduce((s, [, n]) => s + n, 0) || 1;
  const topShare = topTag ? Math.round((tagEntries[0][1] / tagTotal) * 100) : 0;

  const topicEntries = Object.entries(profile.topicTrouble).sort(
    (a, b) => b[1].papers.length - a[1].papers.length || b[1].count - a[1].count,
  );
  const recurring = topicEntries.filter(([, t]) => t.papers.length >= 2);
  const focusTopic = topicEntries[0]?.[0];
  const history = profile.history.filter((h) => h.diagnosed > 0);

  return (
    <main className="pb-28">
      <TopBar title="Your progress 📊" />

      <div className="px-4">
        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-3">
          <Tile color="yellow" emoji="📚" label="Papers" value={history.length} caption="reviewed so far" />
          <Tile color="orange" emoji="🎯" label="Decoded" value={profile.totalDiagnosed} caption="mistakes understood" />
          <Tile color="purple" emoji="🧠" label="Top leak" value={`${topShare}%`} caption={topTag ? TAG_SHORT[topTag] : ""} />
          <Tile color="sky" emoji="🔁" label="Focus" value={<span className="text-lg leading-tight">{focusTopic ?? "—"}</span>} caption="revise this next" />
        </div>

        {/* Mistake mix */}
        <div className="card mt-5 p-5">
          <h3 className="mb-3 text-sm font-extrabold">Your mistake mix</h3>
          <div className="flex flex-col gap-2.5">
            {tagEntries.map(([tag, n]) => (
              <div key={tag} className="flex items-center gap-3">
                <span className="w-7 text-center text-lg">{TAG_MAP[tag].emoji}</span>
                <div className="flex-1">
                  <div className="mb-1 flex justify-between text-xs font-semibold">
                    <span>{TAG_MAP[tag].label}</span>
                    <span className="text-[var(--color-ink-soft)]">{Math.round((n / tagTotal) * 100)}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-paper-2)]">
                    <div className="h-full rounded-full bg-[var(--color-violet)]" style={{ width: `${(n / tagTotal) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Paper by paper */}
        {history.length >= 2 && (
          <div className="card mt-4 p-5">
            <h3 className="mb-3 text-sm font-extrabold">Paper by paper</h3>
            <ul className="flex flex-col gap-2.5">
              {history.map((h) => (
                <li key={h.paperId} className="flex items-center gap-3">
                  <span className="text-lg">{h.dominantTag ? TAG_MAP[h.dominantTag].emoji : "—"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{paperName(h.paperId)}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">Mostly {h.dominantTag ? TAG_SHORT[h.dominantTag] : "—"} · {h.diagnosed} reviewed</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Revise these */}
        {topicEntries.length > 0 && (
          <div className="card mt-4 p-5">
            <h3 className="mb-1 text-sm font-extrabold">Revise these next</h3>
            <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
              {recurring.length > 0 ? "These keep costing you marks across papers." : "Topics where you slipped this time."}
            </p>
            <ul className="flex flex-col gap-2">
              {topicEntries.slice(0, 5).map(([topic, t]) => (
                <li key={topic} className="flex items-center justify-between rounded-xl bg-[var(--color-paper-2)] px-4 py-2.5">
                  <span className="text-sm font-semibold">{topic}</span>
                  <span className="text-xs font-bold text-[var(--color-violet)]">{t.papers.length >= 2 ? `${t.papers.length} papers` : `${t.count}×`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link href="/battle" className="btn btn-primary mt-5 w-full">Train weak topics in Battle ⚔️</Link>
      </div>

      <BottomNav />
    </main>
  );
}
