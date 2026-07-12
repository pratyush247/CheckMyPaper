"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar, AppLoading } from "@/components/ui";
import { getAccount } from "@/lib/store";
import { useMounted } from "@/lib/useStore";
import { fmtTime } from "@/lib/battle";
import { getChallenge, submitChallengeScore, type RankedScore } from "@/lib/socialClient";

interface QuizQuestion { q: string; options: string[]; answer: number; explanation: string }
type Phase = "loading" | "quiz" | "result" | "error";

export default function ChallengePlayPage() {
  const router = useRouter();
  const mounted = useMounted();
  const id = String(useParams().id || "");
  const account = useMemo(() => getAccount(), []);
  const phone = account?.phone ?? "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [topic, setTopic] = useState("");
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [ranked, setRanked] = useState<RankedScore[]>([]);
  const startRef = useRef(0);
  const [now, setNow] = useState(0);

  // load the frozen challenge — state is PER VIEWER: if I already have a score,
  // show results (re-opening a finished challenge never replays it); if I
  // haven't played, I can play even when everyone else already finished.
  useEffect(() => {
    if (!mounted || !phone) return;
    (async () => {
      const c = await getChallenge(id);
      if (!c.configured || c.error || !Array.isArray(c.questions) || c.questions.length === 0) {
        setPhase("error");
        return;
      }
      setTopic(c.topic);
      setQuiz(c.questions as QuizQuestion[]);
      if ((c.scores ?? []).some((s) => s.phone === phone)) {
        setRanked(c.scores);
        setPhase("result");
        return;
      }
      setAnswers(new Array((c.questions as QuizQuestion[]).length).fill(-1));
      startRef.current = Date.now();
      setNow(Date.now());
      setPhase("quiz");
    })();
  }, [mounted, id, phone]);

  // On the result screen, keep standings fresh until everyone has played.
  useEffect(() => {
    if (phase !== "result") return;
    const t = setInterval(async () => {
      const c = await getChallenge(id).catch(() => null);
      if (c?.scores) setRanked(c.scores);
      if (c?.status === "closed") clearInterval(t);
    }, 4000);
    return () => clearInterval(t);
  }, [phase, id]);

  // timer
  useEffect(() => {
    if (phase !== "quiz") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase]);

  const choose = useCallback((option: number) => {
    setAnswers((a) => { const n = [...a]; n[idx] = option; return n; });
  }, [idx]);

  async function finish() {
    const score = quiz.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);
    const timeMs = Date.now() - startRef.current;
    setPhase("result");
    const r = await submitChallengeScore(id, phone, score, timeMs);
    if (r.ok) setRanked(r.ranked);
  }

  if (!mounted || phase === "loading") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-4xl">⚔️</div>
        <p className="font-bold">Loading the challenge…</p>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-4xl">🤔</div>
        <p className="font-bold">Challenge not available</p>
        <p className="text-sm text-[var(--color-ink-soft)]">It may have expired, or online play isn&apos;t set up.</p>
        <button onClick={() => router.push("/friends")} className="btn btn-primary w-full max-w-xs">Back to friends</button>
      </main>
    );
  }

  if (phase === "result") {
    const mine = ranked.find((r) => r.phone === phone);
    return (
      <main className="pb-28">
        <TopBar title={topic} back="/" />
        <div className="px-4 pt-1">
          <div className="card p-6 text-center">
            <div className="text-5xl">{mine?.winner ? "🏆" : "💪"}</div>
            <h2 className="mt-2 text-2xl font-bold">{mine ? `${mine.score}/${quiz.length}` : "Submitted"}</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {ranked.length <= 1 ? "Waiting for the others to play…" : mine?.winner ? "You're on top!" : "Scores are in."}
            </p>
          </div>

          {ranked.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">Standings</h3>
              <ul className="flex flex-col gap-2">
                {ranked.map((r) => (
                  <li key={r.phone} className={`card flex items-center justify-between p-3 ${r.phone === phone ? "border-[var(--color-violet)]" : ""}`}>
                    <span className="text-sm font-semibold">{r.rank}. {r.phone === phone ? "You" : `…${r.phone.slice(-4)}`} {r.winner ? "🏆" : ""}</span>
                    <span className="text-sm tabular-nums text-[var(--color-ink-soft)]">{r.score}/10 · {fmtTime(r.timeMs)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <button onClick={() => router.push("/")} className="btn btn-primary mt-5 w-full">Home →</button>
        </div>
      </main>
    );
  }

  // ---- Quiz ----
  const q = quiz[idx];
  const chosen = answers[idx];
  const elapsed = now - startRef.current;
  return (
    <main className="pb-28">
      <TopBar title={topic} right={<span className="text-sm font-bold tabular-nums">⏱ {fmtTime(elapsed)}</span>} />
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
          <button onClick={() => setIdx(idx + 1)} disabled={chosen < 0} className="btn btn-primary w-full">Next →</button>
        ) : (
          <button onClick={finish} disabled={chosen < 0} className="btn btn-primary w-full">Finish ⚡</button>
        )}
      </div>
    </main>
  );
}
