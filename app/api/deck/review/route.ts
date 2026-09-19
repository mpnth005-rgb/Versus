import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scheduleCard, dueAtFromNow } from "@/lib/srs";

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

  const next = scheduleCard(
    {
      state: card.state,
      intervalMinutes: card.intervalMinutes,
      easeFactor: card.easeFactor,
      repetitions: card.repetitions,
    },
    parsed.data.rating
  );

  await prisma.flashcard.update({
    where: { id: card.id },
    data: {
      state: next.state,
      intervalMinutes: next.intervalMinutes,
      easeFactor: next.easeFactor,
      repetitions: next.repetitions,
      dueAt: dueAtFromNow(next.intervalMinutes),
    },
  });

  return NextResponse.json({ ok: true });
}
