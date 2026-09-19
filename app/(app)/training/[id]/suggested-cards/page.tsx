import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserQuota } from "@/lib/quota";
import { FREE_MAX_CARDS_PER_EXERCISE } from "@/lib/constants";
import { SuggestedCardsView, type SuggestedCard } from "@/components/training/suggested-cards-view";

export default async function SuggestedCardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const exercise = await prisma.exercise.findUnique({
    where: { id },
    include: { correction: true },
  });
  if (!exercise || exercise.userId !== session.user.id) notFound();
  if (!exercise.correction) redirect(`/training/${id}`);
  if (exercise.status === "COMPLETED") redirect(`/training/${id}/complete`);

  const quota = await getUserQuota(session.user.id);

  return (
    <SuggestedCardsView
      exerciseId={exercise.id}
      initialCards={exercise.correction.suggestedCards as SuggestedCard[]}
      maxCards={quota.isPremium ? Infinity : FREE_MAX_CARDS_PER_EXERCISE}
    />
  );
}
