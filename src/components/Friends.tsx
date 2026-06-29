"use client";

import { useEffect, useState } from "react";
import { createGroup, joinGroup, listGroups, type Group } from "@/lib/multiplayer";

// Create / join friend squads (by invite code) for Battle Mode leaderboards.
export function Friends({ phone, name }: { phone: string; name: string }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [groupName, setGroupName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function refresh() {
    const r = await listGroups(phone);
    setConfigured(r.configured);
    setGroups(r.groups);
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  async function doCreate() {
    setBusy(true);
    setMsg("");
    const r = await createGroup(phone, name, groupName);
    setBusy(false);
    if (r.ok) {
      setGroupName("");
      setMsg(`Squad created! Share code ${r.code}`);
      refresh();
    } else setMsg(r.error || "Couldn't create squad");
  }

  async function doJoin() {
    setBusy(true);
    setMsg("");
    const r = await joinGroup(phone, name, code.trim().toUpperCase());
    setBusy(false);
    if (r.ok) {
      setCode("");
      setMsg(`Joined ${r.name}!`);
      refresh();
    } else setMsg(r.error || "Couldn't join");
  }

  if (configured === false) {
    return (
      <div className="card mt-4 p-4">
        <h3 className="text-sm font-bold">Friend squads 👥</h3>
        <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
          Online play is being set up — you&apos;ll soon create a squad and battle friends on the leaderboard.
        </p>
      </div>
    );
  }

  return (
    <div className="card mt-4 p-4">
      <h3 className="text-sm font-bold">Friend squads 👥</h3>
      <p className="mt-0.5 mb-3 text-xs text-[var(--color-ink-soft)]">
        Battle friends on the topic leaderboards.
      </p>

      {groups.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {groups.map((g) => (
            <li key={g.code} className="flex items-center justify-between rounded-xl bg-[var(--color-paper-2)] px-3 py-2">
              <span className="text-sm font-semibold">{g.name}</span>
              <button
                onClick={() => navigator.clipboard?.writeText(g.code).then(() => setMsg(`Copied ${g.code}`))}
                className="rounded-full bg-[var(--color-violet-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-violet-ink)]"
              >
                {g.code} · copy
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="New squad name"
          className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-violet)]"
        />
        <button onClick={doCreate} disabled={busy} className="btn btn-ghost shrink-0 !px-3 !py-2 text-sm">
          Create
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter code to join"
          className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-[var(--color-violet)]"
        />
        <button onClick={doJoin} disabled={busy || !code.trim()} className="btn btn-line shrink-0 !px-3 !py-2 text-sm">
          Join
        </button>
      </div>
      {msg && <p className="mt-2 text-xs font-semibold text-[var(--color-violet-ink)]">{msg}</p>}
    </div>
  );
}
