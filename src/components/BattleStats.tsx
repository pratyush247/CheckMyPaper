"use client";

import { useEffect, useState } from "react";
import { useRealtime } from "@/lib/realtimeClient";

// Battle analytics cards — same visual language as the home tiles.

interface SquadRow { phone: string; handle: string | null; rating: number; battles: number; avgPerf: number }

export function SquadLeaderboard({ code, me }: { code: string; me: string }) {
  const [rows, setRows] = useState<SquadRow[]>([]);
  const load = () => fetch(`/api/battle/stats?code=${code}`).then((r) => r.json()).then((d) => setRows(d.rows ?? [])).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [code]);
  useRealtime(`squad:${code}`, () => load());

  if (rows.length === 0 || rows.every((r) => r.battles === 0)) return null;
  return (
    <div className="card p-4">
      <h2 className="text-sm font-bold">Squad leaderboard 🏆</h2>
      <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">Ranked by battle performance (accuracy · speed · concepts)</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <li
            key={r.phone}
            className={`flex items-center justify-between rounded-xl px-3 py-2 ${r.phone === me ? "bg-[var(--color-violet-soft)]" : "bg-[var(--color-paper-2)]"}`}
          >
            <span className="text-sm font-semibold">
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} {r.phone === me ? "You" : r.handle ? `@${r.handle}` : `…${r.phone.slice(-4)}`}
            </span>
            <span className="text-xs tabular-nums text-[var(--color-ink-soft)]">
              {r.avgPerf} perf · {r.battles} battle{r.battles === 1 ? "" : "s"} · {r.rating}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface MyStats { rating: number; battles: number; wins: number; avgPerf: number; avgScore: number; globalRank: number }

export function MyBattleStats({ phone }: { phone: string }) {
  const [s, setS] = useState<MyStats | null>(null);
  const load = () => fetch(`/api/battle/stats?phone=${phone}`).then((r) => r.json()).then((d) => d.rating !== undefined && setS(d)).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [phone]);
  useRealtime(phone ? `user:${phone}` : null, (e) => e === "rating" && load());

  if (!s || s.battles === 0) return null;
  const winRate = Math.round((s.wins / s.battles) * 100);
  return (
    <div className="mt-4">
      <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--color-ink-soft)]">Your battles ⚔️</h2>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="card p-4 text-center">
          <p className="text-2xl font-extrabold text-[var(--color-violet)]">{s.rating}</p>
          <p className="text-xs font-semibold text-[var(--color-ink-soft)]">rating · #{s.globalRank} worldwide</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-extrabold text-[var(--color-violet)]">{s.battles}</p>
          <p className="text-xs font-semibold text-[var(--color-ink-soft)]">battles · {winRate}% wins</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-extrabold text-[var(--color-violet)]">{s.avgPerf}</p>
          <p className="text-xs font-semibold text-[var(--color-ink-soft)]">avg performance</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-extrabold text-[var(--color-violet)]">{s.avgScore}/10</p>
          <p className="text-xs font-semibold text-[var(--color-ink-soft)]">avg score</p>
        </div>
      </div>
    </div>
  );
}

interface BoardRow { rank: number; phone: string; handle: string | null; rating: number }

export function GlobalLeaderboard({ me }: { me: string }) {
  const [top, setTop] = useState<BoardRow[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    fetch(`/api/battle/stats?global=1&me=${me}`)
      .then((r) => r.json())
      .then((d) => { setTop(d.top ?? []); setMyRank(d.myRank ?? null); setTotal(d.total ?? 0); })
      .catch(() => {});
  }, [me]);

  if (top.length === 0) return null;
  return (
    <div className="card p-4">
      <h2 className="text-sm font-bold">Live world ranking 🌍</h2>
      {myRank && <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">You&apos;re #{myRank} of {total} players</p>}
      <ul className="mt-2 flex flex-col gap-1.5">
        {top.slice(0, 10).map((r) => (
          <li key={r.phone} className={`flex items-center justify-between rounded-xl px-3 py-2 ${r.phone === me ? "bg-[var(--color-violet-soft)]" : "bg-[var(--color-paper-2)]"}`}>
            <span className="text-sm font-semibold">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : `${r.rank}.`} {r.phone === me ? "You" : r.handle ? `@${r.handle}` : "anonymous"}</span>
            <span className="text-xs tabular-nums text-[var(--color-ink-soft)]">{r.rating}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
