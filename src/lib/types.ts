// Core domain types for CheckMyPaper.
// The "memory architecture" from the PRD maps onto these:
//   - Paper + Question + Attempt  => episodic store (the spine)
//   - LearnerProfile              => distilled memory (the fingerprint)
// (Vector/RAG layer is a later version and not modelled here yet.)

// The signed-in student. Local-only for now (no real OTP yet); maps to the
// Supabase auth user + a profile row when cloud sync is switched on.
export interface Account {
  name: string;
  phone: string; // 10-digit Indian mobile, digits only
  createdAt: number;
}

export type Subject = "Physics" | "Chemistry" | "Maths" | "Unknown";

// What the student did with a question. "correct" questions are kept implicit
// (untapped during triage) and not stored individually.
export type QuestionState = "wrong" | "guessed" | "skipped";

// The student-facing error taxonomy. Stored on each diagnosed attempt.
// Kept in plain language deliberately — see errorTags.ts for labels/emoji.
export type ErrorTag =
  | "concept" // didn't know the concept
  | "calc_slip" // silly calculation slip
  | "misread" // read the question wrong
  | "wrong_method" // picked the wrong method
  | "time" // ran out of time
  | "second_guess"; // changed a correct answer

// Lighter reasons for skipped questions (no narration required).
export type SkipReason = "skip_time" | "skip_unknown";

export interface Question {
  id: string;
  paperId: string;
  number: number; // question number on the paper (1-based, best effort)
  text: string; // extracted question text
  subject: Subject;
  topic: string; // e.g. "Rotational Motion"
  subtopic?: string; // e.g. "Moment of Inertia"
  // Triage state. undefined => student marked it fine (correct) / not yet triaged.
  state?: QuestionState;
}

export interface Attempt {
  id: string;
  questionId: string;
  paperId: string;
  state: QuestionState;
  transcript?: string; // what the student said (or typed)
  selfTag?: ErrorTag; // chip the student tapped
  aiTag?: ErrorTag; // tag the AI confirmed/refined to
  aiConfidence?: number; // 0..1
  aiNote?: string; // one short line of feedback
  skipReason?: SkipReason; // only for skipped questions
  createdAt: number;
}

export interface Paper {
  id: string;
  name: string; // e.g. "Allen Test Series #4"
  createdAt: number;
  status: "extracting" | "triage" | "narrating" | "done";
  questionCount: number;
  // Per-paper insight, generated once narration is complete.
  insight?: PaperInsight;
}

export interface PaperInsight {
  headline: string; // the one honest sentence
  light: "green" | "amber" | "red"; // traffic-light mood
  advice: string; // one piece of advice
  breakdown: { tag: ErrorTag; count: number }[];
  weakestTopic?: string;
  generatedAt: number;
}

// The distilled "fingerprint" — recomputed after each paper.
export interface LearnerProfile {
  papersLogged: number;
  totalDiagnosed: number;
  // error tag -> count across all papers
  tagTotals: Partial<Record<ErrorTag, number>>;
  // topic -> { wrong count, papers seen in } for mastery + recurrence
  topicTrouble: Record<string, { count: number; papers: string[] }>;
  // newest first: { paperId, name, dominantTag, share } for trend
  history: {
    paperId: string;
    name: string;
    createdAt: number;
    dominantTag?: ErrorTag;
    dominantShare?: number; // 0..1
    diagnosed: number;
  }[];
  updatedAt: number;
}
