import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getReviewQueue } from "@/lib/deck";
import { ReviewSession } from "@/components/deck/review-session";

export default async function DeckPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { queue, counts, dailyNewCardLimit } = await getReviewQueue(session.user.id);

  return (
    <ReviewSession
      initialQueue={queue.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        state: c.state,
        currentStep: c.currentStep,
        intervalDays: c.intervalDays,
        easeFactor: c.easeFactor,
      }))}
      counts={counts}
      dailyNewCardLimit={dailyNewCardLimit}
    />
  );
}
