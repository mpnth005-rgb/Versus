import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateExerciseText, AiNotConfiguredError } from "@/lib/ai";
import { getUserQuota, consumeExerciseQuota } from "@/lib/quota";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { id } = await params;
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.userId !== session.user.id) {
    return NextResponse.json({ error: "Exercice introuvable." }, { status: 404 });
  }

  const quota = await getUserQuota(session.user.id);
  if (!quota.canStartExercise) {
    return NextResponse.json(
      { error: "Limite mensuelle d'exercices atteinte." },
      { status: 403 }
    );
  }

  try {
    const generated = await generateExerciseText({
      textType: exercise.textType,
      level: exercise.level,
      themes: Array.isArray(exercise.themes) ? (exercise.themes as string[]) : [],
    });

    await prisma.$transaction([
      prisma.correction.deleteMany({ where: { exerciseId: id } }),
      prisma.translation.deleteMany({ where: { exerciseId: id } }),
      prisma.exercise.update({
        where: { id },
        data: {
          title: generated.title,
          sourceText: generated.sourceText,
          wordCount: generated.wordCount,
          status: "READY",
        },
      }),
    ]);
    await consumeExerciseQuota(session.user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("exercise regeneration error", error);
    return NextResponse.json(
      { error: "La régénération du texte a échoué. Réessayez." },
      { status: 500 }
    );
  }
}
