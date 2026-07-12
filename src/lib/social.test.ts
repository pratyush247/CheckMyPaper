import { describe, it, expect } from "vitest";
import { canonicalPair, normalizeHandle, isValidHandle, genInviteCode, rankChallenge, blockState, commonWeakTopics } from "./social";
import { pickChallengeTopic, sharedClass, difficultyTier, SYLLABUS } from "./syllabus";

describe("canonicalPair", () => {
  it("orders the same regardless of argument order", () => {
    expect(canonicalPair("9000000002", "9000000001")).toEqual(["9000000001", "9000000002"]);
    expect(canonicalPair("9000000001", "9000000002")).toEqual(["9000000001", "9000000002"]);
  });
});

describe("normalizeHandle / isValidHandle", () => {
  it("normalizes case and @", () => expect(normalizeHandle("  @Arjun_JEE ")).toBe("arjun_jee"));
  it("accepts valid handles", () => expect(isValidHandle("arjun_jee")).toBe(true));
  it("rejects too short, bad chars, leading digit", () => {
    expect(isValidHandle("ab")).toBe(false);
    expect(isValidHandle("bad handle")).toBe(false);
    expect(isValidHandle("1arjun")).toBe(false);
  });
});

describe("genInviteCode", () => {
  it("is 6 chars from the unambiguous alphabet", () => {
    const c = genInviteCode();
    expect(c).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
});

describe("rankChallenge", () => {
  it("ranks by score desc then time asc, marks sole winner", () => {
    const r = rankChallenge([
      { phone: "a", score: 8, timeMs: 5000 },
      { phone: "b", score: 8, timeMs: 4000 },
      { phone: "c", score: 6, timeMs: 3000 },
    ]);
    expect(r.map((x) => x.phone)).toEqual(["b", "a", "c"]);
    expect(r[0]).toMatchObject({ rank: 1, winner: true });
    expect(r[1].rank).toBe(2);
  });
  it("no winner on a tie for first (same score+time)", () => {
    const r = rankChallenge([
      { phone: "a", score: 8, timeMs: 4000 },
      { phone: "b", score: 8, timeMs: 4000 },
    ]);
    expect(r[0].winner).toBe(false);
    expect(r[1].winner).toBe(false);
  });
});

describe("blockState", () => {
  it("reads block direction", () => {
    expect(blockState(null, "a")).toBe("none");
    expect(blockState({ status: "accepted", blocked_by: null }, "a")).toBe("none");
    expect(blockState({ status: "blocked", blocked_by: "a" }, "a")).toBe("blocked_by_me");
    expect(blockState({ status: "blocked", blocked_by: "b" }, "a")).toBe("blocked_me");
  });
});

describe("commonWeakTopics", () => {
  const a = [{ topic: "Rotational Motion", subject: "Physics" }, { topic: "Electrostatics", subject: "Physics" }];
  it("intersects by topic name, case-insensitive, in a's order", () => {
    const b = [{ topic: "electrostatics", subject: "Physics" }, { topic: "Kinematics", subject: "Physics" }];
    expect(commonWeakTopics(a, b)).toEqual([{ topic: "Electrostatics", subject: "Physics" }]);
  });
  it("empty when nothing overlaps", () => {
    expect(commonWeakTopics(a, [{ topic: "Thermodynamics", subject: "Physics" }])).toEqual([]);
  });
});

describe("syllabus ladder", () => {
  it("sharedClass takes the lower class; droppers see everything", () => {
    expect(sharedClass("Class 12", "Class 11")).toBe("Class 11");
    expect(sharedClass("Dropper", "Class 12")).toBe("Class 12");
    expect(sharedClass("Dropper", "Dropper")).toBe("Dropper");
    expect(sharedClass(null, "Class 12")).toBe("Class 12"); // unknown → treated as dropper
  });
  it("difficulty steps up every 3 battles, capped at 3", () => {
    expect(difficultyTier(0)).toBe(1);
    expect(difficultyTier(3)).toBe(2);
    expect(difficultyTier(6)).toBe(3);
    expect(difficultyTier(30)).toBe(3);
  });
  it("prefers an unplayed common weak topic in the subject", () => {
    const pick = pickChallengeTopic({
      subject: "Physics", klass: "Class 11",
      commonWeak: ["Thermodynamics"], played: [], battlesInSubject: 0,
    });
    expect(pick.topic).toBe("Thermodynamics");
  });
  it("falls back to the earliest unplayed ladder topic at the tier", () => {
    const pick = pickChallengeTopic({
      subject: "Physics", klass: "Class 11",
      commonWeak: [], played: ["Units and Measurement"], battlesInSubject: 0,
    });
    expect(pick.topic).toBe("Motion in a Straight Line");
    expect(pick.difficulty).toBe(1);
  });
  it("skips played topics (case-insensitive) and respects class filter", () => {
    const c11 = SYLLABUS.Physics.filter((t) => t.klass === "Class 11").map((t) => t.name);
    const pick = pickChallengeTopic({
      subject: "Physics", klass: "Class 11",
      commonWeak: [], played: c11, battlesInSubject: c11.length,
    });
    // everything played → wraps to the start of the ladder, never a Class 12 topic
    expect(c11).toContain(pick.topic);
  });
});
