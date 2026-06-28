"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui";
import { createPaper } from "@/lib/store";
import type { ExtractedQuestion } from "@/lib/sampleData";

function defaultName() {
  const d = new Date();
  return `Mock test · ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

export default function NewPaperPage() {
  const router = useRouter();
  const [name, setName] = useState(defaultName());
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function extract(useSample: boolean) {
    setBusy(true);
    setError("");
    setStage(useSample ? "Loading a sample paper…" : "Reading your paper…");
    try {
      const form = new FormData();
      if (!useSample) files.forEach((f) => form.append("files", f));
      const res = await fetch("/api/extract", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).error || "Extraction failed");
      const { questions } = (await res.json()) as { questions: ExtractedQuestion[] };
      if (!questions?.length) throw new Error("No questions found. Try a clearer photo or a PDF.");
      setStage("Sorting questions by topic…");
      const paper = createPaper(name, questions);
      router.push(`/papers/${paper.id}/triage`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-5xl">🔍</div>
        <p className="text-lg font-bold">{stage}</p>
        <p className="text-sm text-[var(--color-ink-soft)]">This takes a few seconds.</p>
        <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-[var(--color-paper-2)]">
          <div className="h-full w-1/2 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-[var(--color-violet)]" />
        </div>
        <style>{`@keyframes loading{0%{margin-left:-50%}100%{margin-left:100%}}`}</style>
      </main>
    );
  }

  return (
    <main className="pb-10">
      <TopBar title="Add a paper" back="/" />
      <div className="flex flex-col gap-5 px-4 pt-2">
        <div>
          <label className="mb-1.5 block text-sm font-bold">Name this test</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3 font-medium outline-none focus:border-[var(--color-violet)]"
            placeholder="e.g. Allen Test Series #4"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-bold">Add the question paper</label>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="card flex w-full flex-col items-center gap-2 border-dashed py-9"
          >
            <span className="text-3xl">📷</span>
            <span className="font-bold">Take photos or upload PDF</span>
            <span className="text-xs text-[var(--color-ink-soft)]">
              Snap each page, or pick the PDF your coaching shared
            </span>
          </button>

          {files.length > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--color-paper-2)] px-4 py-2.5 text-sm">
              <span className="font-semibold">
                {files.length} file{files.length === 1 ? "" : "s"} selected
              </span>
              <button onClick={() => setFiles([])} className="font-semibold text-[var(--color-violet)]">
                Clear
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-[var(--color-bad-soft)] px-4 py-3 text-sm font-medium text-[var(--color-bad)]">
            {error}
          </p>
        )}

        <button
          disabled={files.length === 0}
          onClick={() => extract(false)}
          className="btn btn-primary w-full text-base"
        >
          Read my paper
        </button>

        <button onClick={() => extract(true)} className="text-sm font-semibold text-[var(--color-violet)]">
          No paper handy? Try with a sample →
        </button>
      </div>
    </main>
  );
}
