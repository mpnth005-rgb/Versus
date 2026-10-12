import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkDeckAnswer, AiNotConfiguredError } from "@/lib/ai";
import { getUserQuota, getDeckChecksRemaining, consumeDeckCheck } from "@/lib/quota";
import { ERROR_TYPES, type ErrorType } from "@/lib/scoring";
import { MAX_DECK_ANSWER_CHARS } from "@/lib/constants";

const bodySchema = z.object({
  cardId: z.string().min(1),
  answer: z.string().trim().min(1).max(MAX_DECK_ANSWER_CHARS),
});

/** "Vérifier ma réponse" during a review: a short, indicative verdict. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const userId = session.user.id;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const card = await prisma.flashcard.findUnique({ where: { id: parsed.data.cardId } });
  if (!card || card.userId !== userId) {
    return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });
  }

  const quota = await getUserQuota(userId);
  const remaining = await getDeckChecksRemaining(userId, quota.isPremium);
  if (remaining === 0) {
    return NextResponse.json(
      { error: "Limite quotidienne de corrections atteinte.", remaining: 0 },
      { status: 403 }
    );
  }

  try {
    const category = (ERROR_TYPES as string[]).includes(card.category ?? "")
      ? (card.category as ErrorType)
      : null;
    const check = await checkDeckAnswer({
      front: card.front,
      back: card.back,
      answer: parsed.data.answer,
      category,
    });
    // Only a check that succeeded counts against the daily limit.
    await consumeDeckCheck(userId);
    return NextResponse.json({
      ...check,
      remaining: remaining === null ? null : remaining - 1,
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("deck answer check error", error);
    return NextResponse.json({ error: "La correction a échoué." }, { status: 500 });
  }
}
