import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scheduleCard } from "@/lib/srs";
import { getSrsConfig } from "@/lib/deck";

const bodySchema = z.object({
  cardId: z.string(),
  rating: z.enum(["AGAIN", "HARD", "GOOD", "EASY"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const card = await prisma.flashcard.findUnique({ where: { id: parsed.data.cardId } });
  if (!card || card.userId !== session.user.id) {
    return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });
  }

  const config = await getSrsConfig(session.user.id);
  const { schedule, dueAt } = scheduleCard(
    {
      state: card.state,
      currentStep: card.currentStep,
      intervalDays: card.intervalDays,
      easeFactor: card.easeFactor,
    },
    parsed.data.rating,
    config,
    { cardId: card.id, dueAt: card.dueAt }
  );

  await prisma.flashcard.update({
    where: { id: card.id },
    data: {
      state: schedule.state,
      currentStep: schedule.currentStep,
      intervalDays: schedule.intervalDays,
      easeFactor: schedule.easeFactor,
      dueAt,
      // First rating of a new card counts against today's new-card quota.
      ...(card.state === "NEW" ? { introducedAt: new Date() } : {}),
    },
  });

  // The review session uses the new schedule to re-bucket the card and
  // pick the next one without reloading.
  return NextResponse.json({
    card: {
      state: schedule.state,
      currentStep: schedule.currentStep,
      intervalDays: schedule.intervalDays,
      easeFactor: schedule.easeFactor,
      dueAt: dueAt.toISOString(),
    },
  });
}
