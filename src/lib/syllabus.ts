import type { Subject } from "./types";

export type CoreSubject = Exclude<Subject, "Unknown">;

// The JEE syllabus as static data: subject → class → topics ordered
// beginner → advanced. Challenge topics come from here — common weak areas
// first, then the ladder, stepping up in difficulty as a pair keeps playing.

export interface SyllabusTopic {
  name: string;
  klass: "Class 11" | "Class 12";
  difficulty: 1 | 2 | 3; // 1 beginner · 2 intermediate · 3 advanced
  sub: string[]; // subtopics — each is a valid revision/practice target
}

const T = (name: string, klass: "Class 11" | "Class 12", difficulty: 1 | 2 | 3, sub: string[] = []): SyllabusTopic => ({ name, klass, difficulty, sub });

export const SYLLABUS: Record<CoreSubject, SyllabusTopic[]> = {
  Physics: [
    T("Units and Measurement", "Class 11", 1, ["Dimensional Analysis", "Significant Figures", "Error Analysis"]),
    T("Motion in a Straight Line", "Class 11", 1, ["Kinematic Equations", "Relative Motion", "Graphs of Motion"]),
    T("Motion in a Plane", "Class 11", 1, ["Vectors", "Projectile Motion", "Uniform Circular Motion", "River-Boat Problems"]),
    T("Laws of Motion", "Class 11", 1, ["Newton's Laws", "Friction", "Pseudo Forces", "Pulleys and Constraints"]),
    T("Work, Energy and Power", "Class 11", 2, ["Work-Energy Theorem", "Conservation of Energy", "Power", "Collisions"]),
    T("Rotational Motion", "Class 11", 2, ["Torque", "Moment of Inertia", "Angular Momentum", "Rolling Motion", "Centre of Mass"]),
    T("Gravitation", "Class 11", 2, ["Kepler's Laws", "Gravitational Potential", "Satellites and Escape Velocity"]),
    T("Mechanical Properties of Solids", "Class 11", 2, ["Stress and Strain", "Young's Modulus", "Elastic Potential Energy"]),
    T("Mechanical Properties of Fluids", "Class 11", 2, ["Pressure and Pascal's Law", "Bernoulli's Theorem", "Viscosity", "Surface Tension"]),
    T("Thermal Properties of Matter", "Class 11", 2, ["Thermal Expansion", "Calorimetry", "Heat Transfer"]),
    T("Thermodynamics", "Class 11", 2, ["First Law", "Thermodynamic Processes", "Second Law and Entropy", "Carnot Engine"]),
    T("Kinetic Theory of Gases", "Class 11", 2, ["Ideal Gas Equation", "RMS Speed", "Degrees of Freedom"]),
    T("Oscillations", "Class 11", 3, ["SHM Basics", "Spring-Mass System", "Simple Pendulum", "Energy in SHM"]),
    T("Waves", "Class 11", 3, ["Wave Equation", "Standing Waves", "Beats", "Doppler Effect"]),
    T("Electric Charges and Fields", "Class 12", 1, ["Coulomb's Law", "Electric Field Lines", "Gauss's Law", "Electric Dipole"]),
    T("Electrostatic Potential and Capacitance", "Class 12", 2, ["Electric Potential", "Capacitors", "Dielectrics", "Energy Stored"]),
    T("Current Electricity", "Class 12", 1, ["Ohm's Law and Resistance", "Kirchhoff's Laws", "Wheatstone Bridge", "Cells and EMF"]),
    T("Moving Charges and Magnetism", "Class 12", 2, ["Biot-Savart Law", "Ampere's Law", "Force on Moving Charge", "Torque on Current Loop"]),
    T("Magnetism and Matter", "Class 12", 2, ["Bar Magnet", "Earth's Magnetism", "Magnetic Materials"]),
    T("Electromagnetic Induction", "Class 12", 2, ["Faraday's Law", "Lenz's Law", "Self and Mutual Inductance", "Motional EMF"]),
    T("Alternating Current", "Class 12", 3, ["RMS and Average Values", "LCR Circuits", "Resonance", "Transformers"]),
    T("Electromagnetic Waves", "Class 12", 2, ["Displacement Current", "EM Spectrum"]),
    T("Ray Optics", "Class 12", 2, ["Mirrors", "Refraction and Lenses", "Total Internal Reflection", "Prism", "Optical Instruments"]),
    T("Wave Optics", "Class 12", 3, ["Young's Double Slit", "Interference", "Diffraction", "Polarisation"]),
    T("Dual Nature of Radiation and Matter", "Class 12", 2, ["Photoelectric Effect", "de Broglie Wavelength"]),
    T("Atoms", "Class 12", 2, ["Bohr Model", "Hydrogen Spectrum"]),
    T("Nuclei", "Class 12", 2, ["Radioactivity", "Binding Energy", "Nuclear Reactions"]),
    T("Semiconductor Electronics", "Class 12", 3, ["PN Junction Diode", "Rectifiers", "Transistors", "Logic Gates"]),
  ],
  Chemistry: [
    T("Some Basic Concepts of Chemistry", "Class 11", 1, ["Mole Concept", "Stoichiometry", "Concentration Terms", "Limiting Reagent"]),
    T("Structure of Atom", "Class 11", 1, ["Bohr Model", "Quantum Numbers", "Electronic Configuration", "Orbitals"]),
    T("Periodicity of Elements", "Class 11", 1, ["Periodic Trends", "Ionisation Energy", "Electronegativity"]),
    T("Chemical Bonding", "Class 11", 2, ["Lewis Structures", "VSEPR Theory", "Hybridisation", "Molecular Orbital Theory", "Hydrogen Bonding"]),
    T("States of Matter", "Class 11", 1, ["Gas Laws", "Ideal vs Real Gases", "Liquefaction"]),
    T("Chemical Thermodynamics", "Class 11", 2, ["Enthalpy", "Hess's Law", "Entropy and Gibbs Energy", "Spontaneity"]),
    T("Equilibrium", "Class 11", 2, ["Chemical Equilibrium and Kc", "Le Chatelier's Principle", "Ionic Equilibrium and pH", "Buffers", "Solubility Product"]),
    T("Redox Reactions", "Class 11", 1, ["Oxidation Number", "Balancing Redox Equations"]),
    T("s-Block Elements", "Class 11", 1, ["Alkali Metals", "Alkaline Earth Metals"]),
    T("p-Block Elements (Class 11)", "Class 11", 2, ["Boron Family", "Carbon Family"]),
    T("Organic Chemistry: Basic Principles", "Class 11", 2, ["IUPAC Nomenclature", "Isomerism", "Electronic Effects", "Reaction Intermediates"]),
    T("Hydrocarbons", "Class 11", 2, ["Alkanes", "Alkenes", "Alkynes", "Aromatic Hydrocarbons"]),
    T("Solutions", "Class 12", 2, ["Raoult's Law", "Colligative Properties", "Azeotropes"]),
    T("Electrochemistry", "Class 12", 2, ["Electrode Potential", "Nernst Equation", "Electrolysis", "Batteries and Corrosion"]),
    T("Chemical Kinetics", "Class 12", 2, ["Rate Laws", "Order of Reaction", "Arrhenius Equation", "Half-Life"]),
    T("Surface Chemistry", "Class 12", 1, ["Adsorption", "Catalysis", "Colloids"]),
    T("p-Block Elements (Class 12)", "Class 12", 2, ["Nitrogen Family", "Oxygen Family", "Halogens", "Noble Gases"]),
    T("d- and f-Block Elements", "Class 12", 2, ["Transition Metal Properties", "KMnO₄ and K₂Cr₂O₇", "Lanthanoids"]),
    T("Coordination Compounds", "Class 12", 3, ["Nomenclature", "Isomerism in Complexes", "Crystal Field Theory", "Bonding Theories"]),
    T("Haloalkanes and Haloarenes", "Class 12", 2, ["SN1 and SN2 Reactions", "Elimination Reactions"]),
    T("Alcohols, Phenols and Ethers", "Class 12", 2, ["Preparation and Properties", "Acidity of Phenols", "Name Reactions"]),
    T("Aldehydes, Ketones and Carboxylic Acids", "Class 12", 3, ["Nucleophilic Addition", "Aldol and Cannizzaro", "Acidity of Carboxylic Acids", "Name Reactions"]),
    T("Amines", "Class 12", 3, ["Basicity of Amines", "Diazonium Salts"]),
    T("Biomolecules", "Class 12", 2, ["Carbohydrates", "Proteins and Amino Acids", "Vitamins and Nucleic Acids"]),
    T("Polymers", "Class 12", 1, ["Addition Polymers", "Condensation Polymers"]),
  ],
  Maths: [
    T("Sets", "Class 11", 1, ["Set Operations", "Venn Diagrams"]),
    T("Relations and Functions", "Class 11", 1, ["Types of Relations", "Types of Functions", "Composition and Inverse"]),
    T("Trigonometric Functions", "Class 11", 2, ["Identities", "Trigonometric Equations", "Compound Angles"]),
    T("Complex Numbers", "Class 11", 2, ["Argand Plane and Modulus", "De Moivre's Theorem", "Cube Roots of Unity", "Locus Problems"]),
    T("Quadratic Equations", "Class 11", 2, ["Nature of Roots", "Relation between Roots and Coefficients", "Location of Roots"]),
    T("Linear Inequalities", "Class 11", 1, ["One-Variable Inequalities", "Modulus Inequalities"]),
    T("Permutations and Combinations", "Class 11", 2, ["Fundamental Counting", "Arrangements", "Selections", "Distribution Problems"]),
    T("Binomial Theorem", "Class 11", 2, ["General Term", "Middle Term and Greatest Term", "Binomial Coefficients"]),
    T("Sequences and Series", "Class 11", 2, ["AP", "GP", "AM-GM Inequality", "Special Series"]),
    T("Straight Lines", "Class 11", 2, ["Forms of a Line", "Angle between Lines", "Distance Formulas", "Family of Lines"]),
    T("Conic Sections", "Class 11", 2, ["Circle", "Parabola", "Ellipse", "Hyperbola"]),
    T("Limits and Derivatives", "Class 11", 2, ["Standard Limits", "L'Hôpital-Style Evaluation", "First Principles"]),
    T("Statistics", "Class 11", 1, ["Mean, Median, Mode", "Variance and Standard Deviation"]),
    T("Probability", "Class 11", 2, ["Classical Probability", "Addition and Multiplication Rules", "Conditional Probability"]),
    T("Inverse Trigonometric Functions", "Class 12", 2, ["Principal Values", "Identities and Simplification"]),
    T("Matrices", "Class 12", 1, ["Matrix Operations", "Transpose and Symmetric Matrices", "Inverse of a Matrix"]),
    T("Determinants", "Class 12", 2, ["Properties of Determinants", "Cramer's Rule", "Adjoint and Inverse"]),
    T("Continuity and Differentiability", "Class 12", 2, ["Continuity", "Differentiability", "Chain Rule", "Implicit and Logarithmic Differentiation"]),
    T("Applications of Derivatives", "Class 12", 3, ["Rate of Change", "Tangents and Normals", "Maxima and Minima", "Monotonicity"]),
    T("Integrals", "Class 12", 3, ["Standard Integrals", "Substitution", "Integration by Parts", "Definite Integral Properties"]),
    T("Applications of Integrals", "Class 12", 3, ["Area under Curves", "Area between Curves"]),
    T("Differential Equations", "Class 12", 3, ["Variable Separable", "Linear Differential Equations", "Homogeneous Equations"]),
    T("Vector Algebra", "Class 12", 2, ["Dot Product", "Cross Product", "Scalar Triple Product"]),
    T("Three Dimensional Geometry", "Class 12", 2, ["Direction Cosines", "Lines in 3D", "Planes", "Shortest Distance"]),
    T("Probability (Advanced)", "Class 12", 3, ["Bayes' Theorem", "Probability Distributions", "Binomial Distribution"]),
  ],
};

// Resolve any revision target — a chapter OR a subtopic — to its subject.
// Weak-topic names from papers take priority upstream; this is the syllabus fallback.
export function findSubjectFor(name: string): CoreSubject | null {
  const n = name.toLowerCase();
  for (const subject of Object.keys(SYLLABUS) as CoreSubject[]) {
    for (const t of SYLLABUS[subject]) {
      if (t.name.toLowerCase() === n || t.sub.some((s) => s.toLowerCase() === n)) return subject;
    }
  }
  return null;
}

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
