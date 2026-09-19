// Simplified SM-2-style spaced repetition scheduler.
//
// New / relearning cards use the fixed ladder shown in the product design
// (10 min / 1 day / 3 days / 6 days). Once a card has graduated to the
// REVIEW state, subsequent ratings scale the interval by the ease factor,
// following the classic SM-2 shape (without the ease-factor-from-quality
// formula, which this simplified 4-button UI doesn't need).

export type CardState = "NEW" | "LEARNING" | "REVIEW";
export type Rating = "AGAIN" | "HARD" | "GOOD" | "EASY";

const MINUTE = 1;
const DAY = 60 * 24;
const MIN_EASE = 1.3;

const INITIAL_INTERVAL_MINUTES: Record<Rating, number> = {
  AGAIN: 10 * MINUTE,
  HARD: 1 * DAY,
  GOOD: 3 * DAY,
  EASY: 6 * DAY,
};

export type CardSchedule = {
  state: CardState;
  intervalMinutes: number;
  easeFactor: number;
  repetitions: number;
};

export function scheduleCard(card: CardSchedule, rating: Rating): CardSchedule {
  if (card.state === "REVIEW") {
    switch (rating) {
      case "AGAIN":
        return {
          state: "LEARNING",
          intervalMinutes: INITIAL_INTERVAL_MINUTES.AGAIN,
          easeFactor: Math.max(MIN_EASE, card.easeFactor - 0.2),
          repetitions: 0,
        };
      case "HARD":
        return {
          state: "REVIEW",
          intervalMinutes: Math.round(card.intervalMinutes * 1.2),
          easeFactor: Math.max(MIN_EASE, card.easeFactor - 0.15),
          repetitions: card.repetitions + 1,
        };
      case "GOOD":
        return {
          state: "REVIEW",
          intervalMinutes: Math.round(card.intervalMinutes * card.easeFactor),
          easeFactor: card.easeFactor,
          repetitions: card.repetitions + 1,
        };
      case "EASY":
        return {
          state: "REVIEW",
          intervalMinutes: Math.round(card.intervalMinutes * card.easeFactor * 1.3),
          easeFactor: card.easeFactor + 0.15,
          repetitions: card.repetitions + 1,
        };
    }
  }

  // NEW or LEARNING: use the fixed ladder.
  return {
    state: rating === "AGAIN" ? "LEARNING" : "REVIEW",
    intervalMinutes: INITIAL_INTERVAL_MINUTES[rating],
    easeFactor: card.easeFactor,
    repetitions: rating === "AGAIN" ? 0 : 1,
  };
}

export function dueAtFromNow(intervalMinutes: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + intervalMinutes * 60_000);
}

export function formatInterval(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < DAY) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / DAY)} j`;
}

/** Preview labels for each of the four rating buttons, for a given card. */
export function ratingPreviews(card: CardSchedule): Record<Rating, string> {
  const ratings: Rating[] = ["AGAIN", "HARD", "GOOD", "EASY"];
  const result = {} as Record<Rating, string>;
  for (const rating of ratings) {
    result[rating] = formatInterval(scheduleCard(card, rating).intervalMinutes);
  }
  return result;
}

export const RATING_LABELS: Record<Rating, string> = {
  AGAIN: "À revoir",
  HARD: "Difficile",
  GOOD: "Correcte",
  EASY: "Facile",
};
