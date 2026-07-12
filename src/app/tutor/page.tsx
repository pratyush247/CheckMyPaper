"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar, EmptyState, AppLoading } from "@/components/ui";
import { getAllMistakes } from "@/lib/store";
import { useMounted } from "@/lib/useStore";
import { syncMistakes, tutorChat, type ChatTurn } from "@/lib/tutor";
import { FeedbackThumbs } from "@/components/FeedbackThumbs";
import { useRecorder } from "@/lib/recorder";

// Mini markdown renderer for coach replies: **bold**, bullet lists, paragraphs.
// ponytail: no markdown dependency for three constructs; swap for react-markdown if the coach ever needs tables/code.
function Bold({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))}</>;
}
function Md({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const isList = lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l));
        if (isList) {
          return (
            <ul key={bi} className="flex list-disc flex-col gap-1 pl-4">
              {lines.map((l, li) => (
                <li key={li}><Bold text={l.replace(/^\s*([-*•]|\d+[.)])\s+/, "")} /></li>
              ))}
            </ul>
          );
        }
        return <p key={bi}><Bold text={lines.join(" ")} /></p>;
      })}
    </div>
  );
}

const SUGGESTIONS = [
  "Why do I keep losing marks?",
  "What should I revise first?",
  "What's my most common mistake?",
];

export default function TutorPage() {
  const router = useRouter();
  const mounted = useMounted();
  const mistakeCount = useMemo(() => (mounted ? getAllMistakes().length : 0), [mounted]);

  // Edge-swipe-back: a rightward drag (from the left area) pops the route,
  // matching the top-left back arrow. Chat pages hide the bottom nav.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = swipeStart.current;
    swipeStart.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (s.x < 60 && dx > 70 && Math.abs(dy) < 50) router.back();
  };

  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Voice → transcript → sent straight to the coach, who answers in text.
  const rec = useRecorder((text) => send(text));

  // Sync the student's mistakes into the RAG store in the background — the
  // chat is usable immediately, the memory just gets richer once sync lands.
  useEffect(() => {
    if (!mounted || mistakeCount === 0) return;
    syncMistakes().then((r) => {
      setConfigured(r.configured);
      setReady(true);
    });
  }, [mounted, mistakeCount]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || thinking) return;
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");
    setThinking(true);
    const res = await tutorChat(msg, history);
    setThinking(false);
    setMessages((m) => [...m, { role: "assistant", content: res.answer }]);
  }

  if (!mounted) return <AppLoading />;

  if (mistakeCount === 0) {
    return (
      <main className="pb-6" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <TopBar title="Your Coach 🧠" back />
        <EmptyState
          emoji="🧠"
          title="Nothing to coach yet"
          body="Review a mock paper and talk through your mistakes — then I can chat with you about your exact patterns."
        />
        <div className="px-4">
          <Link href="/" className="btn btn-primary w-full">Go review a paper</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[100dvh] flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <TopBar title="Your Coach 🧠" back />

      <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto px-4 pb-4">
        {messages.length === 0 && (
          <div className="card mb-3 bg-[var(--color-violet-soft)] p-4">
            <p className="text-[0.95rem] font-semibold leading-snug text-[var(--color-violet-ink)]">
              👋 I&apos;ve looked at your {mistakeCount} logged mistake{mistakeCount === 1 ? "" : "s"}. Ask me anything about where you&apos;re slipping.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="chip justify-start">
                  {s}
                </button>
              ))}
            </div>
            {!ready && (
              <p className="mt-2 animate-pulse text-xs font-semibold text-[var(--color-violet-ink)]/80">
                🧠 Coach is building your memory — you can start asking already…
              </p>
            )}
            {configured === false && (
              <p className="mt-2 text-xs font-medium text-[var(--color-bad)]">Tutor backend isn&apos;t configured.</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="max-w-[85%] self-end rounded-2xl bg-[var(--color-violet)] px-4 py-2.5 text-[0.95rem] leading-relaxed text-white">
                {m.content}
              </div>
            ) : (
              // Coach replies are full-width cards, same language as the home screen.
              <div key={i} className="card animate-fade-up w-full p-4 text-[0.95rem] leading-relaxed">
                <Md text={m.content} />
              </div>
            ),
          )}
          {thinking && (
            <div className="card w-full animate-pulse p-4 text-sm text-[var(--color-ink-soft)]">
              🧠 Coach is thinking…
            </div>
          )}
        </div>

        {messages.some((m) => m.role === "assistant") && !thinking && (
          <div className="mt-3">
            <FeedbackThumbs target="tutor" label="Was your coach helpful?" />
          </div>
        )}
      </div>

      <div
        className="border-t border-[var(--color-line)] bg-[var(--color-paper)]/95 p-3 backdrop-blur"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {rec.hint && <p className="mb-1 text-xs text-[var(--color-ink-soft)]">{rec.hint}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={rec.phase === "recording" ? `Listening… ${rec.seconds}s` : rec.phase === "transcribing" ? "Transcribing…" : "Ask your coach…"}
            className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-violet)]"
          />
          <button
            onClick={rec.toggle}
            disabled={rec.phase === "transcribing"}
            className={`btn !h-11 !w-11 !p-0 ${rec.phase === "recording" ? "bg-[var(--color-bad)] text-white" : "btn-line"}`}
            aria-label={rec.phase === "recording" ? "Stop recording" : "Talk to your coach"}
          >
            {rec.phase === "recording" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <button
            onClick={() => send(input)}
            disabled={thinking || !input.trim()}
            className="btn btn-primary !h-11 !w-11 !p-0"
            aria-label="Send"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 12l16-7-7 16-2-7-7-2z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}
