import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { suggestReplacementCard, AiNotConfiguredError } from "@/lib/ai";
import type { ErrorType } from "@/lib/scoring";

const bodySchema = z.object({ index: z.number().int().nonnegative() });

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

  const cards = exercise.correction.suggestedCards as Array<{
    front: string;
    back: string;
    category: ErrorType;
    sentenceNumber?: number;
    // Every sentence proposed before the current one, oldest first.
    previousFronts?: string[];
  }>;
  const sentences = (exercise.correction.sentenceCorrections ?? []) as Array<{
    sentenceNumber: number;
    sourceSentence: string;
    userSentence: string;
    referenceSentence?: string | null;
    errors: Array<{ type: ErrorType; explanation: string }>;
  }>;
  if (parsed.data.index >= cards.length) {
    return NextResponse.json({ error: "Index invalide." }, { status: 400 });
  }

  try {
    const target = cards[parsed.data.index];
    // The mistake this card was made for: its sentence when known (newer
    // corrections), otherwise the first sentence with an error of its type.
    const hasCategory = (s: (typeof sentences)[number]) =>
      s.errors.some((e) => e.type === target.category);
    const sentence =
      sentences.find((s) => s.sentenceNumber === target.sentenceNumber && hasCategory(s)) ??
      sentences.find(hasCategory);
    const previousFronts = [...(target.previousFronts ?? []), target.front];

    const replacement = await suggestReplacementCard({
      errorType: target.category,
      previousFronts,
      error: sentence && {
        sourceSentence: sentence.sourceSentence,
        userSentence: sentence.userSentence,
        referenceSentence: sentence.referenceSentence ?? null,
        explanations: sentence.errors
          .filter((e) => e.type === target.category)
          .map((e) => e.explanation),
      },
    });
    const updated = [...cards];
    updated[parsed.data.index] = {
      ...replacement,
      sentenceNumber: sentence?.sentenceNumber,
      previousFronts,
    };

    await prisma.correction.update({
      where: { exerciseId: id },
      data: { suggestedCards: updated },
    });

    return NextResponse.json({ card: updated[parsed.data.index] });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("suggested card refresh error", error);
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}
