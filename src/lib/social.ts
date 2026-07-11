// Pure social logic — no I/O, unit-tested. Shared by /api/social routes.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

// The two phones sorted ascending — a stable key for the A↔B pair so a
// friendship / thread is one row regardless of who initiated.
export function canonicalPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

// 3–20 chars, starts with a letter, then letters/digits/underscore.
export function isValidHandle(h: string): boolean {
  return /^[a-z][a-z0-9_]{2,19}$/.test(h);
}

export function genInviteCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
}

export interface TopicRef { topic: string; subject: string }

// Topics both players are weak at (matched case-insensitively by name), in the
// first player's order. Drives the "challenge on a shared weak topic" flow.
export function commonWeakTopics(a: TopicRef[], b: TopicRef[]): TopicRef[] {
  const bKeys = new Set(b.map((t) => t.topic.trim().toLowerCase()));
  const seen = new Set<string>();
  const out: TopicRef[] = [];
  for (const t of a) {
    const k = t.topic.trim().toLowerCase();
    if (k && bKeys.has(k) && !seen.has(k)) { seen.add(k); out.push(t); }
  }
  return out;
}

// Subjects shared across both players' weak areas — the fallback vote options
// when there is no exact common topic.
export function commonSubjects(a: TopicRef[], b: TopicRef[]): string[] {
  const bSubs = new Set(b.map((t) => t.subject));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of a) {
    if (bSubs.has(t.subject) && t.subject !== "Unknown" && !seen.has(t.subject)) { seen.add(t.subject); out.push(t.subject); }
  }
  return out;
}

// ---- Challenge topic vote --------------------------------------------------

export interface VoteOption { id: string; topic: string; subject: string }

// Everyone has cast a vote → the vote can be resolved.
export function allVoted(participants: string[], votes: Record<string, string>): boolean {
  return participants.length > 0 && participants.every((p) => Boolean(votes[p]));
}

// Winner = the option with the most votes. Ties break to the option listed
// first (creator's / common-topic order) — deterministic, so two friends who
// disagree get a predictable pick instead of a coin flip.
export function resolveVote(options: VoteOption[], votes: Record<string, string>): VoteOption | null {
  if (options.length === 0) return null;
  const counts = new Map<string, number>();
  for (const optId of Object.values(votes)) counts.set(optId, (counts.get(optId) ?? 0) + 1);
  let best: VoteOption | null = null;
  let bestCount = -1;
  for (const o of options) {
    const c = counts.get(o.id) ?? 0;
    if (c > bestCount) { best = o; bestCount = c; }
  }
  return best;
}

export interface ChallengeScore {
  phone: string;
  score: number;
  timeMs: number;
}
export interface RankedScore extends ChallengeScore {
  rank: number;
  winner: boolean;
}

// Rank by score desc, then time asc. `winner` is true only for a sole leader
// (a tie on both score and time means no winner).
export function rankChallenge(scores: ChallengeScore[]): RankedScore[] {
  const sorted = [...scores].sort((x, y) => y.score - x.score || x.timeMs - y.timeMs);
  const ranked = sorted.map((s, i) => ({ ...s, rank: i + 1, winner: false }));
  if (ranked.length > 0) {
    const top = ranked[0];
    const tiedTop = ranked.filter((r) => r.score === top.score && r.timeMs === top.timeMs);
    if (tiedTop.length === 1) ranked[0].winner = true;
  }
  return ranked;
}

// Block direction from a friendship row, from `me`'s perspective.
export function blockState(
  f: { status: string; blocked_by: string | null } | null,
  me: string,
): "none" | "blocked_by_me" | "blocked_me" {
  if (!f || f.status !== "blocked") return "none";
  return f.blocked_by === me ? "blocked_by_me" : "blocked_me";
}
