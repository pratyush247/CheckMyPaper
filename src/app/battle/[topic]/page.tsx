"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar, AppLoading, SubjectTag } from "@/components/ui";
import { VisualAnswer } from "@/components/VisualAnswer";
import { Leaderboard } from "@/components/Leaderboard";
import {
  getAccount,
  getWeakTopics,
  getWrongQuestionsForTopic,
  recordBattleResult,
} from "@/lib/store";
import { useMounted } from "@/lib/useStore";
import { PASS_MARK, QUIZ_SIZE, fmtTime } from "@/lib/battle";
import { submitScore } from "@/lib/multiplayer";

interface Visual { title: string; explanation: string; svg: string }
interface QuizQuestion { q: string; options: string[]; answer: number; explanation: string }
type Phase = "lesson" | "quiz" | "result";

export default function BattleStagePage() {
  const router = useRouter();
  const { topic: raw } = useParams<{ topic: string }>();
  const topic = decodeURIComponent(raw);
  const mounted = useMounted();

  const subject = useMemo(() => getWeakTopics().find((t) => t.topic === topic)?.subject || "Unknown", [topic]);
  const wrongQs = useMemo(() => getWrongQuestionsForTopic(topic), [topic]);

  const [phase, setPhase] = useState<Phase>("lesson");
  const [visual, setVisual] = useState<Visual | null>(null);
  const [lessonLoading, setLessonLoading] = useState(true);

  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const startRef = useRef(0);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<{ score: number; timeMs: number; passed: boolean } | null>(null);

  // Lesson visual
  useEffect(() => {
    if (!mounted) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/visual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: topic,
            kind: "lesson",
            context: wrongQs.length ? `The student got these wrong: ${wrongQs.map((q) => q.text).join(" | ")}` : undefined,
          }),
        });
        const data = (await res.json()) as Visual;
        if (live) setVisual(data);
      } catch {
        /* ignore — page still works */
      } finally {
        if (live) setLessonLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [mounted, topic, wrongQs]);

  // Quiz timer
  useEffect(() => {
    if (phase !== "quiz") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase]);

  const startQuiz = useCallback(async () => {
    setPhase("quiz");
    setQuizLoading(true);
    setQuizError(false);
    setQuiz(null);
    setIdx(0);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 110000);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, subject, n: QUIZ_SIZE, className: getAccount()?.klass }),
        signal: ctrl.signal,
      });
      const data = (await res.json()) as { questions?: QuizQuestion[] };
      if (!res.ok || !data.questions?.length) throw new Error("no questions");
      setQuiz(data.questions);
      setAnswers(new Array(data.questions.length).fill(-1));
      startRef.current = Date.now();
      setNow(Date.now());
    } catch {
      setQuizError(true);
    } finally {
      clearTimeout(timeout);
      setQuizLoading(false);
    }
  }, [topic, subject]);

  function choose(option: number) {
    setAnswers((a) => {
      const next = [...a];
      next[idx] = option;
      return next;
    });
  }

  function finish() {
    if (!quiz) return;
    const score = quiz.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);
    const timeMs = Date.now() - startRef.current;
    const passed = score >= PASS_MARK;
    recordBattleResult(topic, score, timeMs, passed);
    const account = getAccount();
    if (account) submitScore({ phone: account.phone, name: account.name, topic, score, timeMs });
    setResult({ score, timeMs, passed });
    setPhase("result");
  }

  function retry() {
    setResult(null);
    setIdx(0);
    setQuiz(null);
    startQuiz();
  }

  if (!mounted) return <AppLoading />;

  // ---- Result ----
  if (phase === "result" && result && quiz) {
    const account = getAccount();
    return (
      <main className="pb-28">
        <TopBar title={topic} back="/battle" />
        <div className="px-4">
          <div className="card p-6 text-center">
            <div className="text-5xl">{result.passed ? "🎉" : "💪"}</div>
            <h2 className="mt-2 text-2xl font-extrabold">
              {result.score}/{quiz.length}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {result.passed ? "Stage cleared!" : `Need ${PASS_MARK}/10 to clear — so close!`} · {fmtTime(result.timeMs)}
            </p>
          </div>

          <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">
            Leaderboard · {topic}
          </h3>
          <Leaderboard
            topic={topic}
            me={{ name: account?.name ?? "You", phone: account?.phone ?? "", score: result.score, timeMs: result.timeMs }}
          />

          {/* review */}
          <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">Review</h3>
          <ul className="flex flex-col gap-2">
            {quiz.map((q, i) => {
              const ok = answers[i] === q.answer;
              return (
                <li key={i} className="card p-4">
                  <p className="text-sm font-semibold">
                    {ok ? "✅" : "❌"} {q.q}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                    Answer: <b>{q.options[q.answer]}</b> — {q.explanation}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex flex-col gap-2.5">
            {result.passed ? (
              <button onClick={() => router.push("/battle")} className="btn btn-primary w-full">
                Back to battles →
              </button>
            ) : (
              <button onClick={retry} className="btn btn-primary w-full">
                Try again
              </button>
            )}
            <button onClick={() => router.push("/battle")} className="btn btn-line w-full">
              Leave
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---- Quiz ----
  if (phase === "quiz") {
    if (quizLoading) {
      return (
        <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="text-4xl">⚔️</div>
          <p className="font-bold">Building your 10 questions…</p>
          <p className="text-sm text-[var(--color-ink-soft)]">Fresh questions on {topic} — this can take up to a minute.</p>
        </main>
      );
    }
    if (quizError || !quiz) {
      return (
        <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="text-4xl">😵‍💫</div>
          <p className="font-bold">Couldn&apos;t build the quiz</p>
          <p className="text-sm text-[var(--color-ink-soft)]">The question generator timed out. Give it another go.</p>
          <div className="flex w-full max-w-xs flex-col gap-2.5">
            <button onClick={startQuiz} className="btn btn-primary w-full">Try again</button>
            <button onClick={() => router.push("/battle")} className="btn btn-line w-full">Back to battles</button>
          </div>
        </main>
      );
    }
    const q = quiz[idx];
    const chosen = answers[idx];
    const elapsed = now - startRef.current;
    return (
      <main className="pb-28">
        <TopBar title={topic} back="/battle" right={<span className="text-sm font-bold tabular-nums">⏱ {fmtTime(elapsed)}</span>} />
        <div className="px-4">
          <div className="mb-1 flex justify-between text-xs font-semibold text-[var(--color-ink-soft)]">
            <span>Question {idx + 1} of {quiz.length}</span>
            <span>{answers.filter((a) => a >= 0).length} answered</span>
          </div>
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-paper-2)]">
            <div className="h-full rounded-full bg-[var(--color-violet)]" style={{ width: `${((idx + 1) / quiz.length) * 100}%` }} />
          </div>

          <div className="card p-4">
            <p className="text-[0.98rem] font-semibold leading-snug">{q.q}</p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {q.options.map((opt, i) => (
              <button key={i} onClick={() => choose(i)} className="chip justify-start" data-on={chosen === i}>
                <span className="font-bold">{String.fromCharCode(65 + i)}.</span> {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-1/2 w-full max-w-[30rem] -translate-x-1/2 border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
          {idx + 1 < quiz.length ? (
            <button onClick={() => setIdx(idx + 1)} disabled={chosen < 0} className="btn btn-primary w-full">
              Next →
            </button>
          ) : (
            <button onClick={finish} disabled={chosen < 0} className="btn btn-primary w-full">
              Finish challenge ⚡
            </button>
          )}
        </div>
      </main>
    );
  }

  // ---- Lesson ----
  return (
    <main className="pb-28">
      <TopBar title={topic} back="/battle" right={<SubjectTag subject={subject} />} />
      <div className="px-4">
        <div className="card mb-4 bg-[var(--color-violet-soft)] p-4">
          <p className="text-[0.95rem] font-semibold leading-snug text-[var(--color-violet-ink)]">
            🎯 First, a quick visual refresher. Then prove you&apos;ve got it — 10 questions, beat the clock.
          </p>
        </div>

        {lessonLoading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="text-4xl">🎨</div>
            <p className="font-bold">Drawing the concept…</p>
          </div>
        ) : (
          visual && (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-extrabold">{visual.title}</h2>
              <VisualAnswer svg={visual.svg} />
              {visual.explanation && <p className="text-[0.95rem] leading-relaxed">{visual.explanation}</p>}
            </div>
          )
        )}

        {wrongQs.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">
              What tripped you up here
            </h3>
            <ul className="flex flex-col gap-2">
              {wrongQs.map((q) => (
                <li key={q.id} className="card p-3 text-sm">
                  {q.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[30rem] -translate-x-1/2 border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <button onClick={startQuiz} disabled={lessonLoading} className="btn btn-primary w-full text-base">
          Start the 10-question challenge →
        </button>
      </div>
    </main>
  );
}

