"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar, AppLoading } from "@/components/ui";
import { getAccount } from "@/lib/store";
import { useStoreVersion, useMounted } from "@/lib/useStore";
import { getFriends, getMessages, sendMessage, respond, report, startSubjectChallenge, type ChatMessage, type FriendInfo } from "@/lib/socialClient";
import { useRealtime, useFocusRefetch } from "@/lib/realtimeClient";

// De-dupe by server id: an in-flight poll can race the optimistic send()
// append and return the same message — merging by id keeps exactly one copy.
function mergeMsgs(prev: ChatMessage[], add: ChatMessage[]): ChatMessage[] {
  const seen = new Set(prev.map((m) => m.id));
  const fresh = add.filter((m) => !seen.has(m.id));
  return fresh.length ? [...prev, ...fresh] : prev;
}

export default function ThreadPage() {
  const v = useStoreVersion();
  const mounted = useMounted();
  const account = useMemo(() => getAccount(), [v]);
  const router = useRouter();
  const handle = String(useParams().handle || "");
  const phone = account?.phone ?? "";
  const name = account?.name ?? "";

  const [friend, setFriend] = useState<FriendInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [showChallenge, setShowChallenge] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const sinceRef = useRef<string | undefined>(undefined);
  const threadRef = useRef<string | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const peer = friend?.phone ?? null;

  // resolve the friend (phone + friendship id) from the handle
  useEffect(() => {
    if (!phone) return;
    getFriends(phone).then((f) => setFriend(f.friends.find((x) => x.handle === handle) ?? null));
  }, [phone, handle]);

  const poll = useCallback(async () => {
    if (!phone || !peer) return;
    const r = await getMessages(phone, peer, sinceRef.current);
    threadRef.current = r.threadId;
    setThreadId(r.threadId);
    if (r.messages.length) {
      setMessages((prev) => mergeMsgs(prev, r.messages));
      sinceRef.current = r.messages[r.messages.length - 1].createdAt;
    }
  }, [phone, peer]);

  // Load history once, then messages arrive by realtime push; a focus refetch
  // heals anything missed while the tab was backgrounded.
  useEffect(() => {
    if (peer) poll();
  }, [peer, poll]);
  useRealtime(threadId ? `dm:${threadId}` : null, (event, payload) => {
    if (event === "message") setMessages((prev) => mergeMsgs(prev, [payload as ChatMessage]));
  });
  useFocusRefetch(poll);

  async function send() {
    const body = text.trim();
    if (!body || !peer) return;
    setText("");
    const r = await sendMessage(phone, name, peer, body);
    if (r.ok && r.message) {
      setMessages((p) => mergeMsgs(p, [r.message!]));
      sinceRef.current = r.message.createdAt;
    }
  }
  async function sendSticker(s: string) {
    if (!peer) return;
    setShowStickers(false);
    const r = await sendMessage(phone, name, peer, s, "sticker");
    if (r.ok && r.message) setMessages((p) => mergeMsgs(p, [r.message!]));
  }
  async function startChallenge(subject: string) {
    if (!peer) return;
    let threadId = threadRef.current;
    if (!threadId) { await poll(); threadId = threadRef.current; }
    await startSubjectChallenge(phone, name, subject, peer, threadId ?? undefined);
    setShowChallenge(false);
    poll(); // the challenge card also arrives by realtime; this covers a miss
  }
  async function block() {
    if (!friend) return;
    await respond(phone, friend.id, "block");
    router.back();
  }
  async function doReport() {
    if (!peer) return;
    await report(phone, peer, { reason: "reported from chat" });
    setShowMenu(false);
  }

  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; swipe.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = swipe.current; swipe.current = null; if (!s) return;
    const t = e.changedTouches[0];
    if (s.x < 60 && t.clientX - s.x > 70 && Math.abs(t.clientY - s.y) < 50) router.back();
  };

  if (!mounted || !phone) return <AppLoading />;

  return (
    <main className="flex h-[100dvh] flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <TopBar
        title={`@${handle}`}
        back
        right={
          <div className="relative">
            <button onClick={() => setShowMenu((s) => !s)} aria-label="More" className="px-2 text-lg font-bold text-[var(--color-ink-soft)]">⋯</button>
            {showMenu && (
              <div className="absolute right-0 top-9 z-30 w-36 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-[var(--shadow-card)]">
                <button onClick={doReport} className="block w-full px-4 py-2.5 text-left text-sm">Report</button>
                <button onClick={block} className="block w-full px-4 py-2.5 text-left text-sm text-[var(--color-bad)]">Block</button>
              </div>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pt-2">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-xs text-[var(--color-ink-soft)]">Say hi 👋 or ⚔️ challenge @{handle} to a duel.</p>
        )}
        {messages.map((m) => <ChatBubble key={m.id} m={m} mine={m.sender === phone} />)}
      </div>

      {showChallenge && peer && <SubjectPicker onStart={startChallenge} onClose={() => setShowChallenge(false)} />}

      {showStickers && (
        <div className="grid grid-cols-8 gap-1 border-t border-[var(--color-line)] bg-[var(--color-card)] p-3">
          {STICKERS.map((s) => (
            <button key={s} onClick={() => sendSticker(s)} className="rounded-xl p-1 text-2xl active:bg-[var(--color-paper-2)]" aria-label={`Send ${s}`}>{s}</button>
          ))}
        </div>
      )}

      <div className="border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 px-3 py-3 backdrop-blur" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowChallenge(false); setShowStickers((s) => !s); }} aria-label="Stickers" className="btn btn-ghost shrink-0 !px-3 !py-2 text-sm">😄</button>
          <button onClick={() => { setShowStickers(false); setShowChallenge((s) => !s); }} aria-label="Challenge" className="btn btn-ghost shrink-0 !px-3 !py-2 text-sm">⚔️</button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Message…"
            className="min-w-0 flex-1 rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-2 text-sm outline-none focus:border-[var(--color-violet)]"
          />
          <button onClick={send} disabled={!text.trim()} aria-label="Send" className="btn btn-primary shrink-0 !h-10 !w-10 !p-0 disabled:opacity-50">→</button>
        </div>
      </div>
    </main>
  );
}

