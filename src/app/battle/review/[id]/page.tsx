"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar, AppLoading } from "@/components/ui";
import { getBattleReview, completeBattleReview, dismissBattleReview } from "@/lib/store";
import { ERROR_TAGS } from "@/lib/errorTags";
import { useMounted } from "@/lib/useStore";
import type { ErrorTag } from "@/lib/types";

// The light post-battle review: for each wrong answer — your pick vs correct,
// one tap-chip on why, done. Tagged mistakes join the same memory as mock
// papers, so the coach and weak-topic picks learn from battles too.
export default function BattleReviewPage() {
  const router = useRouter();
  const mounted = useMounted();
  const id = String(useParams().id || "");
  const review = useMemo(() => (mounted ? getBattleReview(id) : undefined), [mounted, id]);

  const [idx, setIdx] = useState(0);
  const [tags, setTags] = useState<(ErrorTag | undefined)[]>([]);

  if (!mounted) return <AppLoading />;

  if (!review || review.done || review.items.length === 0) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-4xl">✅</div>
        <p className="font-bold">Nothing to review here</p>
        <button onClick={() => router.replace("/")} className="btn btn-primary w-full max-w-xs">Home →</button>
      </main>
    );
  }

  const item = review.items[idx];
  const last = idx === review.items.length - 1;

  function pick(tag: ErrorTag) {
    const next = [...tags];
    next[idx] = tag;
    setTags(next);
    if (!last) {
      setIdx(idx + 1);
    } else {
      completeBattleReview(id, next);
      router.replace("/friends");
    }
  }

  return (
    <main className="pb-28">
      <TopBar title={`Review · ${review.topic}`} back="/" />
      <div className="px-4">
        <div className="mb-1 flex justify-between text-xs font-semibold text-[var(--color-ink-soft)]">
          <span>Mistake {idx + 1} of {review.items.length}</span>
          <button onClick={() => { dismissBattleReview(id); router.replace("/"); }} className="underline">Skip all</button>
        </div>
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-paper-2)]">
          <div className="h-full rounded-full bg-[var(--color-violet)]" style={{ width: `${((idx + 1) / review.items.length) * 100}%` }} />
        </div>

        <div className="card p-4">
          <p className="text-[0.98rem] font-semibold leading-snug">{item.q}</p>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <div className="rounded-xl border border-[var(--color-bad)]/40 bg-[var(--color-bad)]/10 px-3 py-2 text-sm">
            <span className="font-bold">You picked:</span> {item.options[item.myPick] ?? "(skipped)"}
          </div>
          <div className="rounded-xl border border-[var(--color-good,#22c55e)]/40 bg-[var(--color-violet-soft)] px-3 py-2 text-sm">
            <span className="font-bold">Correct:</span> {item.options[item.answer]}
          </div>
          {item.explanation && <p className="px-1 text-xs text-[var(--color-ink-soft)]">{item.explanation}</p>}
        </div>

        <p className="mb-1.5 mt-4 text-xs font-semibold">What happened here?</p>
        <div className="flex flex-col gap-2">
          {ERROR_TAGS.map((t) => (
            <button key={t.tag} onClick={() => pick(t.tag)} className="chip justify-start" data-on={tags[idx] === t.tag}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
