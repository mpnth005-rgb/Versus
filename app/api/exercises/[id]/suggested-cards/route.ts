import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserQuota } from "@/lib/quota";
import { FREE_MAX_CARDS_PER_EXERCISE } from "@/lib/constants";

const bodySchema = z.object({
  selected: z.array(z.number().int().nonnegative()),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const exercise = await prisma.exercise.findUnique({
    where: { id },
    include: { correction: true },
  });
  if (!exercise || exercise.userId !== session.user.id || !exercise.correction) {
    return NextResponse.json({ error: "Exercice introuvable." }, { status: 404 });
  }

  const quota = await getUserQuota(session.user.id);
  const maxCards = quota.isPremium ? Infinity : FREE_MAX_CARDS_PER_EXERCISE;
  const selectedIndexes = [...new Set(parsed.data.selected)].slice(0, maxCards);

  const suggestedCards = exercise.correction.suggestedCards as Array<{
    front: string;
    back: string;
  }>;

  const cardsToCreate = selectedIndexes
    .map((i) => suggestedCards[i])
    .filter((card): card is { front: string; back: string } => Boolean(card));

  await prisma.$transaction([
    ...cardsToCreate.map((card) =>
      prisma.flashcard.create({
        data: {
          userId: session.user.id,
          front: card.front,
          back: card.back,
          sourceExerciseId: id,
        },
      })
    ),
    prisma.exercise.update({ where: { id }, data: { status: "COMPLETED" } }),
  ]);

  return NextResponse.json({ addedCount: cardsToCreate.length });
}
