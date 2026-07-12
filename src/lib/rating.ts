// Battle performance + rating math. Pure functions — used server-side after
// every battle and unit-tested in rating.test.ts.

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Per-battle performance score 0–100:
//   50% accuracy · 30% speed · 20% concept-understanding.
// Speed compares against a 60s/question baseline. Concept comes from the
// post-battle review (share of errors that were NOT concept gaps); when no
// review data is available it defaults to accuracy, i.e. neutral.
// ponytail: concept is accuracy server-side for now — review tags live on the
// device; wire them into rating when the review sync lands.
export function perfScore(p: {
  correct: number;
  total: number;
  timeMs: number;
  concept?: number; // 0..1, optional
}): number {
  if (p.total <= 0) return 0;
  const accuracy = clamp01(p.correct / p.total);
  const expectedMs = p.total * 60_000;
  const speed = clamp01(expectedMs / Math.max(p.timeMs, 1));
  const concept = p.concept === undefined ? accuracy : clamp01(p.concept);
  return Math.round(100 * (0.5 * accuracy + 0.3 * speed + 0.2 * concept));
}

// Elo-lite over a multi-player battle: every pair is a mini-match decided by
// perf score; K is split across opponents so lobby size doesn't inflate swings.
export function eloUpdate(
  players: { phone: string; rating: number; perf: number }[],
  K = 32,
): Map<string, number> {
  const out = new Map(players.map((p) => [p.phone, p.rating]));
  if (players.length < 2) return out;
  const share = K / (players.length - 1);
  for (let i = 0; i < players.length; i++) {
    let delta = 0;
    for (let j = 0; j < players.length; j++) {
      if (i === j) continue;
      const a = players[i];
      const b = players[j];
      const actual = a.perf > b.perf ? 1 : a.perf < b.perf ? 0 : 0.5;
      const expected = 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400));
      delta += share * (actual - expected);
    }
    out.set(players[i].phone, Math.round(players[i].rating + delta));
  }
  return out;
}
