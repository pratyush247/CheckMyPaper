"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { TopBar, AppLoading, HomeButton } from "@/components/ui";
import { getAccount } from "@/lib/store";
import { useStoreVersion, useMounted } from "@/lib/useStore";
import { getMe, claimHandle, searchHandles, connect, respond, getFriends, saveBio, type FriendInfo, type PendingReq } from "@/lib/socialClient";
import { GroupSection } from "@/components/GroupSection";
import { useRealtime } from "@/lib/realtimeClient";

export default function FriendsPage() {
  const v = useStoreVersion();
  const mounted = useMounted();
  const account = useMemo(() => getAccount(), [v]);
  const phone = account?.phone ?? "";
  const name = account?.name ?? "";

  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [handle, setHandle] = useState<string | null>(null);
  const [bio, setBio] = useState(""); // draft value in the input
  const [savedBio, setSavedBio] = useState(""); // persisted value, shown as a subheading
  const [bioSaved, setBioSaved] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [claim, setClaim] = useState("");
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [incoming, setIncoming] = useState<PendingReq[]>([]);
  const [results, setResults] = useState<{ handle: string; phone: string; name: string }[]>([]);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(async () => {
    if (!phone) return;
    try {
      const me = await getMe(phone);
      setConfigured(me.configured);
      setHandle(me.handle);
      setSavedBio(me.bio || "");
      setBio((prev) => prev || me.bio || "");
      if (me.configured) {
        const f = await getFriends(phone);
        setFriends(f.friends);
        setIncoming(f.incoming);
      }
    } catch {
      // Network still down after a retry — show a soft message, don't crash.
      setMsg("Couldn't reach the server. Check your connection and tap Add to retry.");
    } finally {
      setReady(true);
    }
  }, [phone]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Incoming friend requests / acceptances appear without a reload.
  useRealtime(phone ? `user:${phone}` : null, () => refresh());

  const [editingHandle, setEditingHandle] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  async function doChangeHandle() {
    const r = await claimHandle(phone, name, newHandle, true);
    if (r.ok) { setEditingHandle(false); setNewHandle(""); setMsg("Username updated ✓"); refresh(); }
    else setMsg(r.error || "Couldn't change username");
  }
  async function doBio() {
    const trimmed = bio.trim();
    await saveBio(phone, trimmed);
    setSavedBio(trimmed);
    setBioSaved(true);
    setEditingBio(false);
    setTimeout(() => setBioSaved(false), 1500);
  }
  async function doClaim() {
    const r = await claimHandle(phone, name, claim);
    if (r.ok) { setMsg(""); refresh(); } else setMsg(r.error || "Couldn't claim");
  }
  async function doSearch(q: string) {
    if (q.trim().length < 2) return setResults([]);
    setResults((await searchHandles(q, phone)).results);
  }
  async function add(target: string) {
    const r = await connect(phone, name, "handle", target);
    setMsg(r.ok ? (r.status === "accepted" ? "Connected!" : "Request sent!") : r.error || "");
    setResults([]);
    refresh();
  }
  async function accept(id: string) { await respond(phone, id, "accept"); refresh(); }
  async function decline(id: string) { await respond(phone, id, "decline"); refresh(); }

  if (!mounted || (!ready && phone)) return <AppLoading />;

  if (!phone) {
    return (
      <main className="pb-28">
        <TopBar title="Friends 👋" back right={<HomeButton />} />
        <div className="px-4 pt-2">
          <div className="card p-4">
            <p className="text-sm text-[var(--color-ink-soft)]">Log in first to connect with friends.</p>
            <Link href="/login" className="btn btn-primary mt-3 w-full">Go to login</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!configured) {
    return (
      <main className="pb-28">
        <TopBar title="Friends 👋" back right={<HomeButton />} />
        <div className="px-4 pt-2">
          <div className="card p-4">
            <h2 className="text-sm font-bold">Friends 👥</h2>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
              Online play is being set up — you&apos;ll soon add friends, chat, and challenge them.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-28">
      <TopBar title="Friends 👋" back right={<HomeButton />} />
      <div className="flex flex-col gap-4 px-4 pt-1">
        {!handle ? (
          <div className="card animate-fade-up p-4">
            <h2 className="text-sm font-bold">Pick your @handle</h2>
            <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">Friends find you by this. 3–20 chars, a–z 0–9 _.</p>
            <div className="mt-2 flex gap-2">
              <input value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="@yourhandle" className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-violet)]" />
              <button onClick={doClaim} disabled={!claim.trim()} className="btn btn-primary shrink-0 !px-4 !py-2 text-sm">Claim</button>
            </div>
            {msg && <p className="mt-2 text-xs font-semibold text-[var(--color-bad)]">{msg}</p>}
          </div>
        ) : (
          <>
            {/* Identity tile — same visual language as the home screen tiles. */}
            <div className="tile tile-purple animate-fade-up">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[0.7rem] font-extrabold uppercase tracking-wider opacity-80">👤 You are</div>
                <button onClick={() => { setEditingHandle((v) => !v); setMsg(""); }} className="text-xs font-bold underline underline-offset-2">
                  {editingHandle ? "Cancel" : "Change"}
                </button>
              </div>
              <p className="mt-1 text-xl font-extrabold">@{handle}</p>
              {savedBio && !editingBio ? (
                <p className="mt-0.5 text-sm font-semibold opacity-80">{savedBio}</p>
              ) : null}
              {editingHandle && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={newHandle}
                    onChange={(e) => setNewHandle(e.target.value)}
                    placeholder="@newhandle"
                    className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs text-[#17181c] outline-none focus:border-[var(--color-violet)]"
                  />
                  <button onClick={doChangeHandle} disabled={!newHandle.trim()} className="btn btn-primary shrink-0 !px-3 !py-1.5 text-xs">Save</button>
                </div>
              )}
              {savedBio && !editingBio ? (
                <button onClick={() => setEditingBio(true)} className="mt-2 text-xs font-bold underline underline-offset-2">Edit bio</button>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 15))}
                    onKeyDown={(e) => e.key === "Enter" && doBio()}
                    placeholder="Bio (max 15 chars)"
                    maxLength={15}
                    className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs text-[#17181c] outline-none focus:border-[var(--color-violet)]"
                  />
                  <button onClick={doBio} className="btn btn-primary shrink-0 !px-3 !py-1.5 text-xs">{bioSaved ? "Saved ✓" : "Save"}</button>
                </div>
              )}
            </div>

            <GroupSection phone={phone} name={name} friends={friends} />

            <div>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--color-ink-soft)]">Add a friend ➕</h2>
              <div className="card p-4">
                <input onChange={(e) => doSearch(e.target.value)} placeholder="Search @handle" className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-violet)]" />
                {results.map((r) => (
                  <div key={r.phone} className="mt-2 flex items-center justify-between rounded-xl bg-[var(--color-paper-2)] px-3 py-2">
                    <span className="text-sm font-semibold">@{r.handle} <span className="font-normal text-[var(--color-ink-soft)]">· {r.name}</span></span>
                    <button onClick={() => add(r.handle)} className="btn btn-ghost !px-3 !py-1 text-xs">Add</button>
                  </div>
                ))}
              </div>
            </div>

            {incoming.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--color-ink-soft)]">Requests 📨</h2>
                <ul className="stagger flex flex-col gap-2">
                  {incoming.map((r) => (
                    <li key={r.id} className="card flex items-center justify-between gap-2 p-3.5">
                      <span className="min-w-0 text-sm">
                        <span className="font-semibold">@{r.handle}</span>
                        {r.bio && <span className="block truncate text-xs text-[var(--color-ink-soft)]">{r.bio}</span>}
                      </span>
                      <span className="flex shrink-0 gap-2">
                        <button onClick={() => accept(r.id)} className="btn btn-primary !px-3 !py-1 text-xs">Accept</button>
                        <button onClick={() => decline(r.id)} className="btn btn-line !px-3 !py-1 text-xs">Decline</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--color-ink-soft)]">Your friends 👥</h2>
              {friends.length === 0 ? (
                <div className="card p-5 text-center">
                  <p className="text-3xl">🫂</p>
                  <p className="mt-1 text-xs text-[var(--color-ink-soft)]">No friends yet — add someone above.</p>
                </div>
              ) : (
                <ul className="stagger flex flex-col gap-2.5">
                  {friends.map((f) => (
                    <li key={f.phone}>
                      <Link href={`/friends/${f.handle}`} className="card flex items-center gap-3 p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-violet-soft)] text-lg font-extrabold text-[var(--color-violet-ink)]">
                          {f.handle.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">@{f.handle}</p>
                          <p className="text-xs text-[var(--color-ink-soft)]">Chat · challenge to a duel</p>
                        </div>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--color-ink-soft)]">
                          <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {msg && <p className="text-center text-xs font-semibold text-[var(--color-violet-ink)]">{msg}</p>}
          </>
        )}
      </div>
    </main>
  );
}
