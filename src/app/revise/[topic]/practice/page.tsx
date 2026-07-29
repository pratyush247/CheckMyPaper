"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar, AppLoading } from "@/components/ui";
import { getAccount, getWeakTopics } from "@/lib/store";
import { useMounted } from "@/lib/useStore";
import { findSubjectFor } from "@/lib/syllabus";
import { fmtTime } from "@/lib/battle";

interface QuizQuestion { q: string; options: string[]; answer: number; explanation: string }
type Phase = "loading" | "error" | "run" | "failed" | "timeup" | "mastered";

// Mastery ladder (error-reset streak): 5 easy → 10 medium → 5 hard. One wrong
// answer ends the run — restart from question 1 on the SAME set until you
// clear all 20. Timed mode = JEE Main pacing (2.4 min/question → 48 min).
// ponytail: same set on restart (instant, free); memorizing the fix IS the drill.
const RUN_MS = 20 * 144_000; // 20 q × 2.4 min (JEE Main: 75 q in 180 min) = 48 min

export default function MasteryPracticePage() {
  const router = useRouter();
  const mounted = useMounted();
  const { topic: raw } = useParams<{ topic: string }>();
  const topic = decodeURIComponent(raw);
  const timed = useMemo(
    () => (typeof window === "undefined" ? false : new URLSearchParams(window.location.search).get("mode") === "timed"),
    [],
  );
  const subject = useMemo(
    () => getWeakTopics().find((t) => t.topic === topic)?.subject || findSubjectFor(topic) || "Unknown",
    [topic],
  );

  const [phase, setPhase] = useState<Phase>("loading");
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(-1); // reveal state on a wrong pick
  const [best, setBest] = useState(0); // deepest question reached this session
  const startRef = useRef(0);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, subject, ladder: true, className: getAccount()?.klass }),
      });
      const data = (await res.json()) as { questions?: QuizQuestion[] };
      if (!res.ok || !data.questions?.length) throw new Error("no questions");
      setQuiz(data.questions);
      setIdx(0);
      setPicked(-1);
      startRef.current = Date.now();
      setNow(Date.now());
      setPhase("run");
    } catch {
      setPhase("error");
    }
  }, [topic, subject]);

  useEffect(() => {
    if (mounted) load();
  }, [mounted, load]);

  // Clock (drives the countdown in timed mode; elapsed display otherwise).
  useEffect(() => {
    if (phase !== "run") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [phase]);

  const elapsed = now - startRef.current;
  const left = RUN_MS - elapsed;
  useEffect(() => {
    if (phase === "run" && timed && left <= 0) setPhase("timeup");
  }, [phase, timed, left]);

  function restart() {
    setIdx(0);
    setPicked(-1);
    startRef.current = Date.now();
    setNow(Date.now());
    setPhase("run");
  }

  function choose(i: number) {
    if (picked >= 0) return; // already revealed
    const q = quiz[idx];
    if (i === q.answer) {
      const next = idx + 1;
      setBest((b) => Math.max(b, next));
      if (next >= quiz.length) setPhase("mastered");
      else setIdx(next);
    } else {
      setPicked(i); // reveal, then the run is over
      setBest((b) => Math.max(b, idx));
      setPhase("failed");
    }
  }

  const tier = (i: number) => (i < 5 ? "Easy" : i < 15 ? "Medium" : "Hard");

  if (!mounted || phase === "loading") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-4xl">🎯</div>
        <p className="font-bold">Building your 20-question ladder…</p>
        <p className="text-sm text-[var(--color-ink-soft)]">5 easy → 10 medium → 5 hard on {topic}. Can take up to a minute.</p>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-4xl">😵‍💫</div>
        <p className="font-bold">Couldn&apos;t build the ladder</p>
        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <button onClick={load} className="btn btn-primary w-full">Try again</button>
          <button onClick={() => router.back()} className="btn btn-line w-full">Back</button>
        </div>
      </main>
    );
  }

  if (phase === "mastered") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-6xl">🏆</div>
        <h2 className="text-2xl font-extrabold">Topic mastered!</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">
          All 20 in one clean run{timed ? ` · ${fmtTime(elapsed)} — inside JEE pace` : ""}. {topic} is officially yours.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <button onClick={load} className="btn btn-primary w-full">New questions, go again</button>
          <button onClick={() => router.back()} className="btn btn-line w-full">Back to revision</button>
        </div>
      </main>
    );
  }

  if (phase === "failed" || phase === "timeup") {
    const q = quiz[idx];
    return (
      <main className="pb-28">
        <TopBar title={topic} back />
        <div className="flex flex-col gap-3 px-4">
          <div className="card p-6 text-center">
            <div className="text-5xl">{phase === "timeup" ? "⏰" : "💔"}</div>
            <h2 className="mt-2 text-xl font-extrabold">{phase === "timeup" ? "Time's up!" : `Run over at question ${idx + 1}`}</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {phase === "timeup"
                ? "JEE pace is 2.4 min a question — tighten up and go again."
                : "One miss resets the ladder — that's how it sticks. Straight back in."}
              {best > 0 && ` Best this session: ${best}/20.`}
            </p>
          </div>

          {phase === "failed" && (
            <div className="card p-4">
              <p className="text-sm font-semibold leading-snug">{q.q}</p>
              <p className="mt-2 rounded-xl bg-[var(--color-bad)]/10 px-3 py-2 text-sm"><b>You picked:</b> {q.options[picked] ?? "—"}</p>
              <p className="mt-1.5 rounded-xl bg-[var(--color-violet-soft)] px-3 py-2 text-sm"><b>Correct:</b> {q.options[q.answer]}</p>
              {q.explanation && <p className="mt-2 text-xs text-[var(--color-ink-soft)]">{q.explanation}</p>}
            </div>
          )}

          <button onClick={restart} className="btn btn-primary w-full">Restart from question 1 →</button>
          <button onClick={load} className="btn btn-line w-full">Fresh questions instead</button>
        </div>
      </main>
    );
  }

  // ---- Run ----
  const q = quiz[idx];
  return (
    <main className="pb-28">
      <TopBar
        title={topic}
        back
        right={
          <span className={`text-sm font-bold tabular-nums ${timed && left < 5 * 60_000 ? "text-[var(--color-bad)]" : ""}`}>
            {timed ? `⏳ ${fmtTime(Math.max(0, left))}` : `⏱ ${fmtTime(elapsed)}`}
          </span>
        }
      />
      <div className="px-4">
        <div className="mb-1 flex justify-between text-xs font-semibold text-[var(--color-ink-soft)]">
          <span>Q{idx + 1} of {quiz.length} · {tier(idx)}</span>
          <span>🔥 streak {idx}</span>
        </div>
        <div className="mb-4 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
          {quiz.map((_, i) => (
            <div key={i} className="h-full flex-1" style={{ background: i < idx ? "var(--color-good)" : i === idx ? "var(--color-violet)" : "var(--color-paper-2)" }} />
          ))}
        </div>

        <div className="card p-4">
          <p className="text-[0.98rem] font-semibold leading-snug">{q.q}</p>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {q.options.map((opt, i) => (
            <button key={i} onClick={() => choose(i)} className="chip justify-start">
              <span className="font-bold">{String.fromCharCode(65 + i)}.</span> {opt}
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-[var(--color-ink-soft)]">One wrong answer restarts the ladder — no pressure 😉</p>
      </div>
    </main>
  );
}
