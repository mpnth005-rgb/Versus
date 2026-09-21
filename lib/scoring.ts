// Deterministic scoring, straight from "Fiche de correction — Traduction
// FR → EN" and "Fiche — Double score et ajustement par niveau de texte".
//
// The AI never computes a score (see lib/ai.ts — it only classifies
// errors into this fixed taxonomy). A model that occasionally miscounts
// an addition would silently corrupt every score, so the arithmetic
// always happens here, in code, from a fixed penalty table.
//
// The spec's worked examples are on a /20 scale. The product's screens
// (and the rest of this app) show scores out of 100, so the penalty
// table below is the spec's table scaled by 5 — every ratio, every
// level coefficient, and the B2-is-the-unadjusted-reference property
// are preserved exactly; only the base (Note_max) differs.

export type ErrorType =
  | "FAUTE_DE_TEMPS"
  | "CONTRESENS"
  | "FAUTE_DE_STYLE"
  | "FAUTE_DE_PREPOSITION"
  | "FAUTE_DE_VOCABULAIRE"
  | "FAUTE_DE_SYNTAXE"
  | "CALQUE"
  | "TRADUCTION_INEXACTE"
  | "FAUTE_DE_TON";

export const ERROR_TYPES: ErrorType[] = [
  "FAUTE_DE_TEMPS",
  "CONTRESENS",
  "FAUTE_DE_STYLE",
  "FAUTE_DE_PREPOSITION",
  "FAUTE_DE_VOCABULAIRE",
  "FAUTE_DE_SYNTAXE",
  "CALQUE",
  "TRADUCTION_INEXACTE",
  "FAUTE_DE_TON",
];

export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  FAUTE_DE_TEMPS: "Faute de temps",
  CONTRESENS: "Contresens",
  FAUTE_DE_STYLE: "Faute de style",
  FAUTE_DE_PREPOSITION: "Faute de préposition",
  FAUTE_DE_VOCABULAIRE: "Faute de vocabulaire",
  FAUTE_DE_SYNTAXE: "Faute de syntaxe",
  CALQUE: "Calque",
  TRADUCTION_INEXACTE: "Traduction inexacte",
  FAUTE_DE_TON: "Faute de ton",
};

const NOTE_MAX = 100;

const PENALTY_TABLE: Record<ErrorType, number> = {
  FAUTE_DE_TEMPS: 10,
  CONTRESENS: 5,
  FAUTE_DE_STYLE: 5,
  FAUTE_DE_PREPOSITION: 2.5,
  FAUTE_DE_VOCABULAIRE: 2.5,
  FAUTE_DE_SYNTAXE: 2.5,
  CALQUE: 2.5,
  TRADUCTION_INEXACTE: 1.25,
  FAUTE_DE_TON: 1.25,
};

const LEVEL_COEFFICIENTS: Record<"A2" | "B1" | "B2" | "C1", number> = {
  A2: 1.5,
  B1: 1.2,
  B2: 1.0,
  C1: 0.7,
};

export function computeScores(
  errorTypes: ErrorType[],
  level: "A2" | "B1" | "B2" | "C1"
): { overallScore: number; adjustedScore: number } {
  const totalPenalty = errorTypes.reduce((sum, type) => sum + PENALTY_TABLE[type], 0);
  const overallScore = Math.max(0, Math.round(NOTE_MAX - totalPenalty));
  const adjustedScore = Math.max(
    0,
    Math.round(NOTE_MAX - totalPenalty * LEVEL_COEFFICIENTS[level])
  );
  return { overallScore, adjustedScore };
}
