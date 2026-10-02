import { prisma } from "@/lib/prisma";

export type ScoredExercise = {
  id: string;
  title: string;
  textType: string;
  level: string;
  score: number;
  createdAt: Date;
};

/** Every corrected exercise, oldest first. The progress dashboard derives
 * all of its figures, filters and charts from this list client-side. */
export async function getScoredExercises(userId: string): Promise<ScoredExercise[]> {
  const exercises = await prisma.exercise.findMany({
    where: { userId, correction: { isNot: null } },
    include: { correction: true },
    orderBy: { createdAt: "asc" },
  });

  return exercises.map((e) => ({
    id: e.id,
    title: e.title,
    textType: e.textType,
    level: e.level,
    score: e.correction!.adjustedScore,
    createdAt: e.createdAt,
  }));
}

/** Every corrected exercise for the "Historique des exercices" table,
 * newest first. The table shows up to 10 rows and scrolls past that.
 */
export async function getHistory(userId: string) {
  const exercises = await prisma.exercise.findMany({
    where: { userId, correction: { isNot: null } },
    include: { correction: true },
    orderBy: { createdAt: "desc" },
  });

  return exercises.map((e) => ({
    id: e.id,
    title: e.title,
    textType: e.textType,
    level: e.level,
    score: e.correction!.adjustedScore,
    createdAt: e.createdAt,
  }));
}
