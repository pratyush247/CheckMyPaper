"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar, SubjectTag, EmptyState, AppLoading } from "@/components/ui";
import { getPaper, getQuestions, updatePaper, updateQuestion } from "@/lib/store";
import { useStoreVersion, useMounted } from "@/lib/useStore";
import type { QuestionState } from "@/lib/types";

const STATES: { key: QuestionState; label: string; emoji: string }[] = [
  { key: "wrong", label: "Wrong", emoji: "❌" },
  { key: "guessed", label: "Guessed", emoji: "😬" },
  { key: "skipped", label: "Skipped", emoji: "⭕" },
];

export default function TriagePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const v = useStoreVersion();
  const mounted = useMounted();

  const paper = useMemo(() => getPaper(id), [id, v]);
  const questions = useMemo(() => getQuestions(id), [id, v]);
  const flagged = questions.filter((q) => q.state);

  if (!mounted) return <AppLoading />;

  if (!paper) {
    return (
      <main>
        <TopBar title="Paper" back="/" />
        <EmptyState emoji="🤔" title="Paper not found" body="It may have been removed." />
      </main>
    );
  }

  function setState(qid: string, state: QuestionState) {
    const current = questions.find((q) => q.id === qid)?.state;
    updateQuestion(qid, { state: current === state ? undefined : state });
  }

  function start() {
    updatePaper(id, { status: "narrating" });
    router.push(`/papers/${id}/narrate`);
  }

  return (
    <main className="pb-32">
      <TopBar title={paper.name} back="/" />
      <div className="px-4">
        <div className="card mb-4 bg-[var(--color-violet-soft)] p-4">
          <p className="text-[0.95rem] font-semibold leading-snug text-[var(--color-violet-ink)]">
            👉 Tap the questions you got <b>wrong</b>, <b>guessed</b>, or <b>skipped</b>.
          </p>
          <p className="mt-1 text-xs text-[var(--color-violet-ink)]/80">
            Leave the ones you nailed untouched — we&apos;ll only talk about the rest.
          </p>
        </div>

        <ul className="flex flex-col gap-2.5">
          {questions.map((q) => (
            <li key={q.id} className="card p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-paper-2)] text-xs font-bold">
                  {q.number}
                </span>
                <SubjectTag subject={q.subject} />
                <span className="truncate text-xs font-semibold text-[var(--color-ink-soft)]">{q.topic}</span>
              </div>
              <p className="text-[0.92rem] leading-snug">{q.text}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {STATES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setState(q.id, s.key)}
                    className="chip justify-center !px-2 text-sm"
                    data-on={q.state === s.key}
                  >
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[30rem] -translate-x-1/2 border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <button onClick={start} disabled={flagged.length === 0} className="btn btn-primary w-full text-base">
          {flagged.length === 0
            ? "Tap your mistakes to continue"
            : `Talk about my ${flagged.length} mistake${flagged.length === 1 ? "" : "s"} →`}
        </button>
      </div>
    </main>
  );
}
