// Spaced-repetition scheduler, ported from "Spécification — Algorithme de
// répétition espacée" (simplified SM-2, Anki-style). 4 strict states: NEW,
// LEARNING, REVIEW, RELEARNING. Learning and relearning share the same
// step-ladder mechanic (minutes) with different step lists; only REVIEW
// reasons in days.
//
// The REVIEW intervals go beyond the spec to match Anki's v3 scheduler,
// which the spec simplified away (it let small intervals collapse, e.g.
// Correcte = Facile = 3 j):
// - each passing button is at least 1 day longer than the previous one
//   (Difficile > current interval, Correcte > Difficile, Facile > Correcte);
// - fuzz scales with the interval (none under 2.5 days) and never breaks
//   that ordering;
// - days late count towards Correcte (half) and Facile (all), since the
//   card was remembered for longer than scheduled.

export type CardState = "NEW" | "LEARNING" | "REVIEW" | "RELEARNING";
export type Rating = "AGAIN" | "HARD" | "GOOD" | "EASY";

export const RATING_LABELS: Record<Rating, string> = {
  AGAIN: "À revoir",
  HARD: "Difficile",
  GOOD: "Correcte",
  EASY: "Facile",
};

export type SrsConfig = {
  learningStepsMinutes: number[];
  relearningStepsMinutes: number[];
  graduatingIntervalDays: number;
  easyIntervalDays: number;
  minimumIntervalDays: number;
  easeFactorFloor: number;
};

