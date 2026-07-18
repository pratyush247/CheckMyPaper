"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar, AppLoading, SubjectTag } from "@/components/ui";
import { getWeakTopics, getWrongQuestionsForTopic } from "@/lib/store";
import { useMounted } from "@/lib/useStore";

interface ConceptItem { name: string; explanation: string }
interface Flashcard { front: string; back: string }
interface MindNode { label: string; children?: MindNode[] }

type Tool = "concepts" | "flashcards" | "mindmap";

// Revise hub: every wrong question of a topic clubbed together, the concepts
// behind them explained, plus NotebookLM-style tools (flashcards, mind map)
// and the two mastery practice modes.
export default function RevisePage() {
  const mounted = useMounted();
  const { topic: raw } = useParams<{ topic: string }>();
  const topic = decodeURIComponent(raw);
  const subject = useMemo(() => getWeakTopics().find((t) => t.topic === topic)?.subject || "Unknown", [topic]);
  const wrongQs = useMemo(() => (mounted ? getWrongQuestionsForTopic(topic) : []), [mounted, topic]);

  const [tool, setTool] = useState<Tool>("concepts");
  const [showAllQs, setShowAllQs] = useState(false);

  // Each tool loads once, on first open, then stays cached in state.
  const [concepts, setConcepts] = useState<ConceptItem[] | null>(null);
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [map, setMap] = useState<MindNode | null>(null);
  const [loading, setLoading] = useState<Tool | null>(null);

  useEffect(() => {
    if (!mounted) return;
    const have = tool === "concepts" ? concepts : tool === "flashcards" ? cards : map;
    if (have || loading === tool) return;
    setLoading(tool);
    fetch("/api/revise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, subject, kind: tool, questions: wrongQs.map((q) => q.text) }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (tool === "concepts") setConcepts(d.concepts ?? []);
        else if (tool === "flashcards") setCards(d.cards ?? []);
        else setMap(d.root ?? null);
      })
      .catch(() => {
        if (tool === "concepts") setConcepts([]);
        else if (tool === "flashcards") setCards([]);
      })
      .finally(() => setLoading((l) => (l === tool ? null : l)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, tool]);

  if (!mounted) return <AppLoading />;

  const visibleQs = showAllQs ? wrongQs : wrongQs.slice(0, 3);

  return (
    <main className="pb-28">
      <TopBar title={topic} back right={<SubjectTag subject={subject} />} />
      <div className="flex flex-col gap-4 px-4">
        {/* Clubbed wrong questions */}
        {wrongQs.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--color-ink-soft)]">
              Your {wrongQs.length} mistake{wrongQs.length === 1 ? "" : "s"} here ❌
            </h2>
            <ul className="flex flex-col gap-2">
              {visibleQs.map((q) => (
                <li key={q.id} className="card p-3 text-sm">{q.text}</li>
              ))}
            </ul>
            {wrongQs.length > 3 && (
              <button onClick={() => setShowAllQs((s) => !s)} className="mt-2 text-xs font-bold text-[var(--color-violet)] underline underline-offset-2">
                {showAllQs ? "Show less" : `Show all ${wrongQs.length}`}
              </button>
            )}
          </div>
        )}

        {/* Tool switcher — nowrap chips in a scrollable row so labels never break mid-word */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {([
            ["concepts", "💡 Concepts"],
            ["flashcards", "🗂️ Flashcards"],
            ["mindmap", "🕸️ Mind map"],
          ] as [Tool, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTool(t)} className="chip shrink-0 whitespace-nowrap" data-on={tool === t}>{label}</button>
          ))}
        </div>

        {loading === tool ? (
          <div className="card animate-pulse p-6 text-center">
            <p className="text-3xl">{tool === "concepts" ? "💡" : tool === "flashcards" ? "🗂️" : "🕸️"}</p>
            <p className="mt-1 text-sm font-bold">
              {tool === "concepts" ? "Finding the concepts behind your mistakes…" : tool === "flashcards" ? "Writing your flashcards…" : "Drawing your mind map…"}
            </p>
          </div>
        ) : tool === "concepts" ? (
          <ConceptList items={concepts ?? []} />
        ) : tool === "flashcards" ? (
          <FlashcardDeck cards={cards ?? []} />
        ) : (
          <MindMap root={map} />
        )}

        {/* Mastery practice modes */}
        <div>
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--color-ink-soft)]">Mastery practice 🎯</h2>
          {/* The ladder as pills, not prose — a long sentence wraps with a dangling dash. */}
          <div className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.72rem] font-bold text-[var(--color-ink-soft)]">
            <span className="rounded-full bg-[var(--color-paper-2)] px-2.5 py-1">5 easy</span>
            <span aria-hidden>→</span>
            <span className="rounded-full bg-[var(--color-paper-2)] px-2.5 py-1">10 medium</span>
            <span aria-hidden>→</span>
            <span className="rounded-full bg-[var(--color-paper-2)] px-2.5 py-1">5 hard</span>
          </div>
          <p className="mb-2.5 text-xs leading-relaxed text-[var(--color-ink-soft)]">
            One wrong answer restarts the run. Clear all 20 to master it.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {/* Same anatomy as the home tiles: label left, emoji right, headline, caption. */}
            <Link href={`/revise/${encodeURIComponent(topic)}/practice?mode=timed`} className="block transition-transform active:scale-[0.98]">
              <div className="tile tile-orange flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <span className="text-[0.7rem] font-extrabold uppercase tracking-wider opacity-80">Timed</span>
                  <span className="text-xl leading-none">⏱</span>
                </div>
                <p className="font-display mt-1.5 text-xl font-bold leading-tight">JEE pace</p>
                <p className="mt-1 text-[0.72rem] font-semibold leading-snug opacity-75">48 min for 20 — same clock pressure as the real exam</p>
              </div>
            </Link>
            <Link href={`/revise/${encodeURIComponent(topic)}/practice?mode=zen`} className="block transition-transform active:scale-[0.98]">
              <div className="tile tile-purple flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <span className="text-[0.7rem] font-extrabold uppercase tracking-wider opacity-80">No timer</span>
                  <span className="text-xl leading-none">🧘</span>
                </div>
                <p className="font-display mt-1.5 text-xl font-bold leading-tight">Zen mode</p>
                <p className="mt-1 text-[0.72rem] font-semibold leading-snug opacity-75">Take your time — accuracy is all that counts</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function ConceptList({ items }: { items: ConceptItem[] }) {
  if (items.length === 0) return <p className="text-center text-sm text-[var(--color-ink-soft)]">Couldn&apos;t load concepts — pull down to retry.</p>;
  return (
    <ul className="stagger flex flex-col gap-2.5">
      {items.map((c, i) => (
        <li key={i} className="card p-4">
          <p className="font-extrabold">💡 {c.name}</p>
          <div className="mt-1.5 flex flex-col gap-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">
            {c.explanation.split("\n").filter(Boolean).map((line, li) => <p key={li}>{line}</p>)}
          </div>
        </li>
      ))}
    </ul>
  );
}

