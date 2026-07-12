import { describe, it, expect } from "vitest";
import { perfScore, eloUpdate } from "./rating";

describe("perfScore", () => {
  it("perfect fast game scores 100", () => {
    expect(perfScore({ correct: 10, total: 10, timeMs: 60_000 })).toBe(100);
  });
  it("zero correct scores near the speed floor only", () => {
    // 0 accuracy, 0 concept (defaults to accuracy), full speed → 30
    expect(perfScore({ correct: 0, total: 10, timeMs: 1_000 })).toBe(30);
  });
  it("slow play halves the speed factor", () => {
    // 10/10 in 2x expected time: 50 + 15 + 20 = 85
    expect(perfScore({ correct: 10, total: 10, timeMs: 1_200_000 })).toBe(85);
  });
  it("explicit concept factor overrides the accuracy default", () => {
    const withConcept = perfScore({ correct: 5, total: 10, timeMs: 600_000, concept: 1 });
    const without = perfScore({ correct: 5, total: 10, timeMs: 600_000 });
    expect(withConcept).toBeGreaterThan(without);
  });
  it("empty quiz scores 0", () => {
    expect(perfScore({ correct: 0, total: 0, timeMs: 1000 })).toBe(0);
  });
});

describe("eloUpdate", () => {
  it("winner gains, loser drops, equal ratings move symmetrically", () => {
    const next = eloUpdate([
      { phone: "a", rating: 1000, perf: 90 },
      { phone: "b", rating: 1000, perf: 40 },
    ]);
    expect(next.get("a")).toBe(1016);
    expect(next.get("b")).toBe(984);
  });
  it("upset against a stronger player pays more", () => {
    const next = eloUpdate([
      { phone: "weak", rating: 900, perf: 90 },
      { phone: "strong", rating: 1200, perf: 40 },
    ]);
    expect(next.get("weak")! - 900).toBeGreaterThan(16);
  });
  it("multi-player lobby stays roughly zero-sum", () => {
    const players = [
      { phone: "a", rating: 1000, perf: 90 },
      { phone: "b", rating: 1000, perf: 60 },
      { phone: "c", rating: 1000, perf: 30 },
    ];
    const next = eloUpdate(players);
    const sum = [...next.values()].reduce((s, r) => s + r, 0);
    expect(Math.abs(sum - 3000)).toBeLessThanOrEqual(2); // rounding only
    expect(next.get("a")!).toBeGreaterThan(next.get("c")!);
  });
  it("solo battle changes nothing", () => {
    expect(eloUpdate([{ phone: "a", rating: 1000, perf: 100 }]).get("a")).toBe(1000);
  });
});
