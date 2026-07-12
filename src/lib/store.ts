"use client";

import type {
  Account,
  Attempt,
  ErrorTag,
  LearnerProfile,
  Paper,
  PaperInsight,
  Question,
  Subject,
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
  battle: "cmp.battle",
  battleReviews: "cmp.battleReviews",
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

export function saveAccount(name: string, phone: string, extra?: { klass?: string; weakSubject?: Subject }): Account {
  const prev = getAccount();
  const account: Account = {
    name: name.trim(),
    phone: phone.replace(/\D/g, ""),
    klass: extra?.klass ?? prev?.klass,
    weakSubject: extra?.weakSubject ?? prev?.weakSubject,
    createdAt: prev?.createdAt ?? Date.now(),
  };
  write(KEYS.account, account);
  return account;
}

export function clearAccount() {
  write(KEYS.account, null);
}

// Dev-only: drop a seeded paper with wrong answers across a few topics so
// getWeakTopics() / battle / challenges have data without grinding a real paper.
export function seedDemoData() {
  const paperId = uid();
  const topics: [string, Subject][] = [
    ["Rotational Motion", "Physics"],
    ["Electrostatics", "Physics"],
    ["Thermodynamics", "Chemistry"],
    ["Probability", "Maths"],
  ];
  const questions: Question[] = [];
  const attempts: Attempt[] = [];
  topics.forEach(([topic, subject], i) => {
    const qid = uid();
    questions.push({ id: qid, paperId, number: i + 1, text: `Sample ${topic} question`, subject, topic, state: "wrong" });
    attempts.push({ id: uid(), questionId: qid, paperId, state: i % 2 ? "guessed" : "wrong", selfTag: "concept", createdAt: Date.now() });
  });
  const paper: Paper = { id: paperId, name: "Demo Mock (seeded)", createdAt: Date.now(), status: "done", questionCount: questions.length };
  write(KEYS.papers, [...read<Paper[]>(KEYS.papers, []), paper]);
  write(KEYS.questions, [...read<Question[]>(KEYS.questions, []), ...questions]);
  write(KEYS.attempts, [...read<Attempt[]>(KEYS.attempts, []), ...attempts]);
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

// ---- Battle Mode -----------------------------------------------------------

export interface WeakTopic {
  topic: string;
  subject: Subject;
  wrongCount: number;
  papers: number;
}

// Weak topics = topics where the student got questions wrong/guessed, ranked.
export function getWeakTopics(): WeakTopic[] {
  const questions = read<Question[]>(KEYS.questions, []);
  const attempts = read<Attempt[]>(KEYS.attempts, []).filter(
    (a) => a.state === "wrong" || a.state === "guessed",
  );
  const map = new Map<string, { subjectCounts: Record<string, number>; wrong: number; papers: Set<string> }>();
  for (const a of attempts) {
    const q = questions.find((x) => x.id === a.questionId);
    if (!q) continue;
    const e = map.get(q.topic) ?? { subjectCounts: {}, wrong: 0, papers: new Set<string>() };
    e.wrong += 1;
    e.papers.add(a.paperId);
    e.subjectCounts[q.subject] = (e.subjectCounts[q.subject] || 0) + 1;
    map.set(q.topic, e);
  }
  return [...map.entries()]
    .map(([topic, e]) => ({
      topic,
      subject: (Object.entries(e.subjectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as Subject) || "Unknown",
      wrongCount: e.wrong,
      papers: e.papers.size,
    }))
    .sort((a, b) => b.wrongCount - a.wrongCount);
}

export function getWrongQuestionsForTopic(topic: string): Question[] {
  const wrongIds = new Set(
    read<Attempt[]>(KEYS.attempts, [])
      .filter((a) => a.state === "wrong" || a.state === "guessed")
      .map((a) => a.questionId),
  );
  return read<Question[]>(KEYS.questions, []).filter((q) => q.topic === topic && wrongIds.has(q.id));
}

export interface BattleResult {
  bestScore: number;
  bestTimeMs?: number; // best time among PASSED attempts
  clearedAt?: number;
  attempts: number;
}

// All diagnosed mistakes across papers, shaped for the tutor's RAG sync.
export interface MistakeRecord {
  sourceId: string;
  questionText: string;
  transcript?: string;
  topic: string;
  subject: Subject;
  errorTag?: string;
}

export function getAllMistakes(): MistakeRecord[] {
  const questions = read<Question[]>(KEYS.questions, []);
  const attempts = read<Attempt[]>(KEYS.attempts, []);
  const out: MistakeRecord[] = [];
  for (const a of attempts) {
    const tag = a.aiTag || a.selfTag;
    if (!tag) continue; // only diagnosed mistakes
    const q = questions.find((x) => x.id === a.questionId);
    if (!q) continue;
    out.push({
      sourceId: a.id,
      questionText: q.text,
      transcript: a.transcript,
      topic: q.topic,
      subject: q.subject,
      errorTag: tag,
    });
  }
  return out;
}

// ---- Battle review (light post-battle review, feeds the same memory) --------

export interface BattleReviewItem {
  q: string;
  options: string[];
  myPick: number;
  answer: number;
  explanation: string;
  tag?: ErrorTag;
}
export interface BattleReview {
  id: string; // challengeId
  topic: string;
  subject: Subject;
  createdAt: number;
  done: boolean;
  items: BattleReviewItem[]; // only the questions I got wrong
}

export function getBattleReviews(): BattleReview[] {
  return Object.values(read<Record<string, BattleReview>>(KEYS.battleReviews, {}));
}
export function getBattleReview(id: string): BattleReview | undefined {
  return read<Record<string, BattleReview>>(KEYS.battleReviews, {})[id];
}
export function getPendingBattleReviews(): BattleReview[] {
  return getBattleReviews().filter((r) => !r.done && r.items.length > 0).sort((a, b) => b.createdAt - a.createdAt);
}

// Called right after a battle finishes. A perfect score has nothing to review
// and is stored done, so the home card stays hidden.
export function savePendingBattleReview(review: Omit<BattleReview, "createdAt" | "done">) {
  const all = read<Record<string, BattleReview>>(KEYS.battleReviews, {});
  if (all[review.id]) return; // replaying results must not resurrect a done review
  all[review.id] = { ...review, createdAt: Date.now(), done: review.items.length === 0 };
  write(KEYS.battleReviews, all);
}

// Finish a review: the tagged mistakes become regular paper/question/attempt
// records, so weak topics, progress trends, and the coach's memory all learn
// from battles exactly like they learn from mock papers.
export function completeBattleReview(id: string, tags: (ErrorTag | undefined)[]) {
  const all = read<Record<string, BattleReview>>(KEYS.battleReviews, {});
  const review = all[id];
  if (!review || review.done) return;

  const paperId = uid();
  const questions: Question[] = [];
  const attempts: Attempt[] = [];
  review.items.forEach((item, i) => {
    const qid = uid();
    questions.push({
      id: qid, paperId, number: i + 1,
      text: item.q, subject: review.subject, topic: review.topic, state: "wrong",
    });
    attempts.push({
      id: uid(), questionId: qid, paperId, state: "wrong",
      selfTag: tags[i] ?? "concept",
      transcript: `Battle answer: picked "${item.options[item.myPick] ?? "?"}", correct was "${item.options[item.answer] ?? "?"}".`,
      createdAt: Date.now(),
    });
  });
  const paper: Paper = { id: paperId, name: `⚔️ Battle: ${review.topic}`, createdAt: Date.now(), status: "done", questionCount: review.items.length };
  write(KEYS.papers, [...read<Paper[]>(KEYS.papers, []), paper]);
  write(KEYS.questions, [...read<Question[]>(KEYS.questions, []), ...questions]);
  write(KEYS.attempts, [...read<Attempt[]>(KEYS.attempts, []), ...attempts]);

  review.done = true;
  review.items = review.items.map((it, i) => ({ ...it, tag: tags[i] ?? it.tag }));
  write(KEYS.battleReviews, all);
}

// Skip-forever escape hatch (a done review disappears from the home card).
export function dismissBattleReview(id: string) {
  const all = read<Record<string, BattleReview>>(KEYS.battleReviews, {});
  if (all[id]) { all[id].done = true; write(KEYS.battleReviews, all); }
}

export function getBattleProgress(): Record<string, BattleResult> {
  return read<Record<string, BattleResult>>(KEYS.battle, {});
}

export function recordBattleResult(topic: string, score: number, timeMs: number, passed: boolean) {
  const all = getBattleProgress();
  const prev = all[topic] ?? { bestScore: 0, attempts: 0 };
  all[topic] = {
    bestScore: Math.max(prev.bestScore, score),
    bestTimeMs: passed ? Math.min(prev.bestTimeMs ?? timeMs, timeMs) : prev.bestTimeMs,
    clearedAt: prev.clearedAt ?? (passed ? Date.now() : undefined),
    attempts: prev.attempts + 1,
  };
  write(KEYS.battle, all);
}
