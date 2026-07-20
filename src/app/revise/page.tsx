"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar, AppLoading, SubjectTag } from "@/components/ui";
import { getAccount, getWeakTopics } from "@/lib/store";
import { useMounted } from "@/lib/useStore";
import { SYLLABUS, type CoreSubject } from "@/lib/syllabus";
import type { Subject } from "@/lib/types";

const SUBJECTS = Object.keys(SYLLABUS) as CoreSubject[];
type KlassFilter = "Class 11" | "Class 12" | "All";

// Revise home: your weak areas first (mistake-driven), then the full JEE
// syllabus — any chapter or subtopic opens the same revise hub.
export default function ReviseIndexPage() {
  const router = useRouter();
  const mounted = useMounted();
  const weak = useMemo(() => (mounted ? getWeakTopics().slice(0, 5) : []), [mounted]);

  const account = mounted ? getAccount() : null;
  const [subject, setSubject] = useState<CoreSubject | null>(null);
  const [klass, setKlass] = useState<KlassFilter | null>(null);
  const [open, setOpen] = useState<string | null>(null); // expanded chapter name

  if (!mounted) return <AppLoading />;

  // Defaults from the profile, applied once we know it (state wins after a tap).
  const activeSubject: CoreSubject =
    subject ?? (SUBJECTS.includes(account?.weakSubject as CoreSubject) ? (account?.weakSubject as CoreSubject) : "Physics");
  const activeKlass: KlassFilter =
    klass ?? (account?.klass === "Class 11" || account?.klass === "Class 12" ? account.klass : "All");

  const chapters = SYLLABUS[activeSubject].filter((t) => activeKlass === "All" || t.klass === activeKlass);
  const go = (name: string) => router.push(`/revise/${encodeURIComponent(name)}`);

  return (
    <main className="pb-28">
      <TopBar title="Revise" back />
      <div className="flex flex-col gap-5 px-4">
        {/* Suggested — from the student's own mistakes */}
        <div>
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--color-ink-soft)]">
            Suggested for you 🎯
          </h2>
          {weak.length === 0 ? (
            <p className="card p-4 text-sm text-[var(--color-ink-soft)]">
              Review a paper and your weak areas land here automatically. Meanwhile, pick anything from the syllabus below.
            </p>
          ) : (
            <ul className="stagger flex flex-col gap-2">
              {weak.map((w) => (
                <li key={w.topic}>
                  <button onClick={() => go(w.topic)} className="card flex w-full items-center gap-3 p-3.5 text-left transition-transform active:scale-[0.98]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{w.topic}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                        {w.wrongCount} mistake{w.wrongCount === 1 ? "" : "s"} · {w.papers} paper{w.papers === 1 ? "" : "s"}
                      </p>
                    </div>
                    <SubjectTag subject={w.subject as Subject} />
                    <span className="text-[var(--color-ink-soft)]">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Browse — the full JEE syllabus */}
        <div>
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[var(--color-ink-soft)]">
            Browse the syllabus 📖
          </h2>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {SUBJECTS.map((s) => (
              <button key={s} onClick={() => { setSubject(s); setOpen(null); }} className="chip shrink-0 whitespace-nowrap" data-on={activeSubject === s}>{s}</button>
            ))}
          </div>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {(["Class 11", "Class 12", "All"] as KlassFilter[]).map((k) => (
              <button key={k} onClick={() => { setKlass(k); setOpen(null); }} className="chip shrink-0 whitespace-nowrap text-xs" data-on={activeKlass === k}>{k}</button>
            ))}
          </div>

          <ul className="mt-3 flex flex-col gap-2">
            {chapters.map((c) => {
              const expanded = open === c.name;
              return (
                <li key={c.name} className="card overflow-hidden p-0">
                  <button
                    onClick={() => setOpen(expanded ? null : c.name)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.95rem] font-bold">{c.name}</p>
                      <p className="mt-0.5 text-[0.7rem] font-semibold text-[var(--color-ink-soft)]">
                        {c.klass} · {"●".repeat(c.difficulty)}{"○".repeat(3 - c.difficulty)} · {c.sub.length} subtopics
                      </p>
                    </div>
                    <span className="text-xs text-[var(--color-ink-soft)]">{expanded ? "▾" : "▸"}</span>
                  </button>
                  {expanded && (
                    <div className="flex flex-wrap gap-2 px-4 pb-3.5">
                      <button onClick={() => go(c.name)} className="chip whitespace-nowrap" data-on>
                        📖 Full chapter
                      </button>
                      {c.sub.map((s) => (
                        <button key={s} onClick={() => go(s)} className="chip whitespace-nowrap">{s}</button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </main>
  );
}
