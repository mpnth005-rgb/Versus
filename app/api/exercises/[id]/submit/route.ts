import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { correctTranslation, AiNotConfiguredError } from "@/lib/ai";

const bodySchema = z.object({
  translation: z.string().min(1),
});

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

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

  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.userId !== session.user.id) {
    return NextResponse.json({ error: "Exercice introuvable." }, { status: 404 });
  }

  const translationWordCount = wordCount(parsed.data.translation);
  if (translationWordCount < exercise.wordCount * 0.5) {
    return NextResponse.json(
      { error: "Votre traduction est trop courte (moins de 50% des mots attendus)." },
      { status: 400 }
    );
  }

  try {
    const result = await correctTranslation({
      sourceText: exercise.sourceText,
      userTranslation: parsed.data.translation,
      level: exercise.level,
    });

    await prisma.$transaction([
      prisma.translation.upsert({
        where: { exerciseId: id },
        update: { content: parsed.data.translation, wordCount: translationWordCount },
        create: {
          exerciseId: id,
          content: parsed.data.translation,
          wordCount: translationWordCount,
        },
      }),
      prisma.correction.upsert({
        where: { exerciseId: id },
        update: {
          overallScore: result.overallScore,
          adjustedScore: result.adjustedScore,
          referenceTranslation: result.referenceTranslation,
          sentenceCorrections: result.sentenceCorrections,
          suggestedCards: result.suggestedCards,
        },
        create: {
          exerciseId: id,
          overallScore: result.overallScore,
          adjustedScore: result.adjustedScore,
          referenceTranslation: result.referenceTranslation,
          sentenceCorrections: result.sentenceCorrections,
          suggestedCards: result.suggestedCards,
        },
      }),
      prisma.exercise.update({ where: { id }, data: { status: "CORRECTED" } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("translation correction error", error);
    return NextResponse.json(
      { error: "La correction a échoué. Réessayez." },
      { status: 500 }
    );
  }
}
