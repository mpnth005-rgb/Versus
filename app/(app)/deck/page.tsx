import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getReviewQueue, getSrsConfig } from "@/lib/deck";
import { ReviewSession, type QueueCard } from "@/components/deck/review-session";

type FlashcardRow = Awaited<ReturnType<typeof getReviewQueue>>["newCards"][number];

function toQueueCard(c: FlashcardRow): QueueCard {
  return {
    id: c.id,
    front: c.front,
    back: c.back,
    state: c.state,
    currentStep: c.currentStep,
    intervalDays: c.intervalDays,
    easeFactor: c.easeFactor,
    dueAt: c.dueAt.toISOString(),
  };
}

export default async function DeckPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [{ newCards, learningCards, reviewCards, dailyNewCardLimit, introducedToday }, srsConfig] =
    await Promise.all([getReviewQueue(session.user.id), getSrsConfig(session.user.id)]);

  return (
    <ReviewSession
      // Changing the daily limit refreshes this page; remounting picks up
      // the new quota instead of keeping the session's stale pools.
      key={dailyNewCardLimit}
      initialNew={newCards.map(toQueueCard)}
      initialLearning={learningCards.map(toQueueCard)}
      initialReview={reviewCards.map(toQueueCard)}
      dailyNewCardLimit={dailyNewCardLimit}
      introducedToday={introducedToday}
      srsConfig={srsConfig}
    />
  );
}
