// Spaced-repetition scheduler, ported faithfully from
// "Spécification — Algorithme de répétition espacée" (simplified SM-2,
// Anki-style). 4 strict states: NEW, LEARNING, REVIEW, RELEARNING.
// Learning and relearning share the same step-ladder mechanic (minutes)
// with different step lists; only REVIEW reasons in days and applies
// fuzz. See the spec's reference Python for the source of truth this
// mirrors 1:1.

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

/** ±10% random variation applied to day-based intervals only — never to
 * minute-based learning/relearning steps — so cards created together
 * don't stay perpetually bunched. */
function fuzz(days: number): number {
  const variation = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.round(days * variation));
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
  config: SrsConfig
): { schedule: CardSchedule; dueAt: Date; unit: "minutes" | "days" } {
  const now = Date.now();

  switch (rating) {
    case "AGAIN": {
      const easeFactor = Math.max(config.easeFactorFloor, card.easeFactor - 20);
      const schedule: CardSchedule = { ...card, state: "RELEARNING", currentStep: 0, easeFactor };
      return {
        schedule,
        dueAt: new Date(now + config.relearningStepsMinutes[0] * MINUTE_MS),
        unit: "minutes",
      };
    }
    case "HARD": {
      const easeFactor = Math.max(config.easeFactorFloor, card.easeFactor - 15);
      const intervalDays = fuzz(card.intervalDays * 1.2);
      return {
        schedule: { ...card, easeFactor, intervalDays },
        dueAt: new Date(now + intervalDays * DAY_MS),
        unit: "days",
      };
    }
    case "GOOD": {
      const intervalDays = fuzz(card.intervalDays * (card.easeFactor / 100));
      return {
        schedule: { ...card, intervalDays },
        dueAt: new Date(now + intervalDays * DAY_MS),
        unit: "days",
      };
    }
    case "EASY": {
      const easeFactor = card.easeFactor + 15;
      const intervalDays = fuzz(card.intervalDays * (easeFactor / 100) * 1.3);
      return {
        schedule: { ...card, easeFactor, intervalDays },
        dueAt: new Date(now + intervalDays * DAY_MS),
        unit: "days",
      };
    }
  }
}

export function scheduleCard(
  card: CardSchedule,
  rating: Rating,
  config: SrsConfig = DEFAULT_SRS_CONFIG
): { schedule: CardSchedule; dueAt: Date } {
  if (card.state === "REVIEW") {
    const { schedule, dueAt } = processRevision(card, rating, config);
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
  config: SrsConfig = DEFAULT_SRS_CONFIG
): Record<Rating, string> {
  const ratings: Rating[] = ["AGAIN", "HARD", "GOOD", "EASY"];
  const result = {} as Record<Rating, string>;
  for (const rating of ratings) {
    if (card.state === "REVIEW") {
      const { dueAt } = processRevision(card, rating, config);
      result[rating] = formatInterval(dueAt, "days");
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
