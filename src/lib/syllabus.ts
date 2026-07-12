import type { Subject } from "./types";

export type CoreSubject = Exclude<Subject, "Unknown">;

// The JEE syllabus as static data: subject → class → topics ordered
// beginner → advanced. Challenge topics come from here — common weak areas
// first, then the ladder, stepping up in difficulty as a pair keeps playing.

export interface SyllabusTopic {
  name: string;
  klass: "Class 11" | "Class 12";
  difficulty: 1 | 2 | 3; // 1 beginner · 2 intermediate · 3 advanced
}

const T = (name: string, klass: "Class 11" | "Class 12", difficulty: 1 | 2 | 3): SyllabusTopic => ({ name, klass, difficulty });

export const SYLLABUS: Record<CoreSubject, SyllabusTopic[]> = {
  Physics: [
    T("Units and Measurement", "Class 11", 1),
    T("Motion in a Straight Line", "Class 11", 1),
    T("Motion in a Plane", "Class 11", 1),
    T("Laws of Motion", "Class 11", 1),
    T("Work, Energy and Power", "Class 11", 2),
    T("Rotational Motion", "Class 11", 2),
    T("Gravitation", "Class 11", 2),
    T("Mechanical Properties of Solids", "Class 11", 2),
    T("Mechanical Properties of Fluids", "Class 11", 2),
    T("Thermal Properties of Matter", "Class 11", 2),
    T("Thermodynamics", "Class 11", 2),
    T("Kinetic Theory of Gases", "Class 11", 2),
    T("Oscillations", "Class 11", 3),
    T("Waves", "Class 11", 3),
    T("Electric Charges and Fields", "Class 12", 1),
    T("Electrostatic Potential and Capacitance", "Class 12", 2),
    T("Current Electricity", "Class 12", 1),
    T("Moving Charges and Magnetism", "Class 12", 2),
    T("Magnetism and Matter", "Class 12", 2),
    T("Electromagnetic Induction", "Class 12", 2),
    T("Alternating Current", "Class 12", 3),
    T("Electromagnetic Waves", "Class 12", 2),
    T("Ray Optics", "Class 12", 2),
    T("Wave Optics", "Class 12", 3),
    T("Dual Nature of Radiation and Matter", "Class 12", 2),
    T("Atoms", "Class 12", 2),
    T("Nuclei", "Class 12", 2),
    T("Semiconductor Electronics", "Class 12", 3),
  ],
  Chemistry: [
    T("Some Basic Concepts of Chemistry", "Class 11", 1),
    T("Structure of Atom", "Class 11", 1),
    T("Periodicity of Elements", "Class 11", 1),
    T("Chemical Bonding", "Class 11", 2),
    T("States of Matter", "Class 11", 1),
    T("Chemical Thermodynamics", "Class 11", 2),
    T("Equilibrium", "Class 11", 2),
    T("Redox Reactions", "Class 11", 1),
    T("s-Block Elements", "Class 11", 1),
    T("p-Block Elements (Class 11)", "Class 11", 2),
    T("Organic Chemistry: Basic Principles", "Class 11", 2),
    T("Hydrocarbons", "Class 11", 2),
    T("Solutions", "Class 12", 2),
    T("Electrochemistry", "Class 12", 2),
    T("Chemical Kinetics", "Class 12", 2),
    T("Surface Chemistry", "Class 12", 1),
    T("p-Block Elements (Class 12)", "Class 12", 2),
    T("d- and f-Block Elements", "Class 12", 2),
    T("Coordination Compounds", "Class 12", 3),
    T("Haloalkanes and Haloarenes", "Class 12", 2),
    T("Alcohols, Phenols and Ethers", "Class 12", 2),
    T("Aldehydes, Ketones and Carboxylic Acids", "Class 12", 3),
    T("Amines", "Class 12", 3),
    T("Biomolecules", "Class 12", 2),
    T("Polymers", "Class 12", 1),
  ],
  Maths: [
    T("Sets", "Class 11", 1),
    T("Relations and Functions", "Class 11", 1),
    T("Trigonometric Functions", "Class 11", 2),
    T("Complex Numbers", "Class 11", 2),
    T("Quadratic Equations", "Class 11", 2),
    T("Linear Inequalities", "Class 11", 1),
    T("Permutations and Combinations", "Class 11", 2),
    T("Binomial Theorem", "Class 11", 2),
    T("Sequences and Series", "Class 11", 2),
    T("Straight Lines", "Class 11", 2),
    T("Conic Sections", "Class 11", 2),
    T("Limits and Derivatives", "Class 11", 2),
    T("Statistics", "Class 11", 1),
    T("Probability", "Class 11", 2),
    T("Inverse Trigonometric Functions", "Class 12", 2),
    T("Matrices", "Class 12", 1),
    T("Determinants", "Class 12", 2),
    T("Continuity and Differentiability", "Class 12", 2),
    T("Applications of Derivatives", "Class 12", 3),
    T("Integrals", "Class 12", 3),
    T("Applications of Integrals", "Class 12", 3),
    T("Differential Equations", "Class 12", 3),
    T("Vector Algebra", "Class 12", 2),
    T("Three Dimensional Geometry", "Class 12", 2),
    T("Probability (Advanced)", "Class 12", 3),
  ],
};

// The class both players can be examined on: the LOWER one, so nobody faces
// syllabus they haven't studied. Droppers have seen everything.
export function sharedClass(a: string | null, b: string | null): "Class 11" | "Class 12" | "Dropper" {
  const rank = (k: string | null) => (k === "Class 11" ? 0 : k === "Class 12" ? 1 : 2);
  const low = Math.min(rank(a), rank(b));
  return low === 0 ? "Class 11" : low === 1 ? "Class 12" : "Dropper";
}

// Every 3 battles a pair plays in a subject, the questions step up a tier.
export function difficultyTier(battlesInSubject: number): 1 | 2 | 3 {
  return Math.min(3, 1 + Math.floor(battlesInSubject / 3)) as 1 | 2 | 3;
}

/**
 * Pick the next challenge topic for a pair:
 * 1. a COMMON WEAK topic in this subject they haven't battled yet,
 * 2. else the earliest unplayed syllabus topic for their class at (or below)
 *    the current difficulty tier — beginner → advanced,
 * 3. else the earliest unplayed topic at any tier,
 * 4. else wrap around to the start of the ladder.
 */
export function pickChallengeTopic(opts: {
  subject: CoreSubject;
  klass: "Class 11" | "Class 12" | "Dropper";
  commonWeak: string[]; // topic names weak for BOTH players (any subject — filtered here)
  played: string[]; // topic names this pair already battled in this subject
  battlesInSubject: number;
}): { topic: string; difficulty: 1 | 2 | 3 } {
  const tier = difficultyTier(opts.battlesInSubject);
  const playedSet = new Set(opts.played.map((t) => t.toLowerCase()));
  const ladder = SYLLABUS[opts.subject].filter(
    (t) => opts.klass === "Dropper" || t.klass === opts.klass,
  );
  const names = new Set(ladder.map((t) => t.name.toLowerCase()));

  const weak = opts.commonWeak.find((w) => names.has(w.toLowerCase()) && !playedSet.has(w.toLowerCase()));
  if (weak) {
    const t = ladder.find((x) => x.name.toLowerCase() === weak.toLowerCase())!;
    return { topic: t.name, difficulty: tier };
  }

  const next =
    ladder.find((t) => t.difficulty <= tier && !playedSet.has(t.name.toLowerCase())) ??
    ladder.find((t) => !playedSet.has(t.name.toLowerCase())) ??
    ladder[0];
  return { topic: next.name, difficulty: tier };
}
