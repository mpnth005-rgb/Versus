import { prisma } from "@/lib/prisma";
import { DEFAULT_DAILY_NEW_CARD_LIMIT } from "@/lib/constants";
import { DEFAULT_SRS_CONFIG, type SrsConfig } from "@/lib/srs";

export async function getUserSettings(userId: string) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  return settings;
}

export async function getDailyNewCardLimit(userId: string): Promise<number> {
  const settings = await getUserSettings(userId);
  return settings?.dailyNewCardLimit ?? DEFAULT_DAILY_NEW_CARD_LIMIT;
}

/** Reads the per-user SRS parameters — see prisma/schema.prisma:UserSettings.
 * Not exposed in a settings UI yet, but nothing in lib/srs.ts hardcodes
 * these, so one can be added later without touching scheduling logic. */
export async function getSrsConfig(userId: string): Promise<SrsConfig> {
  const settings = await getUserSettings(userId);
  if (!settings) return DEFAULT_SRS_CONFIG;
  return {
    learningStepsMinutes:
      (settings.learningStepsMinutes as number[] | null) ?? DEFAULT_SRS_CONFIG.learningStepsMinutes,
    relearningStepsMinutes:
      (settings.relearningStepsMinutes as number[] | null) ??
      DEFAULT_SRS_CONFIG.relearningStepsMinutes,
    graduatingIntervalDays: settings.graduatingIntervalDays,
    easyIntervalDays: settings.easyIntervalDays,
    minimumIntervalDays: settings.minimumIntervalDays,
    easeFactorFloor: settings.easeFactorFloor,
  };
}

export async function getReviewQueue(userId: string) {
  const now = new Date();
  const dailyNewCardLimit = await getDailyNewCardLimit(userId);

  const [dueLearning, dueRelearning, dueReview, newCards] = await Promise.all([
    prisma.flashcard.findMany({
      where: { userId, state: "LEARNING", dueAt: { lte: now } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.flashcard.findMany({
      where: { userId, state: "RELEARNING", dueAt: { lte: now } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.flashcard.findMany({
      where: { userId, state: "REVIEW", dueAt: { lte: now } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.flashcard.findMany({
      where: { userId, state: "NEW" },
      orderBy: { createdAt: "asc" },
      take: dailyNewCardLimit,
    }),
  ]);

  // Learning and relearning are mechanically identical (step ladders in
  // minutes) and share one "apprentissage" bucket in the UI, per spec.
  const queue = [...newCards, ...dueLearning, ...dueRelearning, ...dueReview];

  return {
    queue,
    counts: {
      new: newCards.length,
      learning: dueLearning.length + dueRelearning.length,
      review: dueReview.length,
    },
    dailyNewCardLimit,
  };
}