export const DEFAULT_SRS_CONFIG: SrsConfig = {
  learningStepsMinutes: [1, 10],
  relearningStepsMinutes: [10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  minimumIntervalDays: 1,
  easeFactorFloor: 130,
};

export type CardSchedule = {
  state: CardState;
  currentStep: number;
  intervalDays: number;
  easeFactor: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** What the review maths needs beyond the schedule itself: when the card
 * was due (for the late bonus) and a stable seed so the fuzzed interval
 * previewed under a button is exactly the one saved when it's clicked. */
export type ReviewContext = { cardId: string; dueAt: Date };

/** Deterministic number in [0, 1) from a string (FNV-1a). */
function seededRandom(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 2 ** 32;
}

// Anki v3 fuzz: no fuzz under 2.5 days, then ±15% of the part between 2.5
// and 7 days, ±10% between 7 and 20, ±5% beyond — so the spread grows with
// the interval but proportionally less and less.
const FUZZ_RANGES = [
  { start: 2.5, end: 7, factor: 0.15 },
  { start: 7, end: 20, factor: 0.1 },
  { start: 20, end: Infinity, factor: 0.05 },
];

function fuzzDelta(interval: number): number {
  if (interval < 2.5) return 0;
  return FUZZ_RANGES.reduce(
    (delta, r) => delta + r.factor * Math.max(0, Math.min(interval, r.end) - r.start),
    0
  );
}

/** Day-based interval, fuzzed, never below `minimum` (Anki's
 * constrain_passing_interval). Applied to REVIEW intervals only — never to
 * minute-based learning/relearning steps. */
function constrainedInterval(interval: number, minimum: number, random: number): number {
  const base = Math.max(Math.round(interval), minimum, 1);
  const delta = fuzzDelta(base);
  const lower = Math.max(Math.round(base - delta), minimum, 1);
  const upper = Math.max(Math.round(base + delta), lower);
  return lower + Math.floor(random * (upper - lower + 1));
}

function graduate(intervalDays: number, easeFactor: number): CardSchedule {
  return { state: "REVIEW", currentStep: 0, intervalDays, easeFactor };
}

function processLearning(
  card: CardSchedule,
  rating: Rating,
  steps: number[],
  cameFromRevision: boolean,
  config: SrsConfig
): { schedule: CardSchedule; dueAt: Date; unit: "minutes" | "days" } {
  const now = Date.now();

  switch (rating) {
    case "AGAIN": {
      const schedule: CardSchedule = { ...card, currentStep: 0 };
      return { schedule, dueAt: new Date(now + steps[0] * MINUTE_MS), unit: "minutes" };
    }
    case "HARD": {
      const currentValue = steps[card.currentStep];
      const hasNext = card.currentStep + 1 < steps.length;
      const delay = hasNext
        ? (currentValue + steps[card.currentStep + 1]) / 2
        : currentValue * 1.5;
      return { schedule: card, dueAt: new Date(now + delay * MINUTE_MS), unit: "minutes" };
    }
    case "GOOD": {
      const hasNext = card.currentStep + 1 < steps.length;
      if (hasNext) {
        const schedule: CardSchedule = { ...card, currentStep: card.currentStep + 1 };
        return {
          schedule,
          dueAt: new Date(now + steps[schedule.currentStep] * MINUTE_MS),
          unit: "minutes",
        };
      }
      const intervalDays = cameFromRevision
        ? config.minimumIntervalDays
        : config.graduatingIntervalDays;
      const schedule = graduate(intervalDays, card.easeFactor);
      return { schedule, dueAt: new Date(now + intervalDays * DAY_MS), unit: "days" };
    }
    case "EASY": {
      const intervalDays = cameFromRevision
        ? config.minimumIntervalDays
        : config.easyIntervalDays;
      const schedule = graduate(intervalDays, card.easeFactor);
      return { schedule, dueAt: new Date(now + intervalDays * DAY_MS), unit: "days" };
    }
  }
}

function processRevision(
  card: CardSchedule,
  rating: Rating,
  config: SrsConfig,
  context: ReviewContext
): { schedule: CardSchedule; dueAt: Date; unit: "minutes" | "days" } {
  const now = Date.now();

  if (rating === "AGAIN") {
    const easeFactor = Math.max(config.easeFactorFloor, card.easeFactor - 20);
    const schedule: CardSchedule = { ...card, state: "RELEARNING", currentStep: 0, easeFactor };
    return {
      schedule,
      dueAt: new Date(now + config.relearningStepsMinutes[0] * MINUTE_MS),
      unit: "minutes",
    };
  }

  // Passing buttons, computed together as in Anki so each one can be
  // forced at least 1 day past the previous: current < Difficile <
  // Correcte < Facile. Each gets its own fuzz seed, stable per due date.
  const daysLate = Math.max(0, Math.floor((now - context.dueAt.getTime()) / DAY_MS));
  const random = (r: Rating) => seededRandom(`${context.cardId}:${context.dueAt.toISOString()}:${r}`);
  const current = card.intervalDays;

  const hard = constrainedInterval(current * 1.2, current + 1, random("HARD"));
  const good = constrainedInterval(
    (current + daysLate / 2) * (card.easeFactor / 100),
    hard + 1,
    random("GOOD")
  );
  const easyFactor = card.easeFactor + 15;
  const easy = constrainedInterval(
    (current + daysLate) * (easyFactor / 100) * 1.3,
    good + 1,
    random("EASY")
  );

  const next: Record<"HARD" | "GOOD" | "EASY", CardSchedule> = {
    HARD: {
      ...card,
      easeFactor: Math.max(config.easeFactorFloor, card.easeFactor - 15),
      intervalDays: hard,
    },
    GOOD: { ...card, intervalDays: good },
    EASY: { ...card, easeFactor: easyFactor, intervalDays: easy },
  };
  const schedule = next[rating];
  return {
    schedule,
    dueAt: new Date(now + schedule.intervalDays * DAY_MS),
    unit: "days",
  };
}

export function scheduleCard(
  card: CardSchedule,
  rating: Rating,
  config: SrsConfig,
  context: ReviewContext
): { schedule: CardSchedule; dueAt: Date } {
  if (card.state === "REVIEW") {
    const { schedule, dueAt } = processRevision(card, rating, config, context);
    return { schedule, dueAt };
  }

  if (card.state === "RELEARNING") {
    const { schedule, dueAt } = processLearning(
      card,
      rating,
      config.relearningStepsMinutes,
      true,
      config
    );
    return { schedule, dueAt };
  }

  // NEW cards enter LEARNING directly on their first review.
  const learningCard: CardSchedule =
    card.state === "NEW" ? { ...card, state: "LEARNING" } : card;
  const { schedule, dueAt } = processLearning(
    learningCard,
    rating,
    config.learningStepsMinutes,
    false,
    config
  );
  return { schedule, dueAt };
}

function formatInterval(dueAt: Date, unit: "minutes" | "days"): string {
  const diffMs = dueAt.getTime() - Date.now();
  if (unit === "minutes") {
    const minutes = Math.max(1, Math.round(diffMs / MINUTE_MS));
    return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
  }
  const days = Math.max(1, Math.round(diffMs / DAY_MS));
  return `${days} j`;
}

/** Preview labels for each of the four rating buttons, for a given card. */
export function ratingPreviews(
  card: CardSchedule,
  config: SrsConfig,
  context: ReviewContext
): Record<Rating, string> {
  const ratings: Rating[] = ["AGAIN", "HARD", "GOOD", "EASY"];
  const result = {} as Record<Rating, string>;
  for (const rating of ratings) {
    if (card.state === "REVIEW") {
      // "À revoir" sends a review card back to relearning in minutes, so
      // it's formatted with the unit it actually returns.
      const { dueAt, unit } = processRevision(card, rating, config, context);
      result[rating] = formatInterval(dueAt, unit);
      continue;
    }
    const steps = card.state === "RELEARNING" ? config.relearningStepsMinutes : config.learningStepsMinutes;
    const cameFromRevision = card.state === "RELEARNING";
    const learningCard = card.state === "NEW" ? { ...card, state: "LEARNING" as const } : card;
    const { dueAt, unit } = processLearning(learningCard, rating, steps, cameFromRevision, config);
    result[rating] = formatInterval(dueAt, unit);
  }
  return result;
}
