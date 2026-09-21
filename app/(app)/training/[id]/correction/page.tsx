import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CorrectionView, type FlaggedSentence } from "@/components/training/correction-view";

export default async function CorrectionPage({
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

  const suggestedCards = exercise.correction.suggestedCards as Array<{
    front: string;
    back: string;
  }>;

  return (
    <CorrectionView
      data={{
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        level: exercise.level,
        overallScore: exercise.correction.overallScore,
        adjustedScore: exercise.correction.adjustedScore,
        referenceTranslation: exercise.correction.referenceTranslation,
        flaggedSentences: exercise.correction.sentenceCorrections as FlaggedSentence[],
        suggestedCardsCount: suggestedCards.length,
        completed: exercise.status === "COMPLETED",
      }}
    />
  );
}
