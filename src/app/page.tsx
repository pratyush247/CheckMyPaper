"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BottomNav } from "@/components/BottomNav";
import { ProfileButton } from "@/components/ProfileButton";
import { Tile } from "@/components/Tile";
import { TopBar, TrafficDot, AppLoading } from "@/components/ui";
import { computeProfile, getAccount, getPapers } from "@/lib/store";
import { useStoreVersion, useMounted } from "@/lib/useStore";
import type { Paper } from "@/lib/types";

function paperHref(p: Paper) {
  if (p.status === "done") return `/papers/${p.id}/insight`;
  if (p.status === "narrating") return `/papers/${p.id}/narrate`;
  return `/papers/${p.id}/triage`;
}
function statusLabel(p: Paper) {
  return p.status === "done" ? "Reviewed" : p.status === "narrating" ? "Talk in progress" : "Ready to review";
}
const TAG_LABEL: Record<string, string> = {
  concept: "concept gaps",
  calc_slip: "calculation slips",
  misread: "misreading questions",
  wrong_method: "wrong methods",
  time: "time pressure",
  second_guess: "second-guessing",
};

export default function Home() {
  const v = useStoreVersion();
  const mounted = useMounted();
  const papers = useMemo(() => getPapers(), [v]);
  const profile = useMemo(() => computeProfile(), [v]);
  const account = useMemo(() => getAccount(), [v]);

  if (!mounted) return <AppLoading />;

  const firstName = (account?.name || "there").split(" ")[0];
  const topTag = (Object.entries(profile.tagTotals).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0]) as string | undefined;
  const paperCount = profile.papersLogged || profile.history.length;

  return (
    <main className="pb-28">
      <TopBar
        left={<ProfileButton />}
        title={`Hey ${firstName} 👋`}
        right={
          <Link
            href="/friends"
            aria-label="Friends"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-card)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M16 11a3 3 0 1 0-2.83-4M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 0c-2.7 0-5 1.6-5 4v1h10M15 20h6v-1c0-2.2-1.9-3.7-4.2-3.95" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        }
      />

      <div className="px-4">
        <p className="mb-4 text-sm text-[var(--color-ink-soft)]">
          What do you want to sharpen today?
        </p>

        {/* Feature grid */}
        <div className="stagger grid grid-cols-2 gap-3">
          <Tile color="yellow" emoji="📄" label="Scan" value="Add paper" caption="Snap a mock & diagnose it" href="/papers/new" />
          <Tile color="lime" emoji="⚔️" label="Play" value="Battle" caption="Beat your weak topics" href="/battle" />
          <Tile color="purple" emoji="🧠" label="Ask" value="Coach" caption="Chat with your mistakes" href="/tutor" />
          <Tile color="sky" emoji="📊" label="Stats" value="Progress" caption="See your patterns grow" href="/progress" />
        </div>

        {/* Pattern highlight */}
        {profile.totalDiagnosed > 0 && topTag && (
          <Link href="/progress" className="mt-3 block">
            <div className="tile tile-orange">
              <div className="flex items-center gap-2 text-[0.7rem] font-extrabold uppercase tracking-wider opacity-80">
                <TrafficDot light="amber" /> Your pattern so far
              </div>
              <p className="mt-1.5 text-[0.98rem] font-bold leading-snug">
                Across {paperCount} paper{paperCount === 1 ? "" : "s"}, your top leak is {TAG_LABEL[topTag] || topTag}. Tap to see the full picture →
              </p>
            </div>
          </Link>
        )}

        {/* Recent papers */}
        <div className="mt-7 flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[var(--color-ink-soft)]">Your papers</h2>
          <Link href="/papers/new" className="text-sm font-bold text-[var(--color-violet)]">+ Add</Link>
        </div>

        {papers.length === 0 ? (
          <div className="card mt-2 p-5 text-center">
            <p className="text-3xl">📄</p>
            <p className="mt-1 font-bold">No papers yet</p>
            <p className="text-sm text-[var(--color-ink-soft)]">Tap a tile above to add your first mock.</p>
          </div>
        ) : (
          <ul className="stagger mt-2 flex flex-col gap-2.5">
            {papers.map((p) => (
              <li key={p.id}>
                <Link href={paperHref(p)} className="card flex items-center gap-3 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-violet-soft)] text-lg">
                    {p.status === "done" ? "✅" : "📝"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.name}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">{p.questionCount} questions · {statusLabel(p)}</p>
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
      </div>

      <BottomNav />
    </main>
  );
}
