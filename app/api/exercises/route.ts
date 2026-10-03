import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateExerciseText, AiNotConfiguredError } from "@/lib/ai";
import { getUserQuota, consumeExerciseQuota } from "@/lib/quota";
import { getRecentTitles } from "@/lib/progress";
import { MAX_THEMES, THEME_OPTIONS } from "@/lib/constants";

const bodySchema = z.object({
  textType: z.enum(["LITERARY", "JOURNALISTIC", "DAILY"]),
  level: z.enum(["A2", "B1", "B2", "C1"]),
  themes: z.array(z.enum(THEME_OPTIONS)).max(MAX_THEMES),
  anchoredInNews: z.boolean().optional(),
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

  const quota = await getUserQuota(session.user.id);
  if (!quota.canStartExercise) {
    return NextResponse.json(
      { error: "Limite mensuelle d'exercices atteinte." },
      { status: 403 }
    );
  }

  // "Ancrer dans l'actualité" (journalistic texts only): generation searches
  // the web (lib/ai.ts).
  const anchoredInNews =
    parsed.data.anchoredInNews === true && parsed.data.textType === "JOURNALISTIC";

  try {
    // The subtheme is no longer picked by the learner: lib/ai.ts draws one
    // (and an angle within it) for every generation.
    const recentTitles = await getRecentTitles(session.user.id);
    const generated = await generateExerciseText({ ...parsed.data, anchoredInNews, recentTitles });
    const exercise = await prisma.exercise.create({
      data: {
        userId: session.user.id,
        title: generated.title,
        textType: parsed.data.textType,
        level: parsed.data.level,
        themes: parsed.data.themes,
        anchoredInNews,
        sourceText: generated.sourceText,
        wordCount: generated.wordCount,
        status: "READY",
      },
    });
    await consumeExerciseQuota(session.user.id);
    return NextResponse.json({ id: exercise.id });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("exercise generation error", error);
    return NextResponse.json(
      { error: "La génération du texte a échoué. Réessayez." },
      { status: 500 }
    );
  }
}
