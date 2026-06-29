"use client";

import type {
  Account,
  Attempt,
  ErrorTag,
  LearnerProfile,
  Paper,
  PaperInsight,
  Question,
} from "./types";
import type { ExtractedQuestion } from "./sampleData";

// Local-first store. Source of truth for the MVP lives in localStorage on the
// device (matches the PRD's "device caches the student's data" principle).
// A Supabase sync layer can later mirror these records to the cloud.

const KEYS = {
  papers: "cmp.papers",
  questions: "cmp.questions",
  attempts: "cmp.attempts",
  account: "cmp.account",
} as const;

const isBrowser = () => typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("cmp-store-change"));
}

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ---- Account ---------------------------------------------------------------

export function getAccount(): Account | null {
  return read<Account | null>(KEYS.account, null);
}

export function saveAccount(name: string, phone: string): Account {
  const account: Account = { name: name.trim(), phone: phone.replace(/\D/g, ""), createdAt: Date.now() };
  write(KEYS.account, account);
  return account;
}

export function clearAccount() {
  write(KEYS.account, null);
}

// ---- Papers ----------------------------------------------------------------

export function getPapers(): Paper[] {
  return read<Paper[]>(KEYS.papers, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function getPaper(id: string): Paper | undefined {
  return read<Paper[]>(KEYS.papers, []).find((p) => p.id === id);
}

export function createPaper(name: string, extracted: ExtractedQuestion[]): Paper {
  const papers = read<Paper[]>(KEYS.papers, []);
  const paperId = uid();
  const paper: Paper = {
    id: paperId,
    name: name.trim() || "Untitled paper",
    createdAt: Date.now(),
    status: "triage",
    questionCount: extracted.length,
  };
  write(KEYS.papers, [...papers, paper]);

  const questions = read<Question[]>(KEYS.questions, []);
  const newQuestions: Question[] = extracted.map((q) => ({
    id: uid(),
    paperId,
    number: q.number,
    text: q.text,
    subject: q.subject,
    topic: q.topic,
    subtopic: q.subtopic,
  }));
  write(KEYS.questions, [...questions, ...newQuestions]);
  return paper;
}

export function updatePaper(id: string, patch: Partial<Paper>) {
  const papers = read<Paper[]>(KEYS.papers, []);
  write(
    KEYS.papers,
    papers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  );
}

export function deletePaper(id: string) {
  write(KEYS.papers, read<Paper[]>(KEYS.papers, []).filter((p) => p.id !== id));
  write(KEYS.questions, read<Question[]>(KEYS.questions, []).filter((q) => q.paperId !== id));
  write(KEYS.attempts, read<Attempt[]>(KEYS.attempts, []).filter((a) => a.paperId !== id));
}

// ---- Questions -------------------------------------------------------------

export function getQuestions(paperId: string): Question[] {
  return read<Question[]>(KEYS.questions, [])
    .filter((q) => q.paperId === paperId)
    .sort((a, b) => a.number - b.number);
}

export function getQuestion(id: string): Question | undefined {
  return read<Question[]>(KEYS.questions, []).find((q) => q.id === id);
}

export function updateQuestion(id: string, patch: Partial<Question>) {
  const questions = read<Question[]>(KEYS.questions, []);
  write(
    KEYS.questions,
    questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
  );
}

// ---- Attempts --------------------------------------------------------------

export function getAttempts(paperId: string): Attempt[] {
  return read<Attempt[]>(KEYS.attempts, []).filter((a) => a.paperId === paperId);
}

export function getAttemptForQuestion(questionId: string): Attempt | undefined {
  return read<Attempt[]>(KEYS.attempts, []).find((a) => a.questionId === questionId);
}

export function saveAttempt(attempt: Attempt) {
  const attempts = read<Attempt[]>(KEYS.attempts, []);
  const existing = attempts.findIndex((a) => a.questionId === attempt.questionId);
  if (existing >= 0) {
    attempts[existing] = attempt;
    write(KEYS.attempts, [...attempts]);
  } else {
    write(KEYS.attempts, [...attempts, attempt]);
  }
}

function allAttempts(): Attempt[] {
  return read<Attempt[]>(KEYS.attempts, []);
}

// ---- Learner profile (the distilled "fingerprint") -------------------------

// Computed on demand from papers + attempts so it never drifts out of sync.
export function computeProfile(): LearnerProfile {
  const papers = read<Paper[]>(KEYS.papers, []);
  const questions = read<Question[]>(KEYS.questions, []);
  const attempts = allAttempts();

  const tagTotals: Partial<Record<ErrorTag, number>> = {};
  const topicTrouble: LearnerProfile["topicTrouble"] = {};

  const diagnosed = attempts.filter((a) => a.aiTag || a.selfTag);
  for (const a of diagnosed) {
    const tag = (a.aiTag || a.selfTag) as ErrorTag;
    tagTotals[tag] = (tagTotals[tag] || 0) + 1;
    const q = questions.find((x) => x.id === a.questionId);
    if (q) {
      const t = (topicTrouble[q.topic] ||= { count: 0, papers: [] });
      t.count += 1;
      if (!t.papers.includes(a.paperId)) t.papers.push(a.paperId);
    }
  }

  // Per-paper dominant tag, newest first.
  const history = papers
    .map((p) => {
      const pa = diagnosed.filter((a) => a.paperId === p.id);
      const counts: Partial<Record<ErrorTag, number>> = {};
      for (const a of pa) {
        const tag = (a.aiTag || a.selfTag) as ErrorTag;
        counts[tag] = (counts[tag] || 0) + 1;
      }
      let dominantTag: ErrorTag | undefined;
      let max = 0;
      for (const [tag, n] of Object.entries(counts)) {
        if (n! > max) {
          max = n!;
          dominantTag = tag as ErrorTag;
        }
      }
      return {
        paperId: p.id,
        name: p.name,
        createdAt: p.createdAt,
        dominantTag,
        dominantShare: pa.length ? max / pa.length : undefined,
        diagnosed: pa.length,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    papersLogged: papers.filter((p) => p.status === "done").length,
    totalDiagnosed: diagnosed.length,
    tagTotals,
    topicTrouble,
    history,
    updatedAt: Date.now(),
  };
}

export function setPaperInsight(paperId: string, insight: PaperInsight) {
  updatePaper(paperId, { insight, status: "done" });
}
