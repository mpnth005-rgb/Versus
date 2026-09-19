import { prisma } from "@/lib/prisma";
import { FREE_MONTHLY_EXERCISE_LIMIT, currentYearMonth } from "@/lib/constants";

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
