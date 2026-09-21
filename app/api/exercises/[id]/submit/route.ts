import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  generateReferenceTranslation,
  classifyTranslation,
  AiNotConfiguredError,
} from "@/lib/ai";
import { computeScores, type ErrorType } from "@/lib/scoring";
import { countWords } from "@/lib/text";

const bodySchema = z.object({
  translation: z.string().min(1),
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

  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.userId !== session.user.id) {
    return NextResponse.json({ error: "Exercice introuvable." }, { status: 404 });
  }

  const translationWordCount = countWords(parsed.data.translation);
  if (translationWordCount < exercise.wordCount * 0.5) {
    return NextResponse.json(
      { error: "Votre traduction est trop courte (moins de 50% des mots attendus)." },
      { status: 400 }
    );
  }

  try {
    // Appel 2, then Appel 3 (see lib/ai.ts) — the reference translation is
    // generated fresh at submission time rather than cached at exercise
    // creation, so exercises abandoned before submission never cost that
    // call.
    const reference = await generateReferenceTranslation(exercise.sourceText);
    const classification = await classifyTranslation({
      sourceText: exercise.sourceText,
      reference,
      userTranslation: parsed.data.translation,
    });

    // Scoring is always computed here, deterministically, from the fixed
    // penalty table — never trusted to the model. See lib/scoring.ts.
    const errorTypes: ErrorType[] = classification.flaggedSentences.flatMap((s) =>
      s.errors.map((e) => e.type)
    );
    const { overallScore, adjustedScore } = computeScores(errorTypes, exercise.level);

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
          overallScore,
          adjustedScore,
          referenceTranslation: reference.traductionComplete,
          sentenceCorrections: classification.flaggedSentences,
          suggestedCards: classification.suggestedCards,
        },
        create: {
          exerciseId: id,
          overallScore,
          adjustedScore,
          referenceTranslation: reference.traductionComplete,
          sentenceCorrections: classification.flaggedSentences,
          suggestedCards: classification.suggestedCards,
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
