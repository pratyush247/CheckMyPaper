"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccount } from "@/lib/store";
import { useRealtime } from "@/lib/realtimeClient";

const SIZES = [2, 4, 6, 8];
const SUBJECTS = ["Physics", "Chemistry", "Maths"];

// Anonymous matchmaking: pick a lobby size + filters, get matched to players
// near your rating (window widens while you wait). Usernames only — no chat,
// no calls, pure competition.
export function PlayOnline() {
  const router = useRouter();
  const account = getAccount();
  const phone = account?.phone ?? "";
  const name = account?.name ?? "";

  const [size, setSize] = useState(2);
  const [subject, setSubject] = useState("Physics");
  const [klass, setKlass] = useState(account?.klass ?? "Dropper");
  const [topic, setTopic] = useState("");
  const [searching, setSearching] = useState(false);
  const [waiting, setWaiting] = useState(1);
  const [waitedSec, setWaitedSec] = useState(0);
  const [msg, setMsg] = useState("");
  const searchingRef = useRef(false);
  searchingRef.current = searching;
  const matchedRef = useRef(false); // once matched, ignore every later signal
  const queuedAt = useRef(0);

  const call = (action: string) =>
    fetch("/api/battle/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, phone, name, klass, subject, topic: topic.trim() || undefined, size }),
    }).then((r) => r.json()) as Promise<{ ok: boolean; matched?: boolean; challengeId?: string; bot?: string; waiting?: number; error?: string }>;

  // Single entry point into a match: navigate exactly once, leave the queue so
  // a stale poll can't re-enqueue us into a second lobby mid-game.
  const goMatch = (challengeId: string, bot?: string) => {
    if (matchedRef.current) return;
    matchedRef.current = true;
    setSearching(false);
    call("leave").catch(() => {});
    router.push(`/battle/challenge/${challengeId}${bot ? `?bot=${encodeURIComponent(bot)}` : ""}`);
  };

  useRealtime(searching && phone ? `user:${phone}` : null, (event, payload) => {
    if (event === "matched") goMatch((payload as { challengeId: string }).challengeId);
  });

  // While searching: tick the wait clock and re-poke the matcher every 10s
  // (that's what widens the rating window server-side). After 40s alone,
  // summon a practice rival so the student still gets a game.
  useEffect(() => {
    if (!searching) return;
    const t = setInterval(async () => {
      if (matchedRef.current) return;
      const waited = Math.round((Date.now() - queuedAt.current) / 1000);
      setWaitedSec(waited);
      const r = await call("join").catch(() => null);
      if (matchedRef.current) return;
      if (r?.matched && r.challengeId) return goMatch(r.challengeId);
      if (r?.waiting) setWaiting(r.waiting);
      if (waited >= 40 && (r?.waiting ?? 1) < 2) {
        const rb = await call("bot").catch(() => null);
        if (rb?.matched && rb.challengeId) goMatch(rb.challengeId, rb.bot);
      }
    }, 10_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching]);

  // Leaving the page abandons the queue.
  useEffect(() => () => { if (searchingRef.current) call("leave").catch(() => {}); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function start() {
    setMsg("");
    setWaitedSec(0);
    matchedRef.current = false;
    queuedAt.current = Date.now();
    const r = await call("join");
    if (!r.ok) return setMsg(r.error || "Couldn't join the queue");
    if (r.matched && r.challengeId) return goMatch(r.challengeId);
    setWaiting(r.waiting ?? 1);
    setSearching(true);
  }
  async function startAnyway() {
    const r = await call("force");
    if (r.matched && r.challengeId) goMatch(r.challengeId);
    else setMsg("Not enough players yet — hang on.");
  }
  async function cancel() {
    setSearching(false);
    await call("leave").catch(() => {});
  }

  if (!phone) return null;

  if (searching) {
    return (
      <div className="card bg-[var(--color-violet-soft)] p-4 text-center">
        <div className="text-3xl">🌐</div>
        <p className="mt-1 font-bold text-[var(--color-violet-ink)]">Finding your match…</p>
        <p className="mt-0.5 text-xs text-[var(--color-violet-ink)]/80">
          {waiting}/{size} in queue · {subject} · {klass}{topic.trim() ? ` · ${topic.trim()}` : ""}
        </p>
        <div className="mt-3 flex justify-center gap-2">
          {waitedSec >= 30 && waiting >= 2 && (
            <button onClick={startAnyway} className="btn btn-primary !px-4 !py-2 text-sm">Start with {Math.min(waiting, size)}</button>
          )}
          <button onClick={cancel} className="btn btn-line !px-4 !py-2 text-sm">Cancel</button>
        </div>
        {msg && <p className="mt-2 text-xs font-semibold text-[var(--color-bad)]">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="card p-4">
      <h2 className="text-sm font-bold">Play Online 🌐</h2>
      <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
        Get matched with players at your level — usernames only, pure competition, live world ranking.
      </p>

      <p className="mb-1.5 mt-3 text-xs font-semibold">Players</p>
      <div className="flex flex-wrap gap-2">
        {SIZES.map((s) => (
          <button key={s} onClick={() => setSize(s)} className="chip" data-on={size === s}>{s}</button>
        ))}
      </div>

      <p className="mb-1.5 mt-3 text-xs font-semibold">Subject</p>
      <div className="flex flex-wrap gap-2">
        {SUBJECTS.map((s) => (
          <button key={s} onClick={() => setSubject(s)} className="chip" data-on={subject === s}>{s}</button>
        ))}
      </div>

      <p className="mb-1.5 mt-3 text-xs font-semibold">Class</p>
      <div className="flex flex-wrap gap-2">
        {["Class 11", "Class 12", "Dropper"].map((k) => (
          <button key={k} onClick={() => setKlass(k)} className="chip" data-on={klass === k}>{k}</button>
        ))}
      </div>

      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Topic (optional — blank = surprise me)"
        className="mt-3 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-violet)]"
      />

      <button onClick={start} className="btn btn-primary mt-3 w-full">Find a match →</button>
      {msg && <p className="mt-2 text-xs font-semibold text-[var(--color-bad)]">{msg}</p>}
    </div>
  );
}