// Bundled sticker pack — friends-only fun without an external GIF API.
const STICKERS = ["🔥", "😂", "💀", "🫡", "😭", "🤯", "👑", "🐐", "💪", "🥶", "🤝", "🎯", "🚀", "🧠", "😤", "🏆"];

function ChatBubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  if (m.kind === "sticker") {
    return (
      <div className={`my-1 flex ${mine ? "justify-end" : "justify-start"}`}>
        <span className="px-2 text-5xl leading-none">{m.body}</span>
      </div>
    );
  }
  if (m.kind === "vote") return null; // voting is retired — old ballots just disappear
  if (m.kind === "challenge") {
    const meta = m.meta as { topic?: string; challengeId?: string } | null;
    return (
      <div className="my-1.5 rounded-2xl bg-[var(--color-violet-soft)] p-3 text-center">
        <p className="text-sm font-bold text-[var(--color-violet-ink)]">⚔️ Challenge: {meta?.topic}</p>
        <a href={`/battle/challenge/${meta?.challengeId}`} className="mt-1 inline-block text-xs font-bold text-[var(--color-violet-ink)] underline">Play →</a>
      </div>
    );
  }
  if (m.kind === "result") {
    const meta = m.meta as { ranked?: { phone: string; score: number; rank: number; winner: boolean }[] } | null;
    return (
      <div className="my-1.5 rounded-2xl border border-[var(--color-line)] p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-ink-soft)]">Result 🏆</p>
        {(meta?.ranked ?? []).map((r) => (
          <p key={r.phone} className="text-sm">{r.rank}. {r.score}/10 {r.winner ? "🏆" : ""}</p>
        ))}
      </div>
    );
  }
  return (
    <div className={`my-1 flex ${mine ? "justify-end" : "justify-start"}`}>
      <span className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-[var(--color-ink)] text-[var(--color-card)]" : "bg-[var(--color-paper-2)]"}`}>{m.body}</span>
    </div>
  );
}

// Pick a subject; the server curates the exact topic from the JEE syllabus —
// your common weak areas first, stepping beginner → advanced as you battle.
function SubjectPicker({ onStart, onClose }: { onStart: (subject: string) => Promise<void>; onClose: () => void }) {
  const [subject, setSubject] = useState("Physics");
  const [busy, setBusy] = useState(false);
  return (
    <div className="border-t border-[var(--color-line)] bg-[var(--color-card)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold">⚔️ Start a challenge</span>
        <button onClick={onClose} className="text-xs" aria-label="Close">✕</button>
      </div>
      <p className="mb-1.5 text-xs text-[var(--color-ink-soft)]">
        Pick a subject — we&apos;ll set the topic from what you&apos;re both weakest at, and level it up as you keep battling.
      </p>
      <div className="flex flex-wrap gap-2">
        {["Physics", "Chemistry", "Maths"].map((s) => (
          <button key={s} onClick={() => setSubject(s)} className="chip" data-on={subject === s}>{s}</button>
        ))}
      </div>
      <button
        onClick={async () => { setBusy(true); await onStart(subject); setBusy(false); }}
        disabled={busy}
        className="btn btn-primary mt-3 w-full disabled:opacity-60"
      >
        {busy ? "Curating your paper… ~15s" : "Challenge →"}
      </button>
    </div>
  );
}
