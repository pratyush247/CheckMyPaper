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
