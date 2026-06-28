import type { Subject } from "./types";

// Sample extracted questions used when no ANTHROPIC_API_KEY is configured,
// so the full loop is demoable offline. Mirrors the shape Claude vision returns.
export interface ExtractedQuestion {
  number: number;
  text: string;
  subject: Subject;
  topic: string;
  subtopic?: string;
}

export const SAMPLE_QUESTIONS: ExtractedQuestion[] = [
  {
    number: 1,
    text: "A solid sphere of mass M and radius R rolls without slipping down an incline of angle θ. Find its acceleration.",
    subject: "Physics",
    topic: "Rotational Motion",
    subtopic: "Rolling Motion",
  },
  {
    number: 2,
    text: "A uniform rod of length L is pivoted at one end and released from horizontal. Find the angular velocity when vertical.",
    subject: "Physics",
    topic: "Rotational Motion",
    subtopic: "Moment of Inertia",
  },
  {
    number: 3,
    text: "Two point charges +q and −q are separated by distance d. Find the electric field at the midpoint.",
    subject: "Physics",
    topic: "Electrostatics",
    subtopic: "Electric Field",
  },
  {
    number: 4,
    text: "A parallel plate capacitor with plate area A and separation d is filled with a dielectric of constant K. Find the capacitance.",
    subject: "Physics",
    topic: "Electrostatics",
    subtopic: "Capacitance",
  },
  {
    number: 5,
    text: "Find the number of structural isomers of C5H12.",
    subject: "Chemistry",
    topic: "General Organic Chemistry",
    subtopic: "Isomerism",
  },
  {
    number: 6,
    text: "Calculate the pH of a 0.01 M solution of HCl.",
    subject: "Chemistry",
    topic: "Ionic Equilibrium",
    subtopic: "pH Calculation",
  },
  {
    number: 7,
    text: "The rate constant of a first-order reaction is 0.693 min⁻¹. Find its half-life.",
    subject: "Chemistry",
    topic: "Chemical Kinetics",
    subtopic: "First Order Reactions",
  },
  {
    number: 8,
    text: "Evaluate the integral ∫ x·eˣ dx.",
    subject: "Maths",
    topic: "Integral Calculus",
    subtopic: "Integration by Parts",
  },
  {
    number: 9,
    text: "Find the equation of the tangent to the parabola y² = 4ax at the point (at², 2at).",
    subject: "Maths",
    topic: "Conic Sections",
    subtopic: "Parabola",
  },
  {
    number: 10,
    text: "If the roots of x² − px + q = 0 differ by 1, find the relation between p and q.",
    subject: "Maths",
    topic: "Quadratic Equations",
    subtopic: "Nature of Roots",
  },
];
