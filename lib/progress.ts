import { prisma } from "@/lib/prisma";
import { currentYearMonth } from "@/lib/constants";

export type ScoredExercise = {
  id: string;
  title: string;
  textType: string;
  level: string;
  score: number;
  createdAt: Date;
};

async function getAllScoredExercises(userId: string): Promise<ScoredExercise[]> {
  const exercises = await prisma.exercise.findMany({
    where: { userId, correction: { isNot: null } },
    include: { correction: true },
    orderBy: { createdAt: "asc" },
  });

  return exercises
    .filter((e) => e.correction)
    .map((e) => ({
      id: e.id,
      title: e.title,
      textType: e.textType,
      level: e.level,
      score: e.correction!.overallScore,
      createdAt: e.createdAt,
    }));
}

export async function getProgressOverview(userId: string, selectedMonth?: string) {
  const all = await getAllScoredExercises(userId);
  const yearMonth = selectedMonth ?? currentYearMonth();

  const monthExercises = all.filter(
    (e) => `${e.createdAt.getUTCFullYear()}-${String(e.createdAt.getUTCMonth() + 1).padStart(2, "0")}` === yearMonth
  );
  const avgScore =
    monthExercises.length > 0
      ? Math.round(
          (monthExercises.reduce((sum, e) => sum + e.score, 0) / monthExercises.length) * 100
        ) / 100
      : null;

  const months = [
    ...new Set(
      all.map(
        (e) => `${e.createdAt.getUTCFullYear()}-${String(e.createdAt.getUTCMonth() + 1).padStart(2, "0")}`
      )
    ),
  ].sort();

  const recent = all.slice(-8);

  const now = new Date();
  const weekCounts: number[] = [];
  for (let w = 6; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay() - w * 7);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
    weekCounts.push(
      all.filter((e) => e.createdAt >= weekStart && e.createdAt < weekEnd).length
    );
  }

  return {
    exercisesCount: all.length,
    avgScore,
    selectedMonth: yearMonth,
    availableMonths: months,
    recentScores: recent.map((e) => e.score),
    weeklyCounts: weekCounts,
  };
}

const PAGE_SIZE = 5;

export async function getSessionsHistory(userId: string, page: number) {
  const [total, exercises] = await Promise.all([
    prisma.exercise.count({ where: { userId, correction: { isNot: null } } }),
    prisma.exercise.findMany({
      where: { userId, correction: { isNot: null } },
      include: { correction: true },
      orderBy: { createdAt: "desc" },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return {
    sessions: exercises.map((e) => ({
      id: e.id,
      title: e.title,
      textType: e.textType,
      level: e.level,
      score: e.correction!.overallScore,
      createdAt: e.createdAt,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    hasNext: (page + 1) * PAGE_SIZE < total,
    hasPrev: page > 0,
  };
}
