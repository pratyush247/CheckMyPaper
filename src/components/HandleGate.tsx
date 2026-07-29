"use client";

import { useEffect, useState } from "react";
import { getAccount, getWeakTopics } from "@/lib/store";
import { useMounted } from "@/lib/useStore";
import { getMe, claimHandle, syncWeakTopics } from "@/lib/socialClient";

// Cache the claimed handle + a "skipped" flag on the device so we don't nag the
// server (or the student) on every page.
const HANDLE_KEY = "cmp.handle";
const SKIP_KEY = "cmp.handleSkipped";

// Global first-run username prompt. Pops once after login if the student hasn't
// claimed a handle; "Skip" tucks it into a persistent pill they can tap later.
export function HandleGate() {
  const mounted = useMounted();
  const account = mounted ? getAccount() : null;
  const phone = account?.phone ?? "";
  const name = account?.name ?? "";

  const [handle, setHandle] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [open, setOpen] = useState(false);
  const [claim, setClaim] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Resolve the student's current handle (cache → server) once.
  useEffect(() => {
    if (!mounted || !phone) return;
    setSkipped(localStorage.getItem(SKIP_KEY) === "1");
    const cached = localStorage.getItem(HANDLE_KEY);
    if (cached) { setHandle(cached); setChecked(true); return; }
    getMe(phone)
      .then((me) => {
        if (me.handle) { localStorage.setItem(HANDLE_KEY, me.handle); setHandle(me.handle); }
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [mounted, phone]);

  // First run, no handle, not skipped → open the modal.
  useEffect(() => {
    if (checked && !handle && !skipped) setOpen(true);
  }, [checked, handle, skipped]);

  // Once we know the handle, push this device's weak topics so friends can find
  // common ground for a challenge.
  useEffect(() => {
    if (!handle || !phone) return;
    const topics = getWeakTopics().map((t) => ({ topic: t.topic, subject: t.subject }));
    if (topics.length) syncWeakTopics(phone, topics).catch(() => {});
  }, [handle, phone]);

  if (!mounted || !phone || handle) return null;

  async function submit() {
    setBusy(true); setErr("");
    const r = await claimHandle(phone, name, claim);
    setBusy(false);
    if (r.ok && r.handle) {
      localStorage.setItem(HANDLE_KEY, r.handle);
      localStorage.removeItem(SKIP_KEY);
      setHandle(r.handle);
      setOpen(false);
    } else {
      setErr(r.error || "Couldn't claim, try again");
    }
  }
  function skip() {
    localStorage.setItem(SKIP_KEY, "1");
    setSkipped(true);
    setOpen(false);
  }

  // Skipped → a persistent entry pill (bottom-right, clear of the header + FAB).
  if (!open) {
    if (!checked) return null;
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 rounded-full bg-[var(--color-violet)] px-3.5 py-2 text-xs font-bold text-white shadow-[var(--shadow-card)]"
      >
        Set @username
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={skip}>
      <div className="card animate-fade-up w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Pick your @handle 👋</h2>
        <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
          Friends find you by this. 3–20 chars, start with a letter, then a–z 0–9 _.
        </p>
        <input
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && claim.trim() && submit()}
          placeholder="@yourhandle"
          autoFocus
          className="mt-3 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-violet)]"
        />
        {err && <p className="mt-2 text-xs font-semibold text-[var(--color-bad)]">{err}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={skip} className="btn btn-line flex-1">Skip for now</button>
          <button onClick={submit} disabled={busy || !claim.trim()} className="btn btn-primary flex-1">{busy ? "Claiming…" : "Claim"}</button>
        </div>
      </div>
    </div>
  );
}
