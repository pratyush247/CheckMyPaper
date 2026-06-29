"use client";

import { useEffect, useState } from "react";

interface Item {
  id: string; phone: string | null; name: string | null;
  type: string; target: string | null; rating: string | null;
  message: string | null; created_at: string;
}

const EMOJI: Record<string, string> = { reaction: "📊", idea: "💡", bug: "🐞", love: "❤️" };

export default function AdminFeedback() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("cmp.adminToken") : null;
    if (t) { setToken(t); load(t); }
  }, []);

  async function load(t: string) {
    setErr(""); setLoading(true);
    try {
      const res = await fetch(`/api/feedback?token=${encodeURIComponent(t)}`);
      if (res.status === 401) { setErr("Wrong token."); setItems(null); return; }
      const d = (await res.json()) as { items: Item[] };
      setItems(d.items || []);
      localStorage.setItem("cmp.adminToken", t);
    } catch {
      setErr("Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  const up = items?.filter((i) => i.rating === "up").length ?? 0;
  const down = items?.filter((i) => i.rating === "down").length ?? 0;
  const ideas = items?.filter((i) => i.type === "idea").length ?? 0;
  const written = items?.filter((i) => i.message) ?? [];

  return (
    <main className="mx-auto max-w-[40rem] p-4">
      <h1 className="text-xl font-extrabold">Feedback review</h1>
      <div className="mt-3 flex gap-2">
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Admin token"
          type="password"
          className="flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-violet)]"
        />
        <button onClick={() => load(token)} className="btn btn-primary !px-4 !py-2 text-sm">Load</button>
      </div>
      {err && <p className="mt-2 text-sm font-medium text-[var(--color-bad)]">{err}</p>}

      {items && (
        <>
          <div className="card mt-4 flex justify-around p-4 text-center">
            <div><p className="text-xl font-extrabold text-[var(--color-good)]">👍 {up}</p><p className="text-xs text-[var(--color-ink-soft)]">helpful</p></div>
            <div><p className="text-xl font-extrabold text-[var(--color-bad)]">👎 {down}</p><p className="text-xs text-[var(--color-ink-soft)]">not</p></div>
            <div><p className="text-xl font-extrabold text-[var(--color-violet)]">💡 {ideas}</p><p className="text-xs text-[var(--color-ink-soft)]">ideas</p></div>
            <div><p className="text-xl font-extrabold">{items.length}</p><p className="text-xs text-[var(--color-ink-soft)]">total</p></div>
          </div>

          <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">
            Written feedback ({written.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {written.map((i) => (
              <li key={i.id} className="card p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
                  <span>{EMOJI[i.type] || "•"} {i.type}{i.target ? ` · ${i.target}` : ""}{i.rating ? ` · ${i.rating}` : ""}</span>
                  <span className="ml-auto">{i.name || i.phone || "anon"} · {new Date(i.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm">{i.message}</p>
              </li>
            ))}
            {written.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">No written feedback yet.</p>}
          </ul>
        </>
      )}
      {loading && <p className="mt-3 text-sm text-[var(--color-ink-soft)]">Loading…</p>}
    </main>
  );
}