// Tap to flip, swipe-free prev/next — the NotebookLM flashcard loop.
function FlashcardDeck({ cards }: { cards: Flashcard[] }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (cards.length === 0) return <p className="text-center text-sm text-[var(--color-ink-soft)]">Couldn&apos;t load flashcards — pull down to retry.</p>;
  const card = cards[Math.min(i, cards.length - 1)];
  return (
    <div>
      <button
        onClick={() => setFlipped((f) => !f)}
        className="card flex min-h-44 w-full flex-col items-center justify-center gap-2 p-6 text-center"
        aria-label={flipped ? "Show question" : "Show answer"}
      >
        <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-[var(--color-ink-soft)]">
          {flipped ? "Answer" : "Card"} {i + 1}/{cards.length} · tap to flip
        </span>
        <span className={`text-[1.05rem] font-bold leading-snug ${flipped ? "text-[var(--color-violet-ink)]" : ""}`}>
          {flipped ? card.back : card.front}
        </span>
      </button>
      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => { setI((x) => Math.max(0, x - 1)); setFlipped(false); }} disabled={i === 0} className="btn btn-line !px-4 !py-2 text-sm disabled:opacity-40">← Prev</button>
        <span className="text-xs font-semibold tabular-nums text-[var(--color-ink-soft)]">{i + 1} / {cards.length}</span>
        <button onClick={() => { setI((x) => Math.min(cards.length - 1, x + 1)); setFlipped(false); }} disabled={i === cards.length - 1} className="btn btn-line !px-4 !py-2 text-sm disabled:opacity-40">Next →</button>
      </div>
    </div>
  );
}

// Collapsible tree — mind-map structure without a graph library.
function MindMap({ root }: { root: MindNode | null }) {
  if (!root) return <p className="text-center text-sm text-[var(--color-ink-soft)]">Couldn&apos;t load the mind map — pull down to retry.</p>;
  return (
    <div className="card p-4">
      <p className="mb-2 text-center text-base font-extrabold">🕸️ {root.label}</p>
      <ul className="flex flex-col gap-1.5">
        {(root.children ?? []).map((c, i) => <MindBranch key={i} node={c} depth={0} />)}
      </ul>
    </div>
  );
}

function MindBranch({ node, depth }: { node: MindNode; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  const kids = node.children ?? [];
  return (
    <li style={{ marginLeft: depth * 14 }}>
      <button
        onClick={() => kids.length && setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${depth === 0 ? "bg-[var(--color-violet-soft)] font-bold text-[var(--color-violet-ink)]" : "bg-[var(--color-paper-2)] font-medium"}`}
      >
        {kids.length > 0 && <span className="text-xs">{open ? "▾" : "▸"}</span>}
        <span className="min-w-0 flex-1">{node.label}</span>
      </button>
      {open && kids.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {kids.map((c, i) => <MindBranch key={i} node={c} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  );
}
