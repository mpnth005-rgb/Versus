// Deterministic scoring, straight from "Fiche de correction — Traduction
// FR → EN" and "Fiche — Double score et ajustement par niveau de texte".
//
// The AI never computes a score (see lib/ai.ts — it only classifies
// errors into this fixed taxonomy). A model that occasionally miscounts
// an addition would silently corrupt every score, so the arithmetic
// always happens here, in code, from a fixed penalty table.
//
// Scores are out of 20, matching the spec's worked examples exactly
// (e.g. the "troufions" example: 6.5 points of penalties on a B2 text
// gives 13.5/20 raw and adjusted).

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

const NOTE_MAX = 20;

const PENALTY_TABLE: Record<ErrorType, number> = {
  FAUTE_DE_TEMPS: 2,
  CONTRESENS: 1,
  FAUTE_DE_STYLE: 1,
  FAUTE_DE_PREPOSITION: 0.5,
  FAUTE_DE_VOCABULAIRE: 0.5,
  FAUTE_DE_SYNTAXE: 0.5,
  CALQUE: 0.5,
  TRADUCTION_INEXACTE: 0.25,
  FAUTE_DE_TON: 0.25,
};

// Penalties are quarter-point increments, so results are always exact at
// 2 decimals — this just guards against binary floating-point noise
// (e.g. 6.5 * 1.2 === 7.800000000000001).
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const ERROR_TYPE_SET = new Set<string>(ERROR_TYPES);

/**
 * Best-effort recovery for an AI-returned error-type string that's close
 * to but not exactly an ErrorType (wrong case, accents, spaces instead
 * of underscores) — e.g. "faute_de_temps" or "Contresens". Returns the
 * input unchanged if it doesn't normalize to a known type, so the
 * downstream z.enum() still rejects genuinely invalid values.
 */
export function normalizeErrorType(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const normalized = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return ERROR_TYPE_SET.has(normalized) ? normalized : value;
}

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
  const overallScore = Math.max(0, round2(NOTE_MAX - totalPenalty));
  const adjustedScore = Math.max(
    0,
    round2(NOTE_MAX - totalPenalty * LEVEL_COEFFICIENTS[level])
  );
  return { overallScore, adjustedScore };
}
