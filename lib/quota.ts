import { prisma } from "@/lib/prisma";
import {
  FREE_DAILY_DECK_CHECKS,
  FREE_MONTHLY_EXERCISE_LIMIT,
  currentYearMonth,
} from "@/lib/constants";
import { startOfStudyDay } from "@/lib/deck";

export type Quota = {
  plan: "FREE" | "MONTHLY" | "ANNUAL";
  isPremium: boolean;
  exercisesUsed: number;
  exercisesRemaining: number;
  canStartExercise: boolean;
};

export async function getUserQuota(userId: string): Promise<Quota> {
  const [subscription, usage] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.monthlyUsage.findUnique({
      where: { userId_yearMonth: { userId, yearMonth: currentYearMonth() } },
    }),
  ]);

  const plan = subscription?.plan ?? "FREE";
  const isPremium =
    plan !== "FREE" && subscription?.status === "ACTIVE";
  const exercisesUsed = usage?.exercisesUsed ?? 0;
  const exercisesRemaining = Math.max(0, FREE_MONTHLY_EXERCISE_LIMIT - exercisesUsed);

  return {
    plan,
    isPremium,
    exercisesUsed,
    exercisesRemaining,
    canStartExercise: isPremium || exercisesRemaining > 0,
  };
}

export async function consumeExerciseQuota(userId: string): Promise<void> {
  const yearMonth = currentYearMonth();
  await prisma.monthlyUsage.upsert({
    where: { userId_yearMonth: { userId, yearMonth } },
    update: { exercisesUsed: { increment: 1 } },
    create: { userId, yearMonth, exercisesUsed: 1 },
  });
}

// --- Deck answer checks ("Vérifier ma réponse") -----------------------------

/** "2026-10-11": the Paris date of the current study day's 4 a.m. start. */
function studyDayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(startOfStudyDay());
}

/** Checks left today: null = unlimited (Versus Upper). */
export async function getDeckChecksRemaining(userId: string, isPremium: boolean): Promise<number | null> {
  if (isPremium) return null;
  const usage = await prisma.deckCheckUsage.findUnique({
    where: { userId_studyDay: { userId, studyDay: studyDayKey() } },
  });
  return Math.max(0, FREE_DAILY_DECK_CHECKS - (usage?.checksUsed ?? 0));
}

export async function consumeDeckCheck(userId: string): Promise<void> {
  const studyDay = studyDayKey();
  await prisma.deckCheckUsage.upsert({
    where: { userId_studyDay: { userId, studyDay } },
    update: { checksUsed: { increment: 1 } },
    create: { userId, studyDay, checksUsed: 1 },
  });
}
