"use client";

import { useCallback, useEffect, useState } from "react";
import { listGroups, createGroup, joinGroup, getGroupMembers, addToGroup, type Group, type GroupMember } from "@/lib/multiplayer";
import { useRealtime, useFocusRefetch } from "@/lib/realtimeClient";

const MAX = 8;
type Friend = { handle: string; phone: string; name?: string };

// Group-first squad UI for the friends page: create a squad (username required
// upstream), then invite up to 8 friends via code or by @handle (accepted
// friends only).
export function GroupSection({ phone, name, friends }: { phone: string; name: string; friends: Friend[] }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [groupName, setGroupName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const loadMembers = useCallback(async (c: string) => {
    setMembers((await getGroupMembers(c)).members);
  }, []);

  const refresh = useCallback(async () => {
    const r = await listGroups(phone);
    setGroups(r.groups);
    const next = r.groups.find((g) => g.code === active)?.code ?? r.groups[0]?.code ?? null;
    setActive(next);
    if (next) loadMembers(next);
  }, [phone, active, loadMembers]);

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [phone]);

  // Both phones update instantly when anyone joins or is added to the squad.
  useRealtime(active ? `squad:${active}` : null, () => active && loadMembers(active));
  useRealtime(phone ? `user:${phone}` : null, () => refresh());
  useFocusRefetch(refresh);

  async function doCreate() {
    if (!groupName.trim()) return;
    setBusy(true); setMsg("");
    const r = await createGroup(phone, name, groupName.trim());
    setBusy(false);
    if (r.ok && r.code) { setGroupName(""); setActive(r.code); refresh(); } else setMsg(r.error || "Couldn't create");
  }
  async function doJoin() {
    setBusy(true); setMsg("");
    const r = await joinGroup(phone, name, code.trim().toUpperCase());
    setBusy(false);
    if (r.ok && r.code) { setCode(""); setActive(r.code); refresh(); } else setMsg(r.error || "Couldn't join");
  }
  async function addFriend(handle: string) {
    if (!active) return;
    setBusy(true); setMsg("");
    const r = await addToGroup(phone, name, active, handle);
    setBusy(false);
    if (r.ok) loadMembers(active); else setMsg(r.error || "Couldn't add");
  }

  const group = groups.find((g) => g.code === active) ?? null;
  const memberPhones = new Set(members.map((m) => m.phone));
  const full = members.length >= MAX;

  // ---- No squad yet → create first, then join ----
  if (groups.length === 0) {
    return (
      <div className="card p-4">
        <h2 className="text-sm font-bold">Your squad 🏆</h2>
        <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">Create a squad, then invite up to 8 friends to compete on the leaderboards.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doCreate()}
            placeholder="Name your squad (e.g. Rank Chasers)"
            className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-violet)]"
          />
          <button onClick={doCreate} disabled={busy || !groupName.trim()} className="btn btn-primary shrink-0 !px-4 !py-2 text-sm disabled:opacity-50">Create</button>
        </div>
        <div className="my-3 flex items-center gap-3 text-[0.7rem] font-bold uppercase tracking-wider text-[var(--color-ink-soft)]">
          <span className="h-px flex-1 bg-[var(--color-line)]" /> or <span className="h-px flex-1 bg-[var(--color-line)]" />
        </div>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && code.trim() && doJoin()}
            placeholder="Enter a code to join"
            className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-[var(--color-violet)]"
          />
          <button onClick={doJoin} disabled={busy || !code.trim()} className="btn btn-line shrink-0 !px-4 !py-2 text-sm disabled:opacity-50">Join</button>
        </div>
        {msg && <p className="mt-2 text-xs font-semibold text-[var(--color-bad)]">{msg}</p>}
      </div>
    );
  }

  // ---- Has a squad → manage + invite ----
  return (
    <div className="card p-4">
      {groups.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {groups.map((g) => (
            <button key={g.code} onClick={() => { setActive(g.code); loadMembers(g.code); }} className="chip" data-on={g.code === active}>{g.name}</button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-sm font-bold">{group?.name} 🏆</h2>
        <button
          onClick={() => active && navigator.clipboard?.writeText(active).then(() => setMsg(`Copied ${active}`))}
          className="shrink-0 rounded-full bg-[var(--color-violet-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-violet-ink)]"
        >
          {active} · copy
        </button>
      </div>
      <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{members.length}/{MAX} members · share the code or add friends below</p>

      {members.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {members.map((m) => (
            <li key={m.phone} className="rounded-full bg-[var(--color-paper-2)] px-2.5 py-1 text-xs font-semibold">
              {m.handle ? `@${m.handle}` : m.name || `…${m.phone.slice(-4)}`}{group?.owner === m.phone ? " 👑" : ""}
            </li>
          ))}
        </ul>
      )}

      <p className="mb-1.5 mt-3 text-xs font-semibold">Add a friend to the squad</p>
      {friends.length === 0 ? (
        <p className="text-xs text-[var(--color-ink-soft)]">Add friends below first — once they accept, invite them here.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {friends.map((f) => {
            const inSquad = memberPhones.has(f.phone);
            return (
              <li key={f.phone} className="flex items-center justify-between rounded-xl bg-[var(--color-paper-2)] px-3 py-1.5">
                <span className="text-sm font-semibold">@{f.handle}</span>
                <button
                  onClick={() => addFriend(f.handle)}
                  disabled={busy || inSquad || full}
                  className="btn btn-ghost !px-3 !py-1 text-xs disabled:opacity-50"
                >
                  {inSquad ? "In squad ✓" : full ? "Full" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {msg && <p className="mt-2 text-xs font-semibold text-[var(--color-violet-ink)]">{msg}</p>}
    </div>
  );
}
