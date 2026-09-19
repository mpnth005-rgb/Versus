import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { suggestReplacementCard, AiNotConfiguredError } from "@/lib/ai";

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
    category: string;
  }>;
  if (parsed.data.index >= cards.length) {
    return NextResponse.json({ error: "Index invalide." }, { status: 400 });
  }

  try {
    const replacement = await suggestReplacementCard({
      sourceText: exercise.sourceText,
      existingFronts: cards.map((c) => c.front),
    });
    const updated = [...cards];
    updated[parsed.data.index] = replacement;

    await prisma.correction.update({
      where: { exerciseId: id },
      data: { suggestedCards: updated },
    });

    return NextResponse.json({ card: replacement });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("suggested card refresh error", error);
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}
