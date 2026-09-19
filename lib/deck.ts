import { prisma } from "@/lib/prisma";
import { DEFAULT_DAILY_NEW_CARD_LIMIT } from "@/lib/constants";

export async function getDailyNewCardLimit(userId: string): Promise<number> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  return settings?.dailyNewCardLimit ?? DEFAULT_DAILY_NEW_CARD_LIMIT;
}

export async function getReviewQueue(userId: string) {
  const now = new Date();
  const dailyNewCardLimit = await getDailyNewCardLimit(userId);

  const [dueLearning, dueReview, newCards] = await Promise.all([
    prisma.flashcard.findMany({
      where: { userId, state: "LEARNING", dueAt: { lte: now } },
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

  const queue = [...newCards, ...dueLearning, ...dueReview];

  return {
    queue,
    counts: {
      new: newCards.length,
      learning: dueLearning.length,
      review: dueReview.length,
    },
    dailyNewCardLimit,
  };
}
