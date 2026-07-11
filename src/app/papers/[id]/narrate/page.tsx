"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar, SubjectTag, EmptyState, AppLoading } from "@/components/ui";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { ERROR_TAGS, SKIP_REASONS } from "@/lib/errorTags";
import {
  getAttemptForQuestion,
  getPaper,
  getQuestions,
  saveAttempt,
  setPaperInsight,
  computeProfile,
  uid,
} from "@/lib/store";
import { useStoreVersion, useMounted } from "@/lib/useStore";
import type { Attempt, ErrorTag, Question, SkipReason } from "@/lib/types";

// Order flagged questions by topic (biggest trouble-cluster first), so the
// student talks through one concept at a time.
function buildQueue(questions: Question[]): Question[] {
  const flagged = questions.filter((q) => q.state);
  const byTopic = new Map<string, Question[]>();
  for (const q of flagged) {
    const arr = byTopic.get(q.topic) ?? [];
    arr.push(q);
    byTopic.set(q.topic, arr);
  }
  const topics = [...byTopic.entries()].sort((a, b) => b[1].length - a[1].length);
  return topics.flatMap(([, qs]) => qs.sort((a, b) => a.number - b.number));
}

export default function NarratePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const v = useStoreVersion();
  const mounted = useMounted();

  const paper = useMemo(() => getPaper(id), [id, v]);
  const queue = useMemo(() => buildQueue(getQuestions(id)), [id]); // fixed once triage is set

  const [index, setIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [selfTag, setSelfTag] = useState<ErrorTag | undefined>();
  const [skipReason, setSkipReason] = useState<SkipReason | undefined>();
  const [finalizing, setFinalizing] = useState(false);

  const current = queue[index];

  // Load any saved draft when moving to a question.
  useEffect(() => {
    if (!current) return;
    const a = getAttemptForQuestion(current.id);
    setTranscript(a?.transcript ?? "");
    setSelfTag(a?.selfTag);
    setSkipReason(a?.skipReason);
  }, [current]);

  if (!mounted) return <AppLoading />;

  if (!paper || queue.length === 0) {
    return (
      <main>
        <TopBar title="Talk it through" back={`/papers/${id}/triage`} />
        <EmptyState emoji="🎙️" title="Nothing to talk about" body="Flag some mistakes first, then come back." />
      </main>
    );
  }

  const isSkipped = current.state === "skipped";
  const canAdvance = isSkipped ? Boolean(skipReason) : Boolean(selfTag);

  // topic progress
  const topicQs = queue.filter((q) => q.topic === current.topic);
  const topicPos = topicQs.findIndex((q) => q.id === current.id) + 1;

  function persistCurrent() {
    const existing = getAttemptForQuestion(current.id);
    const attempt: Attempt = {
      id: existing?.id ?? uid(),
      questionId: current.id,
      paperId: id,
      state: current.state!,
      transcript: isSkipped ? undefined : transcript.trim() || undefined,
      selfTag: isSkipped ? undefined : selfTag,
      skipReason: isSkipped ? skipReason : undefined,
      aiTag: existing?.aiTag,
      aiNote: existing?.aiNote,
      aiConfidence: existing?.aiConfidence,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    saveAttempt(attempt);

    // Enrich with AI diagnosis in the background (non-blocking).
    if (!isSkipped && selfTag) {
      fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: current.text,
          topic: current.topic,
          transcript: attempt.transcript ?? "",
          selfTag,
        }),
      })
        .then((r) => r.json())
        .then((d: { aiTag?: ErrorTag; confidence?: number; note?: string }) => {
          const latest = getAttemptForQuestion(current.id);
          if (latest) saveAttempt({ ...latest, aiTag: d.aiTag, aiConfidence: d.confidence, aiNote: d.note });
        })
        .catch(() => {});
    }
  }

  function next() {
    persistCurrent();
    if (index + 1 < queue.length) {
      setIndex(index + 1);
    } else {
      finalize();
    }
  }

  async function finalize() {
    setFinalizing(true);
    // small grace period so the last diagnosis can land
    await new Promise((r) => setTimeout(r, 900));

    const attempts = getQuestions(id)
      .map((q) => ({ q, a: getAttemptForQuestion(q.id) }))
      .filter((x) => x.a && (x.a.aiTag || x.a.selfTag));
    const rows = attempts.map((x) => ({ topic: x.q.topic, tag: (x.a!.aiTag || x.a!.selfTag) as ErrorTag }));
    const priorTags = computeProfile()
      .history.filter((h) => h.paperId !== id && h.dominantTag)
      .map((h) => h.dominantTag!) as ErrorTag[];

    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperName: paper!.name, rows, priorTags }),
      });
      const s = (await res.json()) as { headline: string; light: "green" | "amber" | "red"; advice: string };
      const breakdown = Object.entries(
        rows.reduce<Record<string, number>>((acc, r) => ((acc[r.tag] = (acc[r.tag] || 0) + 1), acc), {}),
      ).map(([tag, count]) => ({ tag: tag as ErrorTag, count }));
      const weakest = Object.entries(
        rows.reduce<Record<string, number>>((acc, r) => ((acc[r.topic] = (acc[r.topic] || 0) + 1), acc), {}),
      ).sort((a, b) => b[1] - a[1])[0]?.[0];

      setPaperInsight(id, {
        headline: s.headline,
        light: s.light,
        advice: s.advice,
        breakdown,
        weakestTopic: weakest,
        generatedAt: Date.now(),
      });
    } catch {
      setPaperInsight(id, {
        headline: "We saved your review. Add an internet connection to generate the summary.",
        light: "amber",
        advice: "Your answers are stored — open this paper again to retry.",
        breakdown: [],
        generatedAt: Date.now(),
      });
    }
    router.push(`/papers/${id}/insight`);
  }

  if (finalizing) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-5xl">🧩</div>
        <p className="text-lg font-bold">Finding your pattern…</p>
        <p className="text-sm text-[var(--color-ink-soft)]">Reading through what tripped you up.</p>
      </main>
    );
  }

  return (
    <main className="pb-32">
      <TopBar title={current.topic} back={`/papers/${id}/triage`} />

      {/* progress bar */}
      <div className="px-4">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-[var(--color-ink-soft)]">
          <span>
            {current.topic} · {topicPos} of {topicQs.length}
          </span>
          <span>
            {index + 1}/{queue.length} overall
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-paper-2)]">
          <div
            className="h-full rounded-full bg-[var(--color-violet)] transition-all"
            style={{ width: `${((index + 1) / queue.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-paper-2)] text-xs font-bold">
              {current.number}
            </span>
            <SubjectTag subject={current.subject} />
            <StateBadge state={current.state!} />
          </div>
          <p className="text-[0.98rem] leading-snug">{current.text}</p>
        </div>

        {isSkipped ? (
          <div className="mt-6">
            <h2 className="text-sm font-bold">Why did you skip this one?</h2>
            <p className="mb-3 mt-0.5 text-xs text-[var(--color-ink-soft)]">Pick the closest reason.</p>
            <div className="grid grid-cols-1 gap-2">
              {SKIP_REASONS.map((r) => (
                <button
                  key={r.reason}
                  onClick={() => setSkipReason(r.reason)}
                  className="chip justify-start"
                  data-on={skipReason === r.reason}
                >
                  <span className="text-lg">{r.emoji}</span> {r.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <h2 className="text-sm font-bold">How did you approach it?</h2>
              <p className="mb-3 mt-0.5 text-xs text-[var(--color-ink-soft)]">Say what you did and which option you picked.</p>
              <VoiceRecorder value={transcript} onChange={setTranscript} />
            </div>

            <div className="mt-6">
              <h2 className="text-sm font-bold">What tripped you up?</h2>
              <p className="mb-3 mt-0.5 text-xs text-[var(--color-ink-soft)]">Pick the one that fits best.</p>
              <div className="grid grid-cols-1 gap-2">
                {ERROR_TAGS.map((t) => (
                  <button
                    key={t.tag}
                    onClick={() => setSelfTag(t.tag)}
                    className="chip justify-start"
                    data-on={selfTag === t.tag}
                  >
                    <span className="text-lg">{t.emoji}</span>
                    <span>
                      <span className="font-semibold">{t.label}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[30rem] -translate-x-1/2 border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <button onClick={next} disabled={!canAdvance} className="btn btn-primary w-full text-base">
          {index + 1 < queue.length ? "Next →" : "See my insight ✨"}
        </button>
      </div>
    </main>
  );
}

function StateBadge({ state }: { state: "wrong" | "guessed" | "skipped" }) {
  const map = {
    wrong: { e: "❌", t: "Wrong", c: "var(--color-bad)" },
    guessed: { e: "😬", t: "Guessed", c: "var(--color-warn)" },
    skipped: { e: "⭕", t: "Skipped", c: "var(--color-ink-soft)" },
  }[state];
  return (
    <span className="ml-auto text-xs font-bold" style={{ color: map.c }}>
      {map.e} {map.t}
    </span>
  );
}
