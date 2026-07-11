"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar, AppLoading } from "@/components/ui";
import { getAccount, getWeakTopics } from "@/lib/store";
import { useStoreVersion, useMounted } from "@/lib/useStore";
import { getFriends, getMessages, sendMessage, createChallenge, respond, report, type ChatMessage, type FriendInfo } from "@/lib/socialClient";

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
  const [showMenu, setShowMenu] = useState(false);
  const sinceRef = useRef<string | undefined>(undefined);
  const threadRef = useRef<string | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const weakTopics = useMemo(() => getWeakTopics().slice(0, 6), []);
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
    if (r.messages.length) {
      setMessages((prev) => [...prev, ...r.messages]);
      sinceRef.current = r.messages[r.messages.length - 1].createdAt;
    }
  }, [phone, peer]);

  useEffect(() => {
    if (!peer) return;
    poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [peer, poll]);

  async function send() {
    const body = text.trim();
    if (!body || !peer) return;
    setText("");
    const r = await sendMessage(phone, name, peer, body);
    if (r.ok && r.message) {
      setMessages((p) => [...p, r.message!]);
      sinceRef.current = r.message.createdAt;
    }
  }
  async function challenge(topic: string, subject: string) {
    if (!peer) return;
    setShowChallenge(false);
    await createChallenge(phone, name, topic, { subject, participants: [peer], threadId: threadRef.current ?? undefined });
    poll();
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
          <p className="mt-8 text-center text-xs text-[var(--color-ink-soft)]">Say hi 👋 or ⚔️ challenge @{handle} to a battle.</p>
        )}
        {messages.map((m) => <ChatBubble key={m.id} m={m} mine={m.sender === phone} />)}
      </div>

      {showChallenge && <TopicPicker topics={weakTopics} onPick={challenge} onClose={() => setShowChallenge(false)} />}

      <div className="border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 px-3 py-3 backdrop-blur" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowChallenge((s) => !s)} aria-label="Challenge" className="btn btn-ghost shrink-0 !px-3 !py-2 text-sm">⚔️</button>
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

function ChatBubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
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

function TopicPicker({
  topics,
  onPick,
  onClose,
}: {
  topics: { topic: string; subject: string }[];
  onPick: (topic: string, subject: string) => void;
  onClose: () => void;
}) {
  const list = topics.length ? topics : [{ topic: "General Practice", subject: "Unknown" }];
  return (
    <div className="border-t border-[var(--color-line)] bg-[var(--color-card)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold">Challenge topic (your weak areas)</span>
        <button onClick={onClose} className="text-xs">✕</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((t) => (
          <button key={t.topic} onClick={() => onPick(t.topic, t.subject)} className="chip">{t.topic}</button>
        ))}
      </div>
    </div>
  );
}
