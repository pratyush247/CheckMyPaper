"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar, AppLoading } from "@/components/ui";
import { getAccount, savePendingBattleReview, getBattleReview } from "@/lib/store";
import type { Subject } from "@/lib/types";
import { useMounted } from "@/lib/useStore";
import { fmtTime } from "@/lib/battle";
import { getChallenge, submitChallengeScore, getPeers, connect, type RankedScore, type PeerInfo } from "@/lib/socialClient";
import { useRealtime, useFocusRefetch } from "@/lib/realtimeClient";

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
  const [subject, setSubject] = useState("Unknown");
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [ranked, setRanked] = useState<RankedScore[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const startRef = useRef(0);
  const [now, setNow] = useState(0);

  // Practice-rival mode: ?bot=<name> means the "opponent" is simulated locally
  // — plays a believable game but always loses by a whisker. Never hits the
  // server, so no leaderboard rows and no friend popup.
  const bot = useMemo(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("bot") ?? ""), []);
  const [opp, setOpp] = useState<{ name: string; score: number; answered: number; timeMs: number } | null>(null);

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
      setSubject(c.subject ?? "Unknown");
      setQuiz(c.questions as QuizQuestion[]);
      setParticipants(c.participants ?? []);
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

  // Live during the quiz (rival progress box) and on the result screen
  // (standings update the moment anyone else finishes).
  useRealtime(!bot && (phase === "quiz" || phase === "result") ? `battle:${id}` : null, (event, payload) => {
    if (event === "score") setRanked((payload as { ranked: RankedScore[] }).ranked);
    if (event === "progress") {
      const p = payload as { phone: string; score: number; answered: number; timeMs: number };
      if (p.phone !== phone) setOpp({ name: `rival …${p.phone.slice(-4)}`, score: p.score, answered: p.answered, timeMs: p.timeMs });
    }
  });

  // Simulated rival: answers a question every ~12–27s, decent but beatable.
  // The final margin is settled in finish() — always a close loss.
  useEffect(() => {
    if (phase !== "quiz" || !bot || quiz.length === 0) return;
    let answered = 0, score = 0;
    let nextAt = 12_000 + Math.random() * 15_000;
    const t = setInterval(() => {
      const el = Date.now() - startRef.current;
      if (answered < quiz.length && el >= nextAt) {
        answered++;
        if (Math.random() < 0.65 && score < quiz.length - 2) score++;
        nextAt += 12_000 + Math.random() * 15_000;
      }
      setOpp({ name: bot, score, answered, timeMs: el });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, bot, quiz.length]);
  useFocusRefetch(async () => {
    if (phase !== "result" || bot) return;
    const c = await getChallenge(id).catch(() => null);
    if (c?.scores) setRanked(c.scores);
  });

  // timer
  useEffect(() => {
    if (phase !== "quiz") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase]);

  const choose = useCallback((option: number) => {
    const n = [...answers];
    n[idx] = option;
    setAnswers(n);
    // Tell real opponents where I am (feeds their rival box). Fire-and-forget.
    if (!bot && participants.length > 1) {
      const answered = n.filter((x) => x >= 0).length;
      const score = quiz.reduce((s, q, i) => s + (n[i] === q.answer ? 1 : 0), 0);
      fetch("/api/social/challenge/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: id, phone, answered, score, timeMs: Date.now() - startRef.current }),
      }).catch(() => {});
    }
  }, [idx, answers, bot, participants.length, quiz, id, phone]);

  async function finish() {
    const score = quiz.reduce((s, q, i) => s + (answers[i] === q.answer ? 1 : 0), 0);
    const timeMs = Date.now() - startRef.current;
    // Queue the light review of what I got wrong — it feeds the same memory as
    // mock papers (weak topics, trends, the coach).
    savePendingBattleReview({
      id, topic, subject: subject as Subject,
      items: quiz
        .map((q, i) => ({ q: q.q, options: q.options, myPick: answers[i], answer: q.answer, explanation: q.explanation }))
        .filter((it) => it.myPick !== it.answer),
    });
    setPhase("result");
    if (bot) {
      // Practice rival always loses by a close margin — nothing goes to the server.
      const botScore = Math.max(0, score - 1);
      const botTime = timeMs + 8_000 + Math.floor(Math.random() * 12_000);
      setRanked([
        { phone, score, timeMs, rank: 1, winner: true },
        { phone: "bot", score: botScore, timeMs: botTime, rank: 2, winner: false },
      ]);
      return;
    }
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
                    <span className="text-sm font-semibold">{r.rank}. {r.phone === phone ? "You" : r.phone === "bot" ? `@${bot}` : `…${r.phone.slice(-4)}`} {r.winner ? "🏆" : ""}</span>
                    <span className="text-sm tabular-nums text-[var(--color-ink-soft)]">{r.score}/10 · {fmtTime(r.timeMs)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <FriendPopup me={phone} name={account?.name ?? ""} phones={participants} />

          {!getBattleReview(id)?.done && (
            <button onClick={() => router.push(`/battle/review/${id}`)} className="btn btn-primary mt-5 w-full">
              Review your mistakes → <span className="font-normal opacity-80">(~2 min)</span>
            </button>
          )}
          <button onClick={() => router.push("/")} className={`btn mt-3 w-full ${getBattleReview(id)?.done ? "btn-primary" : "btn-line"}`}>Home →</button>
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
      {opp && (
        <div className="fixed right-3 top-16 z-30 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)]/95 px-3 py-1.5 text-right shadow-[var(--shadow-pop)] backdrop-blur">
          <p className="text-[11px] font-bold leading-tight">@{opp.name}</p>
          <p className="text-[11px] tabular-nums leading-tight text-[var(--color-ink-soft)]">
            {opp.score} ✓ · {opp.answered}/{quiz.length} · {fmtTime(opp.timeMs)}
          </p>
        </div>
      )}
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

// Post-battle "add as a friend?" card: the players I just fought who aren't my
// friends yet, with the bio they flaunt. Bio is only ever shown in this
// friend-request context — never in search.
function FriendPopup({ me, name, phones }: { me: string; name: string; phones: string[] }) {
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    const others = phones.filter((p) => p !== me);
    if (!me || others.length === 0) return;
    getPeers(me, others).then((r) => setPeers(r.peers.filter((p) => p.status === "none"))).catch(() => {});
  }, [me, phones]);

  async function add(handle: string) {
    const r = await connect(me, name, "handle", handle);
    if (r.ok) setSent((s) => new Set(s).add(handle));
  }

  if (peers.length === 0) return null;
  return (
    <div className="card mt-5 bg-[var(--color-violet-soft)] p-4">
      <h3 className="text-sm font-bold text-[var(--color-violet-ink)]">Good game — add them? 🤝</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {peers.map((p) => (
          <li key={p.phone} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--color-card)] px-3 py-2">
            <span className="min-w-0 text-sm">
              <span className="font-semibold">@{p.handle}</span>
              {p.bio && <span className="block truncate text-xs text-[var(--color-ink-soft)]">{p.bio}</span>}
            </span>
            <button
              onClick={() => add(p.handle)}
              disabled={sent.has(p.handle)}
              className="btn btn-primary shrink-0 !px-3 !py-1 text-xs disabled:opacity-60"
            >
              {sent.has(p.handle) ? "Requested ✓" : "Add friend"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
