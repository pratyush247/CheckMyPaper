// Battle Mode helpers. The leaderboard is locally simulated for now (seeded
// "rivals" + your own result) so the competitive, time-based UX is real and
// testable; it swaps to real friends once the Supabase backend is wired.

export const PASS_MARK = 7; // out of 10 to clear a stage
export const QUIZ_SIZE = 10;

const RIVAL_NAMES = [
  "Aarav", "Diya", "Vivaan", "Ananya", "Reyansh", "Ishaan", "Saanvi",
  "Kabir", "Myra", "Arjun", "Aditya", "Kiara", "Aryan", "Navya",
];

export interface Racer {
  name: string;
  score: number; // out of 10
  timeMs: number;
  you?: boolean;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic rivals for a topic, so a stage's leaderboard feels consistent.
export function seededRivals(topic: string, n = 7): Racer[] {
  let seed = hash(topic) || 1;
  const rand = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const used = new Set<number>();
  const out: Racer[] = [];
  for (let i = 0; i < n; i++) {
    let idx = Math.floor(rand() * RIVAL_NAMES.length);
    while (used.has(idx) && used.size < RIVAL_NAMES.length) idx = Math.floor(rand() * RIVAL_NAMES.length);
    used.add(idx);
    out.push({
      name: RIVAL_NAMES[idx],
      score: Math.min(10, 6 + Math.floor(rand() * 5)), // 6..10
      timeMs: Math.floor((50 + rand() * 120) * 1000), // 50s..170s
    });
  }
  return out;
}

// Rank: higher score first, then faster time.
export function buildLeaderboard(topic: string, you: { score: number; timeMs: number }): Racer[] {
  return [...seededRivals(topic), { name: "You", you: true, ...you }].sort(
    (a, b) => b.score - a.score || a.timeMs - b.timeMs,
  );
}

export function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
