"use client";

import { useEffect, useState } from "react";
import { buildLeaderboard, fmtTime, type Racer } from "@/lib/battle";
import { fetchLeaderboard, listGroups, toRacer, type Group } from "@/lib/multiplayer";

interface Me { name: string; phone: string; score: number; timeMs: number }

// Shows the competitive board for a topic. Real Supabase data when configured
// (Global + each friend group, switchable); otherwise seeded local rivals.
export function Leaderboard({ topic, me }: { topic: string; me: Me }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [scope, setScope] = useState<string>("global"); // "global" | group code
  const [racers, setRacers] = useState<Racer[] | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    listGroups(me.phone).then((r) => setGroups(r.groups));
  }, [me.phone]);

  useEffect(() => {
    let live = true;
    setRacers(null);
    const isGlobal = scope === "global";
    fetchLeaderboard(topic, isGlobal ? "global" : "group", isGlobal ? undefined : scope).then((r) => {
      if (!live) return;
      setConfigured(r.configured);
      if (!r.configured) {
        setRacers(buildLeaderboard(topic, { score: me.score, timeMs: me.timeMs }));
        return;
      }
      let list = r.racers.map((x) => toRacer(x, me.phone));
      if (!list.some((x) => x.you)) {
        list = [...list, { name: "You", you: true, score: me.score, timeMs: me.timeMs }];
      }
      list.sort((a, b) => b.score - a.score || a.timeMs - b.timeMs);
      setRacers(list);
    });
    return () => {
      live = false;
    };
  }, [topic, scope, me.phone, me.score, me.timeMs]);

  return (
    <div>
      {configured && (
        <div className="mb-2 flex flex-wrap gap-2">
          <Chip on={scope === "global"} onClick={() => setScope("global")}>🌍 Global</Chip>
          {groups.map((g) => (
            <Chip key={g.code} on={scope === g.code} onClick={() => setScope(g.code)}>👥 {g.name}</Chip>
          ))}
        </div>
      )}

      {racers && (() => {
        const idx = racers.findIndex((r) => r.you);
        if (idx < 0) return null;
        const pct = Math.max(1, Math.round(((idx + 1) / racers.length) * 100));
        return (
          <div className="mb-3 flex items-center justify-between rounded-[var(--radius-xl)] bg-[var(--color-violet)] p-4 text-white shadow-[var(--shadow-pop-violet)]">
            <div>
              <p className="text-[0.68rem] font-extrabold uppercase tracking-wider opacity-80">Your rank</p>
              <p className="font-display text-3xl font-bold leading-none">#{idx + 1}</p>
              <p className="mt-1 text-xs opacity-85">{me.score}/10 · {fmtTime(me.timeMs)}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold leading-none">Top {pct}%</p>
              <p className="mt-1 text-xs opacity-85">of {racers.length} here</p>
            </div>
          </div>
        );
      })()}

      {racers === null ? (
        <div className="card p-6 text-center text-sm text-[var(--color-ink-soft)]">Loading leaderboard…</div>
      ) : (
        <ul className="card divide-y divide-[var(--color-line)]">
          {racers.map((r, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
            return (
              <li
                key={i}
                className="flex items-center gap-3 p-3"
                style={r.you ? { background: "var(--color-violet-soft)" } : undefined}
              >
                <span className="w-6 text-center text-sm font-bold">{medal}</span>
                <span className={`flex-1 text-sm ${r.you ? "font-extrabold text-[var(--color-violet-ink)]" : "font-semibold"}`}>
                  {r.name}
                </span>
                <span className="text-sm font-bold tabular-nums">{r.score}/10</span>
                <span className="w-12 text-right text-xs tabular-nums text-[var(--color-ink-soft)]">{fmtTime(r.timeMs)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-center text-xs text-[var(--color-ink-soft)]">
        {configured
          ? "Compete with friends — make or join a squad in your Profile. 👥"
          : "Rivals are simulated — add Supabase to play with real friends. 👀"}
      </p>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="chip !px-3 !py-1.5 text-xs" data-on={on}>
      {children}
    </button>
  );
}
