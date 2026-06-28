import type { ErrorTag, SkipReason } from "./types";

// The self-tag taxonomy, in student language. These labels appear on the chips
// the student taps after narrating — never the word "taxonomy" or "error type".

export interface TagMeta {
  tag: ErrorTag;
  emoji: string;
  label: string; // short chip label
  blurb: string; // one-line plain explanation
}

export const ERROR_TAGS: TagMeta[] = [
  { tag: "concept", emoji: "🧠", label: "Didn't know the concept", blurb: "The idea or formula wasn't clear to me." },
  { tag: "calc_slip", emoji: "✏️", label: "Silly calculation slip", blurb: "I knew it but messed up the maths." },
  { tag: "misread", emoji: "👀", label: "Read the question wrong", blurb: "I misunderstood what was being asked." },
  { tag: "wrong_method", emoji: "🔀", label: "Wrong method", blurb: "I picked an approach that didn't fit." },
  { tag: "time", emoji: "⏱️", label: "Ran out of time", blurb: "I knew how but couldn't finish in time." },
  { tag: "second_guess", emoji: "🔄", label: "Changed my correct answer", blurb: "I second-guessed and switched away from the right one." },
];

export const TAG_MAP: Record<ErrorTag, TagMeta> = Object.fromEntries(
  ERROR_TAGS.map((t) => [t.tag, t]),
) as Record<ErrorTag, TagMeta>;

export const SKIP_REASONS: { reason: SkipReason; emoji: string; label: string }[] = [
  { reason: "skip_time", emoji: "⏱️", label: "Ran out of time" },
  { reason: "skip_unknown", emoji: "🤷", label: "Didn't know how to start" },
];

// Friendly one-word names used in headlines / charts.
export const TAG_SHORT: Record<ErrorTag, string> = {
  concept: "concept gaps",
  calc_slip: "calculation slips",
  misread: "misreads",
  wrong_method: "wrong methods",
  time: "time pressure",
  second_guess: "second-guessing",
};
