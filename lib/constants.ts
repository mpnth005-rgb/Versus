export const FREE_MONTHLY_EXERCISE_LIMIT = 7;
export const FREE_MAX_CARDS_PER_EXERCISE = 3;
export const DEFAULT_DAILY_NEW_CARD_LIMIT = 10;
export const MAX_DAILY_NEW_CARDS = 30;
// "Vérifier ma réponse" in the deck: unlimited on Versus Upper.
export const FREE_DAILY_DECK_CHECKS = 5;

// Character limits of what the learner types (checked in the UI and again
// by the API routes). Generous: a translation of a 130-170-word text runs
// ~1 000-1 200 characters, a card sentence ~100.
export const MAX_TRANSLATION_CHARS = 2000;
export const MAX_CARD_CHARS = 250;
export const MAX_DECK_ANSWER_CHARS = 250;

export const TEXT_TYPE_LABELS: Record<string, string> = {
  LITERARY: "Littéraire",
  JOURNALISTIC: "Journalistique",
  DAILY: "Quotidien",
};

export const LEVEL_LABELS: Record<string, string> = {
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
};

export const THEME_OPTIONS = [
  "Science et nouvelle technologie",
  "Environnement",
  "Économie",
  "Société",
  "Civilisation anglophone",
] as const;

export const MAX_THEMES = 1;

export const NAV_ITEMS = [
  { href: "/training", label: "Entraînement" },
  { href: "/deck", label: "Deck de révision" },
  { href: "/progress", label: "Progression" },
  { href: "/account", label: "Gestion du compte" },
] as const;

/** Returns "2026-09" for the current UTC month. */
export function currentYearMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

