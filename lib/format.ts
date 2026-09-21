// Scores are quarter-point increments (see lib/scoring.ts) — French
// decimal comma, and no trailing zeros for whole numbers (20 not 20,00).
export function formatScore(score: number): string {
  return score.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDueRelative(due: Date, now: Date = new Date()): string {
  const diffMinutes = (due.getTime() - now.getTime()) / 60_000;

  if (diffMinutes <= 0 || isSameDay(due, now)) return "Aujourd'hui";
  if (diffMinutes < 60) return `Dans ${Math.round(diffMinutes)} min`;

  const diffDays = Math.ceil(diffMinutes / 1440);
  return `Dans ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
}
